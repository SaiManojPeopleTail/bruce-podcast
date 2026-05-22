"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCredentials = fetchCredentials;
exports.loadStorageState = loadStorageState;
exports.saveStorageState = saveStorageState;
exports.pushStorageState = pushStorageState;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = process.env.STORAGE_DIR ?? path_1.default.join(process.cwd(), 'data');
function ensureDir() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
/**
 * Fetch credentials for a given credential ID by calling the
 * Laravel-provided one-shot signed URL. The caller is responsible
 * for building that URL; here we just fetch it.
 */
async function fetchCredentials(signedUrl) {
    const res = await fetch(signedUrl);
    if (!res.ok) {
        throw new Error(`Failed to fetch credentials (HTTP ${res.status})`);
    }
    return (await res.json());
}
/**
 * Load cached Playwright storageState (cookies + localStorage) for a
 * credential ID. Returns undefined if none cached yet.
 */
function loadStorageState(credentialsId) {
    ensureDir();
    const p = path_1.default.join(DATA_DIR, `state-${credentialsId}.json`);
    if (!fs_1.default.existsSync(p))
        return undefined;
    return fs_1.default.readFileSync(p, 'utf-8');
}
/**
 * Persist storageState after a successful session so the next run
 * can skip the login flow.
 */
function saveStorageState(credentialsId, state) {
    ensureDir();
    const p = path_1.default.join(DATA_DIR, `state-${credentialsId}.json`);
    fs_1.default.writeFileSync(p, state, 'utf-8');
}
/**
 * Push the refreshed storageState back to Laravel so it can persist
 * it in the encrypted DB column.
 */
async function pushStorageState(pushUrl, credentialsId, state) {
    const res = await fetch(pushUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialsId, storageState: state }),
    });
    if (!res.ok) {
        console.warn(`[storage] Failed to push storageState (HTTP ${res.status})`);
    }
}
//# sourceMappingURL=storage.js.map