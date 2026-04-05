import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {toPosix} from './normalize-path';

/**
 * Options for creating a temporary directory.
 *
 * @example
 * ```typescript
 * const options: TempDirOptions = {
 *   prefix: 'my-build-'
 * };
 * ```
 */
export interface TempDirOptions {
    /**
     * Optional prefix for the directory name (e.g., "build-", "test-").
     * If not provided, defaults to 'fme-tmp-'.
     * The prefix is prepended to a unique 6-character random string.
     *
     * @example "build-" results in directories like "build-a1b2c3"
     */
    prefix?: string;
}

/**
 * Options for withTempDir including cleanup control.
 * Extends TempDirOptions with additional lifecycle management options.
 *
 * @example
 * ```typescript
 * const options: WithTempDirOptions = {
 *   prefix: 'debug-',
 *   noCleanOnExit: true  // Keep directory for inspection
 * };
 * ```
 */
export interface WithTempDirOptions extends TempDirOptions {
    /**
     * If true, skip cleanup and retain directory for debugging.
     * Useful when you need to inspect the temporary directory contents after execution.
     *
     * @default false
     * @example
     * ```typescript
     * // Directory will be preserved after callback completes
     * manager.withTempDir((dir) => {
     *   // ... operations ...
     * }, { noCleanOnExit: true });
     * ```
     */
    noCleanOnExit?: boolean;
}

/**
 * TempDirManager provides safe, cross-platform temporary directory management.
 *
 * This utility class handles OS-specific temporary directory locations, atomic directory
 * creation with unique names, and automatic cleanup to prevent resource leaks during
 * build operations.
 *
 * Key features:
 * - Cross-platform support (Windows, macOS, Linux)
 * - Atomic directory creation (no race conditions)
 * - Automatic cleanup with error handling
 * - Customizable directory prefixes
 * - Optional cleanup skip for debugging
 *
 * @example Basic usage with automatic cleanup
 * ```typescript
 * const manager = new TempDirManager();
 *
 * manager.withTempDir((tempDir) => {
 *   // Use tempDir for build operations
 *   console.log(`Working in: ${tempDir}`);
 *   // Directory is automatically cleaned up after this callback
 * });
 * ```
 *
 * @example Manual directory creation
 * ```typescript
 * const manager = new TempDirManager();
 * const tempDir = manager.createTempDir({ prefix: 'build-' });
 * try {
 *   // Use tempDir...
 * } finally {
 *   // Manual cleanup required
 *   fs.rmSync(tempDir, { recursive: true, force: true });
 * }
 * ```
 *
 * @example Preserving directory for debugging
 * ```typescript
 * const manager = new TempDirManager();
 *
 * manager.withTempDir((tempDir) => {
 *   // Operations that might need inspection
 *   console.log(`Debug directory: ${tempDir}`);
 * }, { noCleanOnExit: true });
 * // Directory remains for manual inspection
 * ```
 */
export class TempDirManager {
    /**
     * Creates a temporary directory with optional prefix.
     *
     * Uses Node.js `fs.mkdtempSync()` for atomic creation, ensuring uniqueness
     * and preventing race conditions. The directory is created in the OS-specific
     * temporary location (e.g., /tmp on Unix, %TEMP% on Windows).
     *
     * @param options - Configuration for directory creation
     * @param options.prefix - Optional prefix for the directory name (default: 'fme-tmp-')
     * @returns Absolute path to the created directory
     * @throws {Error} If directory creation fails due to permissions (EACCES)
     * @throws {Error} If directory creation fails due to disk space (ENOSPC)
     * @throws {Error} If directory creation fails for any other reason
     *
     * @example Create with default prefix
     * ```typescript
     * const manager = new TempDirManager();
     * const tempDir = manager.createTempDir();
     * // Returns: /tmp/fme-tmp-a1b2c3 (on Unix)
     * ```
     *
     * @example Create with custom prefix
     * ```typescript
     * const manager = new TempDirManager();
     * const tempDir = manager.createTempDir({ prefix: 'build-' });
     * // Returns: /tmp/build-x9y8z7 (on Unix)
     * ```
     *
     * @example Error handling
     * ```typescript
     * const manager = new TempDirManager();
     * try {
     *   const tempDir = manager.createTempDir();
     * } catch (error) {
     *   console.error('Failed to create temp directory:', error.message);
     * }
     * ```
     */
    public createTempDir(options?: TempDirOptions): string {
        const tmpdir = os.tmpdir();
        const prefix = options?.prefix || 'fme-tmp-';
        const tempPath = toPosix(path.join(tmpdir, prefix));

        try {
            return fs.mkdtempSync(tempPath);
        } catch (error: any) {
            // Handle specific error codes with descriptive messages
            if (error.code === 'EACCES') {
                throw new Error(
                    `Failed to create temporary directory at ${tempPath}: Permission denied. ` +
                    `Check that you have write access to the temporary directory.`,
                );
            } else if (error.code === 'ENOSPC') {
                throw new Error(
                    `Failed to create temporary directory at ${tempPath}: No space left on device. ` +
                    `Free up disk space and try again.`,
                );
            } else {
                // Generic error with context
                throw new Error(
                    `Failed to create temporary directory at ${tempPath}: ${error.message}`,
                );
            }
        }
    }

