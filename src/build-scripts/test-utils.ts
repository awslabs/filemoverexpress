import {vi} from 'vitest';
import {BuildOptions} from './types/build-target';
import {Architecture, Platform, PlatformConfig} from './types/platform';

/**
 * Options for creating a mock child process
 */
export interface MockChildProcessOptions {
    exitCode: number;
    stdout?: string;
    stderr?: string;
    shouldError?: boolean;
    signal?: NodeJS.Signals | null;
}

/**
 * Creates a mock child process that can be controlled in tests
 *
 * This mock simulates the behavior of Node.js child_process.spawn(),
 * allowing tests to control the output, exit code, and error conditions
 * without actually spawning real processes.
 *
 * @param options Configuration for the mock process behavior
 * @returns A mock child process object compatible with ChildProcess interface
 */
export function createMockChildProcess(options: MockChildProcessOptions) {
    const mockProcess = {
        stdout: {
            on: vi.fn((event: string, handler: (data: Buffer) => void) => {
                if (event === 'data' && options.stdout) {
                    handler(Buffer.from(options.stdout));
                }
                return mockProcess.stdout;
            }),
            pipe: vi.fn(),
        },
        stderr: {
            on: vi.fn((event: string, handler: (data: Buffer) => void) => {
                if (event === 'data' && options.stderr) {
                    handler(Buffer.from(options.stderr));
                }
                return mockProcess.stderr;
            }),
            pipe: vi.fn(),
        },
        on: vi.fn((event: string, handler: (code: number | null, signal?: NodeJS.Signals | null) => void) => {
            if (event === 'close') {
                handler(options.exitCode, options.signal || null);
            }
            if (event === 'error' && options.shouldError) {
                handler(new Error('Command failed') as any);
            }
            return mockProcess;
        }),
        kill: vi.fn(),
        pid: 12345,
    };

    return mockProcess;
}

/**
 * Creates a mock file system with controlled behavior
 *
 * This provides mocks for all common fs/promises operations,
 * allowing tests to simulate file system interactions without
 * touching the actual file system.
 *
 * @returns An object with mocked fs/promises methods
 */
export function createMockFS() {
    return {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
        rm: vi.fn(),
        access: vi.fn(),
        stat: vi.fn(),
        readdir: vi.fn(),
        copyFile: vi.fn(),
        symlink: vi.fn(),
        readlink: vi.fn(),
        lstat: vi.fn(),
        chmod: vi.fn(),
        chown: vi.fn(),
        unlink: vi.fn(),
        rmdir: vi.fn(),
        rename: vi.fn(),
    };
}

/**
 * Restores all mocks and environment variables
 *
 * This should be called in afterEach hooks to ensure test isolation
 * and prevent mock state from leaking between tests.
 */
export function cleanupMocks() {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
}

/**
 * Generates a random platform configuration
 *
 * Useful for property-based testing where we want to test
 * behavior across all platform/architecture combinations.
 *
 * @returns A random PlatformConfig with valid platform and architecture
 */
export function generatePlatformConfig(): PlatformConfig {
    const platforms = [Platform.Darwin, Platform.Linux, Platform.Windows];
    const archs = [Architecture.X64, Architecture.ARM64];

    return {
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        arch: archs[Math.floor(Math.random() * archs.length)],
    };
}

/**
 * Generates random build options
 *
 * Useful for property-based testing where we want to test
 * build behavior with various option combinations.
 *
 * @returns Random BuildOptions with valid values
 */
export function generateBuildOptions(): BuildOptions {
    const numPlatforms = Math.floor(Math.random() * 3) + 1; // 1-3 platforms
    const numArchs = Math.floor(Math.random() * 2) + 1; // 1-2 architectures

    const allPlatforms = [Platform.Darwin, Platform.Linux, Platform.Windows];
    const allArchs = [Architecture.X64, Architecture.ARM64];

    // Shuffle and take random subset
    const platforms = allPlatforms
        .sort(() => Math.random() - 0.5)
        .slice(0, numPlatforms);

    const archs = allArchs
        .sort(() => Math.random() - 0.5)
        .slice(0, numArchs);

    return {
        platforms,
        archs,
        production: Math.random() > 0.5,
        verbose: Math.random() > 0.5,
    };
}
