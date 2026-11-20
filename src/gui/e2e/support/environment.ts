import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Port of the desktop app's web build. Must match E2E_GUI_PORT seen by the backend. */
export const GUI_PORT = Number(process.env['E2E_GUI_PORT'] ?? 8080);

/** Where global-setup records the running backend for the tests and for teardown. */
export const STATE_FILE = process.env['E2E_STATE_FILE'] ?? join(tmpdir(), 'fme-gui-e2e-state.json');

/** What the backend reports once it is ready (printed by TestServeEnvironment in src/cli/e2e). */
export interface ServeInfo {
    workDir: string;
    /** HOME of the daemon; the desktop app runs with the same HOME so it reuses that daemon. */
    home: string;
    /** Local folder holding the files the tests upload. */
    filesDir: string;
    bucket: string;
    endpoint: string;
    profile: string;
}

export interface State {
    info: ServeInfo;
    pids: number[];
}

/** The running backend, for use inside tests. */
export function environment(): ServeInfo {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State;
    return state.info;
}

/** Objects seeded in the bucket by the backend (keep in sync with src/cli/e2e/serve_test.go). */
export const SEEDED = {
    folder: 'seed',
    file: 'readme.txt',
    nestedFolder: 'nested',
    nestedFiles: ['data.txt', 'other.txt'],
};

/** Files created in ServeInfo.filesDir (keep in sync with src/cli/e2e/serve_test.go). */
export const LOCAL = {
    file: 'upload-me.txt',
    folder: 'folder',
};
