import { Browser, BrowserContext, CDPSession, Page } from 'playwright';
import WebSocket from 'ws';
export interface BrowserSession {
    browser: Browser;
    context: BrowserContext;
    /** All tabs for this scrape (same context / cookies). */
    pages: Page[];
    /** First tab — used for CDP screencast (live preview). */
    page: Page;
    cdp: CDPSession;
    close: () => Promise<void>;
}
/**
 * Launch a Chromium browser context suitable for social-media scraping.
 * Passes the DISPLAY env var so it works under Xvfb on headless Linux.
 * On dev macOS it runs headed (or headless if HEADLESS=true).
 *
 * @param tabCount — number of tabs (pages) to open; all share storage state.
 */
export declare function launchBrowser(storageStatePath?: string, tabCount?: number): Promise<BrowserSession>;
/**
 * Start CDP screencast and relay JPEG frames to the given WebSocket.
 * Frames are sent as JSON `{ type: "frame", data: "<base64 JPEG>" }`.
 */
export declare function startScreencast(cdp: CDPSession, ws: WebSocket): Promise<void>;
export declare function stopScreencast(cdp: CDPSession): Promise<void>;
