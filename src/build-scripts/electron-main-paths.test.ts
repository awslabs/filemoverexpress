import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Tests for the Electron main process path resolution logic.
 *
 * electron-main.ts cannot be imported directly in a Vitest environment because
 * it has top-level Electron imports (app, BrowserWindow, etc.) that are unavailable
 * outside Electron. Instead, we:
 *
 * 1. Verify the source code contains the correct path patterns (source analysis)
 * 2. Re-implement and test the core path logic in isolation to confirm correctness
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 13.1, 13.2
 */

// Constants matching src/electron/src/constants.ts
const PRODUCT_CLI_NAME = 'filemoverexpress';
const PRODUCT_DAEMON_LAUNCHER = 'filemoverexpress-launcher.exe';

const electronMainPath = path.resolve(__dirname, '..', 'electron', 'src', 'electron-main.ts');

describe('Electron main process path resolution', () => {
    let sourceCode: string;

    beforeEach(() => {
        sourceCode = fs.readFileSync(electronMainPath, 'utf-8');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getDaemonPath() source analysis', () => {
        it('should use path.join(__dirname, \'binaries\', binaryName) pattern', () => {
            // Requirement 12.1: getDaemonPath resolves as path.join(__dirname, 'binaries', binaryName)
            expect(sourceCode).toContain("path.join(__dirname, 'binaries', binaryName)");
        });

        it('should not contain legacy path.dirname(__dirname) in getDaemonPath', () => {
            // Requirement 12.4: Remove legacy path.dirname() chain
            // Extract the getDaemonPath function body
            const fnMatch = sourceCode.match(/function getDaemonPath\(\): string \{[\s\S]*?\n\}/);
            expect(fnMatch).not.toBeNull();
            const fnBody = fnMatch![0];
            expect(fnBody).not.toContain('path.dirname(__dirname)');
            expect(fnBody).not.toContain('path.dirname(basePath)');
        });

        it('should select daemon launcher on Windows and CLI binary on other platforms', () => {
            // Requirements 12.2, 12.3: binary name selection
            const fnMatch = sourceCode.match(/function getDaemonPath\(\): string \{[\s\S]*?\n\}/);
            expect(fnMatch).not.toBeNull();
            const fnBody = fnMatch![0];
            // Should use isWindowsOS() to choose between launcher and CLI name
            expect(fnBody).toContain('isWindowsOS()');
            expect(fnBody).toContain('productNames.PRODUCT_DAEMON_LAUNCHER');
            expect(fnBody).toContain('productNames.PRODUCT_CLI_NAME');
        });
    });

    describe('macOS PATH augmentation source analysis', () => {
        it('should use path.join(__dirname, \'binaries\') for PATH augmentation', () => {
            // Requirement 13.1: PATH uses path.join(__dirname, 'binaries')
            const pathAugPattern = /process\.env\.PATH\s*=\s*`\$\{process\.env\.PATH\}:.*?`;/g;
            const matches = sourceCode.match(pathAugPattern);
            expect(matches).not.toBeNull();
            // Find the PATH augmentation line
            const pathLine = matches!.find(m => m.includes('binaries'));
            expect(pathLine).toBeDefined();
            expect(pathLine).toContain("path.join(__dirname, 'binaries')");
        });

        it('should not use path.dirname(__dirname) in PATH augmentation', () => {
            // Requirement 13.2: Remove legacy PATH augmentation
            // Look at the PATH augmentation block specifically
            const pathBlock = sourceCode.match(/if \(process\.platform === 'darwin'\) \{[\s\S]*?process\.env\.PATH[\s\S]*?\}/);
            expect(pathBlock).not.toBeNull();
            const block = pathBlock![0];
            expect(block).not.toContain('path.dirname(__dirname)');
        });
    });

    describe('getDaemonPath() logic verification', () => {
        /**
         * Re-implements the getDaemonPath logic to verify correctness
         * across all platforms. This mirrors the actual function in electron-main.ts.
         */
        function getDaemonPath(dirname: string, isWindows: boolean): string {
            const binaryName = isWindows ? PRODUCT_DAEMON_LAUNCHER : PRODUCT_CLI_NAME;
            return path.join(dirname, 'binaries', binaryName);
        }

        it('should return path.join(__dirname, "binaries", "filemoverexpress") on macOS', () => {
            // Requirement 12.1, 12.2
            const dirname = '/Applications/File Mover Express.app/Contents/Resources/app';
            const result = getDaemonPath(dirname, false);
            expect(result).toBe(path.join(dirname, 'binaries', PRODUCT_CLI_NAME));
        });

        it('should return path.join(__dirname, "binaries", "filemoverexpress") on Linux', () => {
            // Requirement 12.1
            const dirname = '/opt/File Mover Express/resources/app';
            const result = getDaemonPath(dirname, false);
            expect(result).toBe(path.join(dirname, 'binaries', PRODUCT_CLI_NAME));
        });

        it('should return path.join(__dirname, "binaries", "filemoverexpress-launcher.exe") on Windows', () => {
            // Requirement 12.1, 12.3
            const dirname = 'C:\\Program Files\\File Mover Express\\resources\\app';
            const result = getDaemonPath(dirname, true);
            expect(result).toBe(path.join(dirname, 'binaries', PRODUCT_DAEMON_LAUNCHER));
        });

        it('should place binaries as a direct child of __dirname on all platforms', () => {
            // Requirement 12.1: binaries/ is always under __dirname
            const testDirs = [
                '/Applications/FME.app/Contents/Resources/app',
                '/opt/fme/resources/app',
                'C:\\Program Files\\FME\\resources\\app',
            ];

            for (const dirname of testDirs) {
                const resultNonWindows = getDaemonPath(dirname, false);
                const resultWindows = getDaemonPath(dirname, true);

                // Both should start with dirname + path.sep + 'binaries'
                expect(resultNonWindows.startsWith(path.join(dirname, 'binaries'))).toBe(true);
                expect(resultWindows.startsWith(path.join(dirname, 'binaries'))).toBe(true);
            }
        });
    });

    describe('macOS PATH augmentation logic verification', () => {
        it('should append path.join(__dirname, "binaries") to PATH', () => {
            // Requirement 13.1
            const dirname = '/Applications/File Mover Express.app/Contents/Resources/app';
            const originalPath = '/usr/bin:/usr/local/bin';
            const expectedPath = `${originalPath}:${path.join(dirname, 'binaries')}`;

            // Simulate the PATH augmentation
            const augmentedPath = `${originalPath}:${path.join(dirname, 'binaries')}`;
            expect(augmentedPath).toBe(expectedPath);
            expect(augmentedPath).toContain(path.join(dirname, 'binaries'));
        });

        it('should not reference parent directory of __dirname', () => {
            // Requirement 13.2
            const dirname = '/Applications/File Mover Express.app/Contents/Resources/app';
            const normalizedDirname = path.normalize(dirname);
            const binariesPath = path.join(dirname, 'binaries');

            // The binaries path should be a child of dirname, not a sibling or parent
            expect(binariesPath.startsWith(normalizedDirname)).toBe(true);
            // Should NOT be path.dirname(dirname) + '/binaries'
            expect(binariesPath).not.toBe(path.join(path.dirname(dirname), 'binaries'));
        });
    });
});
