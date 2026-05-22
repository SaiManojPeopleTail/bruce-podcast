import WebSocket from 'ws';
import { Page } from 'playwright';
import { Credentials, ScrapeResult } from './types.js';
export interface WorkerSlice {
    postOffset: number;
    postLimit: number;
    workerIndex: number;
    workerTotal: number;
    totalTarget: number;
}
/** Plans post slices; each slice maps to one browser tab when parallel. */
export declare function planTabSlices(totalPosts: number, threshold: number, perWorker: number, maxTabs: number): WorkerSlice[];
/** @deprecated use planTabSlices — kept for older imports */
export declare function planWorkerSlices(totalPosts?: number): WorkerSlice[];
/**
 * Resolve credentials from the DB-supplied object OR fall back to env vars
 * based on the target URL's hostname.
 */
export declare function resolveCredentials(targetUrl: string, dbCredentials?: Credentials): Credentials | undefined;
export declare function runAgent(pages: Page[], targetUrl: string, eventsWs: WebSocket, signal: AbortSignal, credentials: Credentials | undefined, slices: WorkerSlice[]): Promise<ScrapeResult>;
