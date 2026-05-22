"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const uuid_1 = require("uuid");
const agent_js_1 = require("./agent.js");
const browser_js_1 = require("./browser.js");
const storage_js_1 = require("./storage.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ---- config ----
const PORT = parseInt(process.env.SCRAPER_PORT ?? '7501', 10);
const BIND = process.env.SCRAPER_BIND ?? '127.0.0.1';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_SESSIONS ?? '8', 10);
const SESSION_IDLE_TTL_MS = 10 * 60 * 1000; // 10 min
// ---- session registry ----
const sessions = new Map();
// live-frame WS clients: sessionId -> Set<WebSocket>
const liveClients = new Map();
// event WS clients: sessionId -> Set<WebSocket>
const eventClients = new Map();
// ---- express app ----
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Serve captured element screenshots (used as media_url fallback)
const CAPTURES_DIR = path_1.default.join(process.env.STORAGE_DIR ?? path_1.default.join(process.cwd(), 'data'), 'captures');
if (!fs_1.default.existsSync(CAPTURES_DIR))
    fs_1.default.mkdirSync(CAPTURES_DIR, { recursive: true });
app.use('/captures', express_1.default.static(CAPTURES_DIR));
// Simple shared-secret auth for internal use
const INTERNAL_SECRET = process.env.SCRAPER_INTERNAL_SECRET ?? '';
function checkSecret(req, res) {
    if (!INTERNAL_SECRET)
        return true; // disabled in dev
    const header = req.headers['x-scraper-secret'];
    if (header !== INTERNAL_SECRET) {
        res.status(403).json({ error: 'Forbidden' });
        return false;
    }
    return true;
}
/** POST /sessions — start a new scrape */
app.post('/sessions', async (req, res) => {
    if (!checkSecret(req, res))
        return;
    const body = req.body;
    const activeSessions = [...sessions.values()].filter((s) => s.status === 'running' || s.status === 'starting');
    if (activeSessions.length >= MAX_CONCURRENT) {
        res.status(429).json({ error: 'Too many concurrent sessions' });
        return;
    }
    if (!body.url) {
        res.status(422).json({ error: 'url is required' });
        return;
    }
    const sessionId = (0, uuid_1.v4)();
    const abortController = new AbortController();
    const session = {
        id: sessionId,
        url: body.url,
        status: 'starting',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        abortController,
    };
    sessions.set(sessionId, session);
    liveClients.set(sessionId, new Set());
    eventClients.set(sessionId, new Set());
    // Return immediately so the frontend can open WS connections
    const rawHost = req.headers['x-forwarded-host'] ?? req.headers.host ?? `${BIND}:${PORT}`;
    const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
    const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'ws' : 'wss';
    res.json({
        sessionId,
        liveWsUrl: `${proto}://${host}/ws/live/${sessionId}`,
        eventsWsUrl: `${proto}://${host}/ws/events/${sessionId}`,
    });
    // Run the agent asynchronously
    (async () => {
        let browserSession = null;
        try {
            session.status = 'running';
            // Resolve credentials — DB-supplied first, then fall back to .env
            let credentials = undefined;
            let storageStatePath;
            const dataDir = process.env.STORAGE_DIR ?? path_1.default.join(process.cwd(), 'data');
            if (body.credentialsSignedUrl) {
                credentials = await (0, storage_js_1.fetchCredentials)(body.credentialsSignedUrl);
            }
            // Resolve effective credentials (DB or env)
            const effectiveCreds = (0, agent_js_1.resolveCredentials)(body.url, credentials);
            if (effectiveCreds) {
                const cached = (0, storage_js_1.loadStorageState)(effectiveCreds.id);
                if (cached) {
                    console.log(`[session ${sessionId}] Loaded saved login state for ${effectiveCreds.id} — skipping login`);
                    const tmpPath = path_1.default.join(dataDir, `state-${effectiveCreds.id}-tmp.json`);
                    fs_1.default.writeFileSync(tmpPath, cached, 'utf-8');
                    storageStatePath = tmpPath;
                }
                else {
                    console.log(`[session ${sessionId}] No saved login state for ${effectiveCreds.id} — will log in fresh`);
                }
            }
            const maxPosts = Math.max(1, body.maxPosts ??
                (parseInt(process.env.SCRAPER_MAX_POSTS ?? '8', 10) || 8));
            // Single tab — simpler, faster in practice for the Gemini loop
            const slices = (0, agent_js_1.planTabSlices)(maxPosts, maxPosts, maxPosts, 1);
            console.log(`[session ${sessionId}] 1 tab, ${maxPosts} posts target`);
            browserSession = await (0, browser_js_1.launchBrowser)(storageStatePath, 1);
            // Wire screencast → live WS clients
            const { cdp, pages } = browserSession;
            const liveSet = liveClients.get(sessionId);
            // Proxy screencast frames to all connected live clients
            await cdp.send('Page.startScreencast', {
                format: 'jpeg',
                quality: 55,
                maxWidth: 1280,
                maxHeight: 800,
                everyNthFrame: 3,
            });
            cdp.on('Page.screencastFrame', async ({ data, sessionId: frameId, }) => {
                session.lastActiveAt = Date.now();
                const msg = JSON.stringify({ type: 'frame', data });
                for (const ws of liveSet) {
                    if (ws.readyState === ws_1.WebSocket.OPEN)
                        ws.send(msg);
                }
                await cdp
                    .send('Page.screencastFrameAck', { sessionId: frameId })
                    .catch(() => { });
            });
            // Multi-cast events WS
            const eventsSet = eventClients.get(sessionId);
            const broadcastWs = {
                readyState: ws_1.WebSocket.OPEN,
                send: (data) => {
                    session.lastActiveAt = Date.now();
                    for (const ws of eventsSet) {
                        if (ws.readyState === ws_1.WebSocket.OPEN)
                            ws.send(data);
                    }
                },
            };
            const result = await (0, agent_js_1.runAgent)(pages, body.url, broadcastWs, abortController.signal, credentials, slices);
            // Always persist refreshed cookies so the next run skips login
            if (effectiveCreds) {
                try {
                    const state = await browserSession.context.storageState();
                    const stateStr = JSON.stringify(state);
                    (0, storage_js_1.saveStorageState)(effectiveCreds.id, stateStr);
                    console.log(`[session ${sessionId}] Saved login state for ${effectiveCreds.id}`);
                    // Also push back to Laravel DB if a push URL was provided (DB-sourced credentials)
                    if (body.storageStatePushUrl) {
                        const { pushStorageState } = await Promise.resolve().then(() => __importStar(require('./storage.js')));
                        await pushStorageState(body.storageStatePushUrl, effectiveCreds.id, stateStr).catch(() => { });
                    }
                }
                catch {
                    // non-fatal — scrape result is still valid
                }
            }
            session.status = 'done';
            console.log(`[session ${sessionId}] done — ${result.posts.length} posts`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const isCancelled = msg === 'cancelled';
            session.status = isCancelled ? 'cancelled' : 'error';
            const eventsSet = eventClients.get(sessionId);
            if (eventsSet) {
                // For clean cancellations, emit 'cancelled' so the frontend preserves
                // already-collected posts rather than switching to an error state.
                const eventType = isCancelled ? 'cancelled' : 'error';
                const payload = JSON.stringify({ type: eventType, data: { message: msg } });
                for (const ws of eventsSet) {
                    if (ws.readyState === ws_1.WebSocket.OPEN)
                        ws.send(payload);
                }
            }
            if (!isCancelled)
                console.error(`[session ${sessionId}] error: ${msg}`);
        }
        finally {
            if (browserSession)
                await browserSession.close();
            // Keep session metadata for 2 min then GC
            setTimeout(() => {
                sessions.delete(sessionId);
                liveClients.delete(sessionId);
                eventClients.delete(sessionId);
            }, 2 * 60 * 1000);
        }
    })();
});
/** POST /sessions/:id/cancel */
app.post('/sessions/:id/cancel', (req, res) => {
    if (!checkSecret(req, res))
        return;
    const id = String(req.params['id']);
    const session = sessions.get(id);
    if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    session.abortController.abort();
    session.status = 'cancelled';
    res.json({ ok: true });
});
/** GET /sessions/:id — status */
app.get('/sessions/:id', (req, res) => {
    if (!checkSecret(req, res))
        return;
    const id = String(req.params['id']);
    const session = sessions.get(id);
    if (!session) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const { abortController: _, ...safe } = session;
    res.json(safe);
});
// ---- HTTP + WS server ----
const server = http_1.default.createServer(app);
// No path filter here — the connection handler below routes by URL itself.
const wss = new ws_1.WebSocketServer({ server });
wss.on('connection', (ws, req) => {
    const url = req.url ?? '';
    const liveMatch = url.match(/^\/ws\/live\/([^/?]+)/);
    const eventsMatch = url.match(/^\/ws\/events\/([^/?]+)/);
    if (liveMatch) {
        const sessionId = liveMatch[1];
        const set = liveClients.get(sessionId);
        if (!set) {
            ws.close(4004, 'Session not found');
            return;
        }
        set.add(ws);
        ws.on('close', () => set.delete(ws));
        ws.send(JSON.stringify({ type: 'connected', sessionId }));
        return;
    }
    if (eventsMatch) {
        const sessionId = eventsMatch[1];
        const set = eventClients.get(sessionId);
        if (!set) {
            ws.close(4004, 'Session not found');
            return;
        }
        set.add(ws);
        ws.on('close', () => set.delete(ws));
        ws.send(JSON.stringify({ type: 'connected', sessionId }));
        return;
    }
    ws.close(4000, 'Unknown path');
});
// ---- idle session reaper ----
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if ((session.status === 'running' || session.status === 'starting') &&
            now - session.lastActiveAt > SESSION_IDLE_TTL_MS) {
            console.warn(`[reaper] Aborting idle session ${id}`);
            session.abortController.abort();
            session.status = 'cancelled';
        }
    }
}, 60_000);
server.listen(PORT, BIND, () => {
    console.log(`[scraper-agent] Listening on ${BIND}:${PORT}`);
});
// ---- graceful shutdown ----
process.on('SIGTERM', () => {
    console.log('[scraper-agent] SIGTERM received, shutting down');
    for (const session of sessions.values()) {
        session.abortController.abort();
    }
    server.close(() => process.exit(0));
});
//# sourceMappingURL=server.js.map