    /**
     * Creates a temporary directory, executes a callback, then cleans up automatically.
     *
     * This is the recommended way to use temporary directories as it ensures cleanup
     * happens even if the callback throws an error. The directory is created using
     * `createTempDir()`, the callback is executed with the directory path, and then
     * the directory is recursively removed (unless `noCleanOnExit` is true).
     *
     * Cleanup behavior:
     * - If callback succeeds: Directory is removed after callback returns
     * - If callback throws: Directory is removed, then error is re-thrown
     * - If noCleanOnExit is true: Directory is preserved regardless of outcome
     *
     * @param callbackFn - Function to execute with temp directory path
     * @param options - Configuration including cleanup behavior
     * @param options.prefix - Optional prefix for the directory name (default: 'fme-tmp-')
     * @param options.noCleanOnExit - If true, skip cleanup and retain directory (default: false)
     * @throws {Error} If directory creation fails
     * @throws {Error} If cleanup fails (permissions, files in use)
     * @throws {Error} Re-throws any error thrown by the callback (after cleanup attempt)
     *
     * @example Basic usage with automatic cleanup
     * ```typescript
     * const manager = new TempDirManager();
     *
     * manager.withTempDir((tempDir) => {
     *   // Create files in tempDir
     *   fs.writeFileSync(path.join(tempDir, 'output.txt'), 'data');
     *   // Directory is automatically cleaned up after this
     * });
     * ```
     *
     * @example With custom prefix
     * ```typescript
     * const manager = new TempDirManager();
     *
     * manager.withTempDir((tempDir) => {
     *   console.log(`Build directory: ${tempDir}`);
     *   // Perform build operations...
     * }, { prefix: 'build-' });
     * ```
     *
     * @example Preserving directory for debugging
     * ```typescript
     * const manager = new TempDirManager();
     *
     * manager.withTempDir((tempDir) => {
     *   // Operations that might need inspection
     *   fs.writeFileSync(path.join(tempDir, 'debug.log'), 'info');
     * }, { noCleanOnExit: true });
     *
     * // Directory remains at the logged path for manual inspection
     * ```
     *
     * @example Error handling - callback errors are re-thrown
     * ```typescript
     * const manager = new TempDirManager();
     *
     * try {
     *   manager.withTempDir((tempDir) => {
     *     throw new Error('Build failed');
     *   });
     * } catch (error) {
     *   console.error('Caught error:', error.message);
     *   // Directory was still cleaned up before error was re-thrown
     * }
     * ```
     *
     * @example Creating nested directories and files
     * ```typescript
     * const manager = new TempDirManager();
     *
     * manager.withTempDir((tempDir) => {
     *   const subDir = path.join(tempDir, 'nested', 'deep');
     *   fs.mkdirSync(subDir, { recursive: true });
     *   fs.writeFileSync(path.join(subDir, 'file.txt'), 'content');
     *   // All nested content is cleaned up automatically
     * });
     * ```
     */
    public withTempDir(
        callbackFn: (tempFolderPath: string) => void,
        options?: WithTempDirOptions,
    ): void {
        const tempDir = this.createTempDir(options);
        let callbackError: Error | undefined;

        try {
            callbackFn(tempDir);
        } catch (error: any) {
            // Capture callback error to re-throw after cleanup
            callbackError = error;
        } finally {
            if (!options?.noCleanOnExit) {
                try {
                    fs.rmSync(tempDir, {recursive: true, force: true});
                } catch (error: any) {
                    // Handle specific cleanup error codes
                    if (error.code === 'EBUSY') {
                        const cleanupError = new Error(
                            `Failed to cleanup temporary directory at ${tempDir}: Directory or files are in use. ` +
                            `Close any programs using these files and try again.`,
                        );
                        // If callback also threw, preserve callback error as primary
                        if (callbackError) {
                            throw callbackError;
                        }
                        throw cleanupError;
                    } else if (error.code === 'EACCES') {
                        const cleanupError = new Error(
                            `Failed to cleanup temporary directory at ${tempDir}: Permission denied. ` +
                            `Check that you have write access to remove the directory.`,
                        );
                        // If callback also threw, preserve callback error as primary
                        if (callbackError) {
                            throw callbackError;
                        }
                        throw cleanupError;
                    } else {
                        // Generic cleanup error with context
                        const cleanupError = new Error(
                            `Failed to cleanup temporary directory at ${tempDir}: ${error.message}`,
                        );
                        // If callback also threw, preserve callback error as primary
                        if (callbackError) {
                            throw callbackError;
                        }
                        throw cleanupError;
                    }
                }
            }

            // Re-throw callback error if it occurred
            if (callbackError) {
                throw callbackError;
            }
        }
    }
}
