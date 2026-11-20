import { defineConfig, devices } from '@playwright/test';

import { GUI_PORT } from './support/environment';

/**
 * Browser tests of the GUI against a real backend: the desktop app's web ("server") build, the
 * real daemon, and AWS Emulator. global-setup.ts starts all three; see README.md.
 */
export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.e2e.ts',
    outputDir: './test-results',
    // One daemon on a fixed port backs every test, so tests share state and run one at a time.
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env['CI'],
    retries: process.env['CI'] ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: process.env['CI']
        ? [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]]
        : [['list']],
    globalSetup: './support/global-setup.ts',
    globalTeardown: './support/global-teardown.ts',
    use: {
        baseURL: `http://127.0.0.1:${GUI_PORT}`,
        viewport: { width: 1500, height: 950 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1500, height: 950 } } }],
});
