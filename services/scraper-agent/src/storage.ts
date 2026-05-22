import fs from 'fs';
import path from 'path';
import { Credentials } from './types.js';

const DATA_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), 'data');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Fetch credentials for a given credential ID by calling the
 * Laravel-provided one-shot signed URL. The caller is responsible
 * for building that URL; here we just fetch it.
 */
export async function fetchCredentials(
  signedUrl: string,
): Promise<Credentials> {
  const res = await fetch(signedUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch credentials (HTTP ${res.status})`,
    );
  }
  return (await res.json()) as Credentials;
}

/**
 * Load cached Playwright storageState (cookies + localStorage) for a
 * credential ID. Returns undefined if none cached yet.
 */
export function loadStorageState(
  credentialsId: string,
): string | undefined {
  ensureDir();
  const p = path.join(DATA_DIR, `state-${credentialsId}.json`);
  if (!fs.existsSync(p)) return undefined;
  return fs.readFileSync(p, 'utf-8');
}

/**
 * Persist storageState after a successful session so the next run
 * can skip the login flow.
 */
export function saveStorageState(
  credentialsId: string,
  state: string,
): void {
  ensureDir();
  const p = path.join(DATA_DIR, `state-${credentialsId}.json`);
  fs.writeFileSync(p, state, 'utf-8');
}

/**
 * Push the refreshed storageState back to Laravel so it can persist
 * it in the encrypted DB column.
 */
export async function pushStorageState(
  pushUrl: string,
  credentialsId: string,
  state: string,
): Promise<void> {
  const res = await fetch(pushUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentialsId, storageState: state }),
  });
  if (!res.ok) {
    console.warn(
      `[storage] Failed to push storageState (HTTP ${res.status})`,
    );
  }
}
