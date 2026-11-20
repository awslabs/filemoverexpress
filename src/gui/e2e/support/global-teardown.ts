import { existsSync, readFileSync } from 'node:fs';

import { State, STATE_FILE } from './environment';
import { removeState } from './global-setup';

const STOP_TIMEOUT_MS = 20_000;

/**
 * Stops the desktop app, then the backend. SIGTERM lets the backend shut the daemon down through
 * its API and stop the emulator, which deletes the work directory.
 */
export default async function globalTeardown(): Promise<void> {
    if (!existsSync(STATE_FILE)) {
        return;
    }
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State;
    for (const pid of state.pids) {
        await stop(pid);
    }
    removeState();
}

async function stop(pid: number): Promise<void> {
    if (!alive(pid)) {
        return;
    }
    process.kill(pid, 'SIGTERM');
    const deadline = Date.now() + STOP_TIMEOUT_MS;
    while (Date.now() < deadline && alive(pid)) {
        await new Promise((r) => setTimeout(r, 200));
    }
    if (alive(pid)) {
        process.kill(pid, 'SIGKILL');
    }
}

function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}
