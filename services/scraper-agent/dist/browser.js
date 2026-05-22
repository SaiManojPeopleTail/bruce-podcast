"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchBrowser = launchBrowser;
exports.startScreencast = startScreencast;
exports.stopScreencast = stopScreencast;
const playwright_1 = require("playwright");
const ws_1 = __importDefault(require("ws"));
/**
 * Launch a Chromium browser context suitable for social-media scraping.
 * Passes the DISPLAY env var so it works under Xvfb on headless Linux.
 * On dev macOS it runs headed (or headless if HEADLESS=true).
 *
 * @param tabCount — number of tabs (pages) to open; all share storage state.
 */
async function launchBrowser(storageStatePath, tabCount = 1) {
    const headless = process.env.HEADLESS === 'true' || process.platform === 'linux';
    const browser = await playwright_1.chromium.launch({
        headless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1280,800',
        ],
        env: process.env.DISPLAY
            ? { DISPLAY: process.env.DISPLAY }
            : undefined,
    });
    const contextOptions = {
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        // Mask automation signals
        javaScriptEnabled: true,
    };
    if (storageStatePath) {
        contextOptions.storageState = storageStatePath;
    }
    const context = await browser.newContext(contextOptions);
    // Mask navigator.webdriver
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    const n = Math.max(1, Math.floor(tabCount));
    const pages = [];
    for (let i = 0; i < n; i++) {
        pages.push(await context.newPage());
    }
    const page = pages[0];
    const cdp = await context.newCDPSession(page);
    const close = async () => {
        try {
            await browser.close();
        }
        catch {
            // already closed
        }
    };
    return { browser, context, pages, page, cdp, close };
}
/**
 * Start CDP screencast and relay JPEG frames to the given WebSocket.
 * Frames are sent as JSON `{ type: "frame", data: "<base64 JPEG>" }`.
 */
async function startScreencast(cdp, ws) {
    await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 55,
        maxWidth: 1280,
        maxHeight: 800,
        everyNthFrame: 3,
    });
    cdp.on('Page.screencastFrame', async ({ data, sessionId: frameId, }) => {
        if (ws.readyState === ws_1.default.OPEN) {
            ws.send(JSON.stringify({ type: 'frame', data }));
        }
        await cdp.send('Page.screencastFrameAck', { sessionId: frameId });
    });
}
async function stopScreencast(cdp) {
    try {
        await cdp.send('Page.stopScreencast');
    }
    catch {
        // session may already be closed
    }
}
//# sourceMappingURL=browser.js.map