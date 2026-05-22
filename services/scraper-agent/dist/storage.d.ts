import { Credentials } from './types.js';
/**
 * Fetch credentials for a given credential ID by calling the
 * Laravel-provided one-shot signed URL. The caller is responsible
 * for building that URL; here we just fetch it.
 */
export declare function fetchCredentials(signedUrl: string): Promise<Credentials>;
/**
 * Load cached Playwright storageState (cookies + localStorage) for a
 * credential ID. Returns undefined if none cached yet.
 */
export declare function loadStorageState(credentialsId: string): string | undefined;
/**
 * Persist storageState after a successful session so the next run
 * can skip the login flow.
 */
export declare function saveStorageState(credentialsId: string, state: string): void;
/**
 * Push the refreshed storageState back to Laravel so it can persist
 * it in the encrypted DB column.
 */
export declare function pushStorageState(pushUrl: string, credentialsId: string, state: string): Promise<void>;
