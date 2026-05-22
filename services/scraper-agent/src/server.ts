import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { runAgent, resolveCredentials, planTabSlices } from './agent.js';
import { launchBrowser, startScreencast, stopScreencast } from './browser.js';
import { fetchCredentials, loadStorageState, saveStorageState } from './storage.js';
import { Session, SessionOptions } from './types.js';
import fs from 'fs';
import path from 'path';

// ---- config ----
const PORT = parseInt(process.env.SCRAPER_PORT ?? '7501', 10);
const BIND = process.env.SCRAPER_BIND ?? '127.0.0.1';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_SESSIONS ?? '8', 10);
const SESSION_IDLE_TTL_MS = 10 * 60 * 1000; // 10 min

// ---- session registry ----
const sessions = new Map<string, Session>();

// live-frame WS clients: sessionId -> Set<WebSocket>
const liveClients = new Map<string, Set<WebSocket>>();
// event WS clients: sessionId -> Set<WebSocket>
const eventClients = new Map<string, Set<WebSocket>>();

// ---- express app ----
const app = express();
app.use(express.json());

// Serve captured element screenshots (used as media_url fallback)
const CAPTURES_DIR = path.join(
  process.env.STORAGE_DIR ?? path.join(process.cwd(), 'data'),
  'captures',
);
if (!fs.existsSync(CAPTURES_DIR)) fs.mkdirSync(CAPTURES_DIR, { recursive: true });
app.use('/captures', express.static(CAPTURES_DIR));

// Simple shared-secret auth for internal use
const INTERNAL_SECRET = process.env.SCRAPER_INTERNAL_SECRET ?? '';

function checkSecret(req: Request, res: Response): boolean {
  if (!INTERNAL_SECRET) return true; // disabled in dev
  const header = req.headers['x-scraper-secret'];
  if (header !== INTERNAL_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

/** POST /sessions — start a new scrape */
app.post('/sessions', async (req: Request, res: Response): Promise<void> => {
  if (!checkSecret(req, res)) return;

  const body = req.body as SessionOptions & {
    credentialsSignedUrl?: string;
    storageStatePushUrl?: string;
  };

  const activeSessions = [...sessions.values()].filter(
    (s) => s.status === 'running' || s.status === 'starting',
  );
  if (activeSessions.length >= MAX_CONCURRENT) {
    res.status(429).json({ error: 'Too many concurrent sessions' });
    return;
  }

  if (!body.url) {
    res.status(422).json({ error: 'url is required' });
    return;
  }

  const sessionId = uuidv4();
  const abortController = new AbortController();

  const session: Session = {
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
    let browserSession: Awaited<ReturnType<typeof launchBrowser>> | null = null;
    try {
      session.status = 'running';

      // Resolve credentials — DB-supplied first, then fall back to .env
      let credentials = undefined;
      let storageStatePath: string | undefined;
      const dataDir = process.env.STORAGE_DIR ?? path.join(process.cwd(), 'data');

      if (body.credentialsSignedUrl) {
        credentials = await fetchCredentials(body.credentialsSignedUrl);
      }

      // Resolve effective credentials (DB or env)
      const effectiveCreds = resolveCredentials(body.url, credentials);

      if (effectiveCreds) {
        const cached = loadStorageState(effectiveCreds.id);
        if (cached) {
          console.log(`[session ${sessionId}] Loaded saved login state for ${effectiveCreds.id} — skipping login`);
          const tmpPath = path.join(dataDir, `state-${effectiveCreds.id}-tmp.json`);
          fs.writeFileSync(tmpPath, cached, 'utf-8');
          storageStatePath = tmpPath;
        } else {
          console.log(`[session ${sessionId}] No saved login state for ${effectiveCreds.id} — will log in fresh`);
        }
      }

      const maxPosts = Math.max(
        1,
        body.maxPosts ??
          (parseInt(process.env.SCRAPER_MAX_POSTS ?? '8', 10) || 8),
      );

      // Single tab — simpler, faster in practice for the Gemini loop
      const slices = planTabSlices(maxPosts, maxPosts, maxPosts, 1);
      console.log(`[session ${sessionId}] 1 tab, ${maxPosts} posts target`);
      browserSession = await launchBrowser(storageStatePath, 1);

      // Wire screencast → live WS clients
      const { cdp, pages } = browserSession;
      const liveSet = liveClients.get(sessionId)!;

      // Proxy screencast frames to all connected live clients
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 55,
        maxWidth: 1280,
        maxHeight: 800,
        everyNthFrame: 3,
      });
      cdp.on(
        'Page.screencastFrame',
        async ({
          data,
          sessionId: frameId,
        }: {
          data: string;
          sessionId: number;
        }) => {
          session.lastActiveAt = Date.now();
          const msg = JSON.stringify({ type: 'frame', data });
          for (const ws of liveSet) {
            if (ws.readyState === WebSocket.OPEN) ws.send(msg);
          }
          await cdp
            .send('Page.screencastFrameAck', { sessionId: frameId })
            .catch(() => {});
        },
      );

      // Multi-cast events WS
      const eventsSet = eventClients.get(sessionId)!;
      const broadcastWs = {
        readyState: WebSocket.OPEN,
        send: (data: string) => {
          session.lastActiveAt = Date.now();
          for (const ws of eventsSet) {
            if (ws.readyState === WebSocket.OPEN) ws.send(data);
          }
        },
      } as unknown as WebSocket;

      const result = await runAgent(
        pages,
        body.url,
        broadcastWs,
        abortController.signal,
        credentials,
        slices,
      );

      // Always persist refreshed cookies so the next run skips login
      if (effectiveCreds) {
        try {
          const state = await browserSession.context.storageState();
          const stateStr = JSON.stringify(state);
          saveStorageState(effectiveCreds.id, stateStr);
          console.log(`[session ${sessionId}] Saved login state for ${effectiveCreds.id}`);
          // Also push back to Laravel DB if a push URL was provided (DB-sourced credentials)
          if (body.storageStatePushUrl) {
            const { pushStorageState } = await import('./storage.js');
            await pushStorageState(body.storageStatePushUrl, effectiveCreds.id, stateStr).catch(() => {});
          }
        } catch {
          // non-fatal — scrape result is still valid
        }
      }

      session.status = 'done';
      console.log(`[session ${sessionId}] done — ${result.posts.length} posts`);
    } catch (err: unknown) {
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
          if (ws.readyState === WebSocket.OPEN) ws.send(payload);
        }
      }
      if (!isCancelled) console.error(`[session ${sessionId}] error: ${msg}`);
    } finally {
      if (browserSession) await browserSession.close();
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
app.post('/sessions/:id/cancel', (req: Request, res: Response): void => {
  if (!checkSecret(req, res)) return;
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
app.get('/sessions/:id', (req: Request, res: Response): void => {
  if (!checkSecret(req, res)) return;
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
const server = http.createServer(app);

// No path filter here — the connection handler below routes by URL itself.
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
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
    if (
      (session.status === 'running' || session.status === 'starting') &&
      now - session.lastActiveAt > SESSION_IDLE_TTL_MS
    ) {
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
