import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {ElectronBuilder} from './electron-builder';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
    rm: vi.fn(),
}));

vi.mock('../utils/command-runner', () => ({
    CommandRunner: {
        run: vi.fn(),
    },
}));

vi.mock('../utils/logger', () => ({
    Logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock('../utils/path-resolver', () => ({
    PathResolver: {
        getProjectRoot: vi.fn(() => '/mock/project/root'),
        getElectronDir: vi.fn(() => '/mock/project/root/src/electron'),
    },
}));

describe('ElectronBuilder', () => {
    beforeEach(async () => {
        // Reset all mocks before each test
        const {rm} = await import('node:fs/promises');
        const {CommandRunner} = await import('../utils/command-runner');
        const {Logger} = await import('../utils/logger');

        vi.mocked(rm).mockReset();
        vi.mocked(CommandRunner.run).mockReset();
        vi.mocked(Logger.debug).mockReset();
        vi.mocked(Logger.error).mockReset();
        vi.mocked(Logger.warn).mockReset();
        vi.mocked(Logger.success).mockReset();

        // Mock git ls-files to return empty (no tracked files) by default
        vi.mocked(CommandRunner.run).mockResolvedValue({
            exitCode: 0,
            stdout: '',
            stderr: '',
        });

        // Mock rm to succeed by default
        vi.mocked(rm).mockResolvedValue(undefined);
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('build', () => {
        describe('successful builds', () => {
            it('should execute npm run build in electron directory', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ElectronBuilder();

                // Mock git ls-files (from clean) and npm run build
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: 'Build successful',
                        stderr: '',
                    });

                // Act
                await builder.build();

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'npm',
                    ['run', 'build'],
                    expect.objectContaining({
                        cwd: '/mock/project/root/src/electron',
                    }),
                );
            });

            it('should log success message after successful build', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ElectronBuilder();

                // Mock git ls-files and npm run build
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    });

                // Act
                await builder.build();

                // Assert
                expect(Logger.success).toHaveBeenCalledWith(
                    expect.stringContaining('Electron application code built'),
                );
            });

            it('should use correct working directory', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {PathResolver} = await import('../utils/path-resolver');

                const builder = new ElectronBuilder();

                // Mock git ls-files and npm run build
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    });

                // Act
                await builder.build();

                // Assert
                expect(PathResolver.getElectronDir).toHaveBeenCalled();
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'npm',
                    ['run', 'build'],
                    expect.objectContaining({
                        cwd: '/mock/project/root/src/electron',
                    }),
                );
            });

            it('should handle build with stdout output', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ElectronBuilder();

                // Mock git ls-files and npm run build
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: 'Compiling TypeScript files...\nBuild completed successfully',
                        stderr: '',
                    });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should handle build with warnings in stderr', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ElectronBuilder();

                // Mock git ls-files and npm run build
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: 'Build successful',
                        stderr: 'Warning: Deprecated API usage',
                    });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });
        });

        describe('error handling', () => {
            it('should log error when build command fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ElectronBuilder();

                const buildError = new Error('Command execution failed');
                // Mock git ls-files success, npm run build failure
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockRejectedValueOnce(buildError);

                // Act
                await builder.build();

                // Assert - error is logged but not thrown
                expect(Logger.error).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to compile Electron application code'),
                    buildError,
                );
            });

            it('should log error message when build fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ElectronBuilder();

                const buildError = new Error('Build failed');
                // Mock git ls-files success, npm run build failure
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockRejectedValueOnce(buildError);

                // Act
                await builder.build();

                // Assert
                expect(Logger.error).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to compile Electron application code'),
                    buildError,
                );
            });

            it('should log original error when build fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ElectronBuilder();

                const originalError = new Error('TypeScript compilation error');
                // Mock git ls-files success, npm run build failure
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockRejectedValueOnce(originalError);

                // Act
                await builder.build();

                // Assert
                expect(Logger.error).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to compile Electron application code'),
                    originalError,
                );
            });

            it('should log command not found error', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ElectronBuilder();

                const cmdError = new Error('npm: command not found');
                // Mock git ls-files success, npm command not found
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockRejectedValueOnce(cmdError);

                // Act
                await builder.build();

                // Assert
                expect(Logger.error).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to compile Electron application code'),
                    cmdError,
                );
            });

            it('should log permission denied error', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ElectronBuilder();

                const permissionError = new Error('EACCES: permission denied');
                // Mock git ls-files success, npm run build permission error
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockRejectedValueOnce(permissionError);

                // Act
                await builder.build();

                // Assert
                expect(Logger.error).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to compile Electron application code'),
                    permissionError,
                );
            });

            it('should log network errors during npm install', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ElectronBuilder();

                const networkError = new Error('ENOTFOUND: network error');
                // Mock git ls-files success, npm run build network error
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockRejectedValueOnce(networkError);

                // Act
                await builder.build();

                // Assert
                expect(Logger.error).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to compile Electron application code'),
                    networkError,
                );
            });

            it('should throw error when clean fails', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');

                const builder = new ElectronBuilder();

                // Mock rm to fail (clean will throw)
                vi.mocked(rm).mockRejectedValue(new Error('Permission denied'));

                // Act & Assert
                await expect(builder.build()).rejects.toThrow(
                    'Failed building Electron',
                );
            });
        });

        describe('edge cases', () => {
            it('should handle empty stdout from successful build', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ElectronBuilder();

                // Mock git ls-files and npm run build
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should handle large stdout from build', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ElectronBuilder();

                const largeOutput = 'Build output line\n'.repeat(1000);
                // Mock git ls-files and npm run build
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: largeOutput,
                        stderr: '',
                    });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should log special characters in error messages', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ElectronBuilder();

                const errorWithSpecialChars = new Error('Error: "module" not found at /path/to/file');
                // Mock git ls-files success, npm run build failure
                vi.mocked(CommandRunner.run)
                    .mockResolvedValueOnce({
                        exitCode: 0,
                        stdout: '',
                        stderr: '',
                    })
                    .mockRejectedValueOnce(errorWithSpecialChars);

                // Act
                await builder.build();

                // Assert - error is logged
                expect(Logger.error).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to compile Electron application code'),
                    errorWithSpecialChars,
                );
            });
        });
    });

    describe('cleanupPaths', () => {
        it('should return correct cleanup path for electron dist', () => {
            // Arrange
            const builder = new ElectronBuilder();

            // Act
            const paths = builder.cleanupPaths;

            // Assert
            expect(paths).toEqual(['/mock/project/root/src/electron/dist']);
        });

        it('should return array with single path', () => {
            // Arrange
            const builder = new ElectronBuilder();

            // Act
            const paths = builder.cleanupPaths;

            // Assert
            expect(Array.isArray(paths)).toBe(true);
            expect(paths).toHaveLength(1);
        });

        it('should use PathResolver to get electron directory', async () => {
            // Arrange
            const {PathResolver} = await import('../utils/path-resolver');
            const builder = new ElectronBuilder();

            // Act
            const paths = builder.cleanupPaths;

            // Assert
            expect(PathResolver.getElectronDir).toHaveBeenCalled();
            expect(paths[0]).toContain('/src/electron/dist');
        });
    });
});
