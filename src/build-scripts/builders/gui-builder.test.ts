import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {BuildOptions} from '../types/build-target';
import {GUIBuildConfig} from '../types/config';
import {Architecture, Platform} from '../types/platform';
import {GUIBuilder} from './gui-builder';

// Mock dependencies
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
        getGUIDir: vi.fn(() => '/mock/project/root/src/gui'),
    },
}));

describe('GUIBuilder', () => {
    let mockConfig: GUIBuildConfig;

    beforeEach(async () => {
        // Reset all mocks before each test
        const {CommandRunner} = await import('../utils/command-runner');
        const {Logger} = await import('../utils/logger');

        vi.mocked(CommandRunner.run).mockReset();
        vi.mocked(Logger.debug).mockReset();
        vi.mocked(Logger.error).mockReset();
        vi.mocked(Logger.warn).mockReset();
        vi.mocked(Logger.success).mockReset();

        // Default mock config
        mockConfig = {
            outputDir: 'dist/gui',
            sourceDir: 'src/gui',
            platforms: [
                {platform: Platform.Darwin, arch: Architecture.X64},
                {platform: Platform.Linux, arch: Architecture.X64},
                {platform: Platform.Windows, arch: Architecture.X64},
            ],
            angularConfig: {
                project: 'gui',
                configuration: 'production',
                outputPath: 'dist/gui',
                baseHref: './',
            },
            electronConfig: {
                appName: 'FileMoverExpress',
                appBundleId: 'com.example.filemoverexpress',
                helperBundleId: 'com.example.filemoverexpress.helper',
                iconPaths: {
                    [Platform.Darwin]: 'assets/icon.icns',
                    [Platform.Linux]: 'assets/icon.png',
                    [Platform.Windows]: 'assets/icon.ico',
                },
                packagerOptions: {
                    overwrite: true,
                    prune: true,
                    asar: true,
                },
            },
        };
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('build', () => {
        describe('successful builds', () => {
            it('should build Angular project with production configuration', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);
                const options: BuildOptions = {};

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'Build successful',
                    stderr: '',
                });

                // Act
                await builder.build(options);

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.arrayContaining([
                        'build',
                        '--configuration=production',
                        '--base-href=./',
                    ]),
                    expect.objectContaining({
                        cwd: '/mock/project/root/src/gui',
                    }),
                );
            });

            it('should use provided configuration from angularConfig', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const customConfig = {
                    ...mockConfig,
                    angularConfig: {
                        ...mockConfig.angularConfig,
                        configuration: 'development' as const,
                        baseHref: '/app/',
                    },
                };
                const builder = new GUIBuilder(customConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.arrayContaining([
                        'build',
                        '--configuration=development',
                        '--base-href=/app/',
                    ]),
                    expect.any(Object),
                );
            });

            it('should create artifacts in correct output directory', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {PathResolver} = await import('../utils/path-resolver');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(PathResolver.getGUIDir).toHaveBeenCalled();
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.any(Array),
                    expect.objectContaining({
                        cwd: '/mock/project/root/src/gui',
                    }),
                );
            });

            it('should set verbose mode from build options', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({verbose: true});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.any(Array),
                    expect.objectContaining({
                        verbose: true,
                    }),
                );
            });

            it('should default verbose to false when not specified', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.any(Array),
                    expect.objectContaining({
                        verbose: false,
                    }),
                );
            });

            it('should log debug messages during build', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(Logger.debug).toHaveBeenCalledWith(
                    'Building Angular project (production)',
                );
                expect(Logger.debug).toHaveBeenCalledWith(
                    expect.stringContaining('Angular build command: ng'),
                );
            });

            it('should log success message after successful build', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(Logger.success).toHaveBeenCalledWith(
                    'Angular build completed successfully',
                );
            });

            it('should use correct working directory for Angular CLI', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.any(Array),
                    expect.objectContaining({
                        cwd: '/mock/project/root/src/gui',
                    }),
                );
            });

            it('should build with different base href values', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const customConfig = {
                    ...mockConfig,
                    angularConfig: {
                        ...mockConfig.angularConfig,
                        baseHref: '/custom/path/',
                    },
                };
                const builder = new GUIBuilder(customConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.arrayContaining(['--base-href=/custom/path/']),
                    expect.any(Object),
                );
            });
        });

        describe('build failures', () => {
            it('should throw error when build command returns non-zero exit code', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'Angular compilation error: Cannot find module',
                });

                // Act & Assert
                await expect(builder.build({})).rejects.toThrow(
                    'Angular build failed',
                );
            });

            it('should include stderr in error message when build fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 2,
                    stdout: '',
                    stderr: 'Error: Template parse errors',
                });

                // Act & Assert
                await expect(builder.build({})).rejects.toThrow(
                    'Template parse errors',
                );
            });

            it('should log error message when build fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'Build error',
                });

                // Act & Assert
                await expect(builder.build({})).rejects.toThrow();
                expect(Logger.error).toHaveBeenCalledWith(
                    expect.stringContaining('Angular build failed with exit code 1'),
                );
            });

            it('should log stderr when build fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new GUIBuilder(mockConfig);

                const errorMessage = 'Compilation failed with errors';
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: errorMessage,
                });

                // Act & Assert
                await expect(builder.build({})).rejects.toThrow();
                expect(Logger.error).toHaveBeenCalledWith(errorMessage);
            });

            it('should handle build failure with empty stderr', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.build({})).rejects.toThrow(
                    'Unknown error',
                );
            });

            it('should throw error with exit code information', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 127,
                    stdout: '',
                    stderr: 'ng: command not found',
                });

                // Act & Assert
                await expect(builder.build({})).rejects.toThrow();
                const {Logger} = await import('../utils/logger');
                expect(Logger.error).toHaveBeenCalledWith(
                    'Angular build failed with exit code 127',
                );
            });

            it('should handle command execution rejection', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockRejectedValue(
                    new Error('Command execution failed'),
                );

                // Act & Assert
                await expect(builder.build({})).rejects.toThrow(
                    'Command execution failed',
                );
            });
        });

        describe('configuration variations', () => {
            it('should handle development configuration', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const devConfig = {
                    ...mockConfig,
                    angularConfig: {
                        ...mockConfig.angularConfig,
                        configuration: 'development' as const,
                    },
                };
                const builder = new GUIBuilder(devConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.arrayContaining(['--configuration=development']),
                    expect.any(Object),
                );
            });

            it('should handle root base href', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const rootConfig = {
                    ...mockConfig,
                    angularConfig: {
                        ...mockConfig.angularConfig,
                        baseHref: '/',
                    },
                };
                const builder = new GUIBuilder(rootConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.arrayContaining(['--base-href=/']),
                    expect.any(Object),
                );
            });

            it('should handle different output paths', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const customOutputConfig = {
                    ...mockConfig,
                    angularConfig: {
                        ...mockConfig.angularConfig,
                        outputPath: 'custom/output/path',
                    },
                };
                const builder = new GUIBuilder(customOutputConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert - build should still succeed with custom output path
                expect(CommandRunner.run).toHaveBeenCalled();
            });
        });

        describe('edge cases', () => {
            it('should handle empty stdout from successful build', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.build({})).resolves.not.toThrow();
            });

            it('should handle large stdout from build', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                const largeOutput = 'Build output\n'.repeat(1000);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: largeOutput,
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.build({})).resolves.not.toThrow();
            });

            it('should handle warnings in stderr with successful build', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new GUIBuilder(mockConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'Build successful',
                    stderr: 'Warning: Deprecated API usage',
                });

                // Act & Assert
                await expect(builder.build({})).resolves.not.toThrow();
            });

            it('should handle special characters in base href', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const specialConfig = {
                    ...mockConfig,
                    angularConfig: {
                        ...mockConfig.angularConfig,
                        baseHref: '/app-v2.0/',
                    },
                };
                const builder = new GUIBuilder(specialConfig);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build({});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'ng',
                    expect.arrayContaining(['--base-href=/app-v2.0/']),
                    expect.any(Object),
                );
            });
        });
    });

    describe('cleanupPaths', () => {
        it('should return correct cleanup path based on output path', () => {
            // Arrange
            const builder = new GUIBuilder(mockConfig);

            // Act
            const paths = builder.cleanupPaths;

            // Assert
            expect(paths).toEqual(['/mock/project/root/src/gui/dist/gui']);
        });

        it('should handle different output paths', () => {
            // Arrange
            const customConfig = {
                ...mockConfig,
                angularConfig: {
                    ...mockConfig.angularConfig,
                    outputPath: 'build/output',
                },
            };
            const builder = new GUIBuilder(customConfig);

            // Act
            const paths = builder.cleanupPaths;

            // Assert
            expect(paths).toEqual(['/mock/project/root/src/gui/build/output']);
        });

        it('should return array with single path', () => {
            // Arrange
            const builder = new GUIBuilder(mockConfig);

            // Act
            const paths = builder.cleanupPaths;

            // Assert
            expect(Array.isArray(paths)).toBe(true);
            expect(paths).toHaveLength(1);
        });
    });
});
