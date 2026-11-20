import { ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { GUI_PORT, ServeInfo, State, STATE_FILE } from './environment';

const READY_MARKER = 'E2E_READY ';
const BACKEND_TIMEOUT_MS = 120_000;
const GUI_TIMEOUT_MS = 60_000;

/**
 * Binaries built by `task gui:e2e` (src/gui/Taskfile.yml). They can be overridden for a run.
 *  - E2E_BACKEND_BINARY: the compiled src/cli/e2e test binary (emulator + daemon + seed data)
 *  - E2E_APP_BINARY: the desktop app built with `-tags server` (serves the GUI over HTTP)
 */
const binDir = resolve(__dirname, '..', '.bin');
const backendBinary = process.env['E2E_BACKEND_BINARY'] ?? join(binDir, exe('e2e.test'));
const appBinary = process.env['E2E_APP_BINARY'] ?? join(binDir, exe('fme-server'));

function exe(name: string): string {
    return process.platform === 'win32' ? `${name}.exe` : name;
}

/** Starts the backend, then the desktop app's web build, and records both for the tests. */
export default async function globalSetup(): Promise<void> {
    for (const bin of [backendBinary, appBinary]) {
        if (!existsSync(bin)) {
            throw new Error(`${bin} is missing. Build it with: task gui:e2e:build`);
        }
    }

    // The backend deletes its work directory when it stops; it must be empty or new.
    const workDir = join(mkdtempSync(join(tmpdir(), 'fme-gui-e2e-')), 'work');
    const backendArgs = [
        '-test.run',
        '^TestServeEnvironment$',
        '-test.v',
        '-test.timeout',
        '0',
    ];
    const backend = start(backendBinary,
        backendArgs,
        {
            E2E_SERVE: '1',
            E2E_WORKDIR: workDir,
            E2E_GUI_PORT: String(GUI_PORT),
        },
        // The test binary builds the daemon from the module it lives in.
        resolve(__dirname, '..', '..', '..', 'cli', 'e2e'));
    const info = await waitForReady(backend);

    const app = start(appBinary, [], {
        HOME: info.home,
        USERPROFILE: info.home,
        WAILS_SERVER_HOST: '127.0.0.1',
        WAILS_SERVER_PORT: String(GUI_PORT),
    });
    await waitForHttp(`http://127.0.0.1:${GUI_PORT}/`, app);

    // Stop order matters: the app first, then the backend (which shuts the daemon down).
    const state: State = { info, pids: [app.pid!, backend.pid!] };
    writeFileSync(STATE_FILE, JSON.stringify(state));
}

function start(bin: string, args: string[], env: Record<string, string>, cwd?: string): ChildProcess {
    const child = spawn(bin, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: [
            'ignore',
            'pipe',
            'pipe',
        ],
    });
    // Keep the child's output visible when something goes wrong.
    child.stderr?.on('data', (d: Buffer) => process.stderr.write(`[${shortName(bin)}] ${d}`));
    child.unref();
    return child;
}

function shortName(bin: string): string {
    return bin.split(/[\\/]/).pop() ?? bin;
}

function waitForReady(child: ChildProcess): Promise<ServeInfo> {
    return new Promise((resolvePromise, reject) => {
        let output = '';
        const timer = setTimeout(() => fail(new Error(`backend not ready after ${BACKEND_TIMEOUT_MS} ms`)), BACKEND_TIMEOUT_MS);
        const fail = (err: Error): void => {
            clearTimeout(timer);
            child.kill();
            reject(new Error(`${err.message}\n--- backend output ---\n${output}`));
        };
        child.stdout?.on('data', (d: Buffer) => {
            output += d.toString();
            const line = output.split('\n').find((l) => l.startsWith(READY_MARKER));
            if (line) {
                clearTimeout(timer);
                resolvePromise(JSON.parse(line.slice(READY_MARKER.length)) as ServeInfo);
            }
        });
        child.once('exit', (code) => fail(new Error(`backend exited with code ${code}`)));
    });
}

async function waitForHttp(url: string, child: ChildProcess): Promise<void> {
    const deadline = Date.now() + GUI_TIMEOUT_MS;
    let exited = false;
    child.once('exit', () => (exited = true));
    while (Date.now() < deadline && !exited) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                return;
            }
        } catch {
            // not listening yet
        }
        await new Promise((r) => setTimeout(r, 250));
    }
    child.kill();
    throw new Error(exited ? 'the desktop app exited during start' : `${url} did not answer within ${GUI_TIMEOUT_MS} ms`);
}

/** Exported for global-teardown so an aborted setup still cleans up. */
export function removeState(): void {
    rmSync(STATE_FILE, { force: true });
}
