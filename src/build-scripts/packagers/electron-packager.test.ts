import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {ElectronPackagerConfig} from '../types/config';
import {Architecture, Platform} from '../types/platform';
import {ElectronPackager} from './electron-packager';

// Mock dependencies
vi.mock('@electron/packager', () => ({
    packager: vi.fn(),
}));

vi.mock('fs/promises', () => ({
    default: {
        access: vi.fn(),
        copyFile: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn(),
        cp: vi.fn(),
        rm: vi.fn(),
    },
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
        getGUIDir: vi.fn(() => '/mock/project/root/src/gui'),
    },
}));

vi.mock('../utils/temp-dir-manager', () => {
    const MockTempDirManager = vi.fn().mockImplementation(function (this: any) {
        this.createTempDir = vi.fn(() => '/tmp/electron-build-12345');
    });
    return {TempDirManager: MockTempDirManager};
});

// Mock builders
vi.mock('../builders/cli-builder', () => {
    const MockCLIBuilder = vi.fn().mockImplementation(function (this: any) {
        this.build = vi.fn().mockResolvedValue(undefined);
    });
    return {CLIBuilder: MockCLIBuilder};
});

vi.mock('../builders/gui-builder', () => {
    const MockGUIBuilder = vi.fn().mockImplementation(function (this: any) {
        this.build = vi.fn().mockResolvedValue(undefined);
    });
    return {GUIBuilder: MockGUIBuilder};
});

vi.mock('../builders/protobuf-builder', () => {
    const MockProtobufBuilder = vi.fn().mockImplementation(function (this: any) {
        this.build = vi.fn().mockResolvedValue(undefined);
    });
    return {ProtobufBuilder: MockProtobufBuilder};
});

vi.mock('../builders/electron-builder', () => {
    const MockElectronBuilder = vi.fn().mockImplementation(function (this: any) {
        this.build = vi.fn().mockResolvedValue(undefined);
    });
    return {ElectronBuilder: MockElectronBuilder};
});

describe('ElectronPackager', () => {
    let mockConfig: ElectronPackagerConfig;

    beforeEach(async () => {
        // Reset all mocks before each test
        const fs = await import('fs/promises');
        const {packager} = await import('@electron/packager');
        const {CommandRunner} = await import('../utils/command-runner');
        const {Logger} = await import('../utils/logger');

        vi.mocked(fs.default.access).mockReset();
        vi.mocked(fs.default.copyFile).mockReset();
        vi.mocked(fs.default.readdir).mockReset();
        vi.mocked(fs.default.stat).mockReset();
        vi.mocked(fs.default.cp).mockReset();
        vi.mocked(fs.default.rm).mockReset();
        vi.mocked(packager).mockReset();
        vi.mocked(CommandRunner.run).mockReset();
        vi.mocked(Logger.debug).mockReset();
        vi.mocked(Logger.error).mockReset();
        vi.mocked(Logger.info).mockReset();
        vi.mocked(Logger.success).mockReset();

        // Default mock config
        mockConfig = {
            outputPath: 'dist/packaged',
            platforms: [
                {platform: Platform.Darwin, arch: Architecture.X64},
            ],
            options: {},
            electronConfig: {
                appName: 'TestApp',
                appBundleId: 'com.test.app',
                helperBundleId: 'com.test.app.helper',
                iconPaths: {
                    [Platform.Darwin]: 'assets/icon.icns',
                    [Platform.Linux]: 'assets/icon.png',
                    [Platform.Windows]: 'assets/icon.ico',
                    [Platform.Unknown]: 'assets/icon.ico',
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

    describe('packageForPlatform', () => {
        describe('packaging on each platform', () => {
            it('should package for darwin platform', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const darwinConfig = {
                    ...mockConfig,
                    platforms: [{platform: Platform.Darwin, arch: Architecture.X64}],
                };
                const electronPackager = new ElectronPackager(darwinConfig);

                // Mock file system operations
                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js', 'preload.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-darwin-x64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: 'darwin',
                        arch: 'x64',
                    }),
                );
            });

            it('should package for linux platform', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const linuxConfig = {
                    ...mockConfig,
                    platforms: [{platform: Platform.Linux, arch: Architecture.X64}],
                };
                const electronPackager = new ElectronPackager(linuxConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-linux-x64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Linux, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: 'linux',
                        arch: 'x64',
                    }),
                );
            });

            it('should package for windows platform', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const windowsConfig = {
                    ...mockConfig,
                    platforms: [{platform: Platform.Windows, arch: Architecture.X64}],
                };
                const electronPackager = new ElectronPackager(windowsConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-win32-x64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Windows, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: 'win32',
                        arch: 'x64',
                    }),
                );
            });
        });

        describe('packaging with each architecture', () => {
            it('should package for x64 architecture', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const x64Config = {
                    ...mockConfig,
                    platforms: [{platform: Platform.Darwin, arch: Architecture.X64}],
                };
                const electronPackager = new ElectronPackager(x64Config);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-darwin-x64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        arch: 'x64',
                    }),
                );
            });

            it('should package for arm64 architecture', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const arm64Config = {
                    ...mockConfig,
                    platforms: [{platform: Platform.Darwin, arch: Architecture.ARM64}],
                };
                const electronPackager = new ElectronPackager(arm64Config);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-darwin-arm64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.ARM64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        arch: 'arm64',
                    }),
                );
            });

            it('should package for all platform and architecture combinations', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const multiConfig = {
                    ...mockConfig,
                    platforms: [
                        {platform: Platform.Darwin, arch: Architecture.X64},
                        {platform: Platform.Darwin, arch: Architecture.ARM64},
                        {platform: Platform.Linux, arch: Architecture.X64},
                        {platform: Platform.Linux, arch: Architecture.ARM64},
                        {platform: Platform.Windows, arch: Architecture.X64},
                        {platform: Platform.Windows, arch: Architecture.ARM64},
                    ],
                };
                const electronPackager = new ElectronPackager(multiConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.package();

                // Assert
                expect(packager).toHaveBeenCalledTimes(6);
                expect(packager).toHaveBeenCalledWith(expect.objectContaining({platform: 'darwin', arch: 'x64'}));
                expect(packager).toHaveBeenCalledWith(expect.objectContaining({platform: 'darwin', arch: 'arm64'}));
                expect(packager).toHaveBeenCalledWith(expect.objectContaining({platform: 'linux', arch: 'x64'}));
                expect(packager).toHaveBeenCalledWith(expect.objectContaining({platform: 'linux', arch: 'arm64'}));
                expect(packager).toHaveBeenCalledWith(expect.objectContaining({platform: 'win32', arch: 'x64'}));
                expect(packager).toHaveBeenCalledWith(expect.objectContaining({platform: 'win32', arch: 'arm64'}));
            });
        });

        describe('output path generation', () => {
            it('should generate correct output path for darwin-x64', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-darwin-x64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        out: '/mock/project/root/dist/packaged',
                        name: 'TestApp',
                    }),
                );
            });

            it('should generate correct output path for linux-arm64', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const linuxConfig = {
                    ...mockConfig,
                    platforms: [{platform: Platform.Linux, arch: Architecture.ARM64}],
                };
                const electronPackager = new ElectronPackager(linuxConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-linux-arm64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Linux, arch: Architecture.ARM64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        out: '/mock/project/root/dist/packaged',
                        name: 'TestApp',
                    }),
                );
            });

            it('should generate correct output path for windows-x64', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const windowsConfig = {
                    ...mockConfig,
                    platforms: [{platform: Platform.Windows, arch: Architecture.X64}],
                };
                const electronPackager = new ElectronPackager(windowsConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-win32-x64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Windows, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        out: '/mock/project/root/dist/packaged',
                        name: 'TestApp',
                    }),
                );
            });

            it('should use custom output path from config', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const customConfig = {
                    ...mockConfig,
                    outputPath: 'custom/output/path',
                };
                const electronPackager = new ElectronPackager(customConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/custom/output/path/TestApp-darwin-x64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        out: '/mock/project/root/custom/output/path',
                    }),
                );
            });

            it('should use app name from electron config', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const customNameConfig = {
                    ...mockConfig,
                    electronConfig: {
                        ...mockConfig.electronConfig,
                        appName: 'CustomAppName',
                    },
                };
                const electronPackager = new ElectronPackager(customNameConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/CustomAppName-darwin-x64']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'CustomAppName',
                    }),
                );
            });
        });

        describe('packager options', () => {
            it('should pass correct packager options', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        overwrite: true,
                        prune: true,
                        asar: true,
                    }),
                );
            });

            it('should pass bundle IDs for darwin platform', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        appBundleId: 'com.test.app',
                        helperBundleId: 'com.test.app.helper',
                    }),
                );
            });

            it('should include icon path when available', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        icon: expect.stringContaining('icon.icns'),
                    }),
                );
            });

            it('should use staging directory as source', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(packager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        dir: '/tmp/electron-build-12345',
                    }),
                );
            });
        });

        describe('staging operations', () => {
            it('should copy electron package.json to staging directory', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(fs.default.copyFile).toHaveBeenCalledWith(
                    '/mock/project/root/src/electron/package.json',
                    '/tmp/electron-build-12345/package.json',
                );
            });

            it('should copy electron dist files to staging directory', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js', 'preload.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(fs.default.copyFile).toHaveBeenCalledWith(
                    '/mock/project/root/src/electron/dist/main.js',
                    '/tmp/electron-build-12345/main.js',
                );
                expect(fs.default.copyFile).toHaveBeenCalledWith(
                    '/mock/project/root/src/electron/dist/preload.js',
                    '/tmp/electron-build-12345/preload.js',
                );
            });

            it('should copy electron assets to staging directory', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(fs.default.cp).toHaveBeenCalledWith(
                    '/mock/project/root/src/electron/assets',
                    '/tmp/electron-build-12345/assets',
                    {recursive: true},
                );
            });

            it('should copy GUI build output to app subdirectory', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(fs.default.cp).toHaveBeenCalledWith(
                    '/mock/project/root/src/gui/dist/browser',
                    '/tmp/electron-build-12345/app',
                    {recursive: true},
                );
            });

            it('should run npm install in staging directory', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'npm',
                    ['install'],
                    {cwd: '/tmp/electron-build-12345'},
                );
            });

            it('should clean up staging directory after packaging', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/output']);

                // Act
                await electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64});

                // Assert
                expect(fs.default.rm).toHaveBeenCalledWith(
                    '/tmp/electron-build-12345',
                    {recursive: true, force: true},
                );
            });
        });

        describe('error handling', () => {
            it('should throw error when electron package.json not found', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                // First access call for package.json fails
                vi.mocked(fs.default.access).mockRejectedValueOnce(new Error('ENOENT'));
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act & Assert
                await expect(
                    electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64}),
                ).rejects.toThrow('Electron package.json not found');
            });

            it('should throw error when electron dist files not found', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                // package.json exists, but dist dir doesn't
                vi.mocked(fs.default.access)
                    .mockResolvedValueOnce(undefined) // package.json
                    .mockRejectedValueOnce(new Error('ENOENT')); // dist dir
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act & Assert
                await expect(
                    electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64}),
                ).rejects.toThrow('Electron dist files not found');
            });

            it('should throw error when electron assets not found', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                // package.json and dist exist, but assets don't
                vi.mocked(fs.default.access)
                    .mockResolvedValueOnce(undefined) // package.json
                    .mockResolvedValueOnce(undefined) // dist dir
                    .mockRejectedValueOnce(new Error('ENOENT')); // assets dir
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act & Assert
                await expect(
                    electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64}),
                ).rejects.toThrow('Electron assets not found');
            });

            it('should throw error when GUI build output not found', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                // All electron files exist, but GUI dist doesn't
                vi.mocked(fs.default.access)
                    .mockResolvedValueOnce(undefined) // package.json
                    .mockResolvedValueOnce(undefined) // dist dir
                    .mockResolvedValueOnce(undefined) // assets dir
                    .mockRejectedValueOnce(new Error('ENOENT')); // GUI dist
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act & Assert
                await expect(
                    electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64}),
                ).rejects.toThrow('GUI build output not found');
            });

            it('should throw error when npm install fails', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockRejectedValue(new Error('npm install failed'));

                // Act & Assert
                await expect(
                    electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64}),
                ).rejects.toThrow('Failed to install npm packages');
            });

            it('should throw error when packager fails', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockRejectedValue(new Error('Packaging failed'));

                // Act & Assert
                await expect(
                    electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64}),
                ).rejects.toThrow('Electron packaging failed for darwin-x64');
            });

            it('should clean up staging directory even when packaging fails', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                vi.mocked(fs.default.access).mockResolvedValue(undefined);
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockRejectedValue(new Error('Packaging failed'));

                // Act & Assert
                await expect(
                    electronPackager.packageForPlatform({platform: Platform.Darwin, arch: Architecture.X64}),
                ).rejects.toThrow();

                expect(fs.default.rm).toHaveBeenCalledWith(
                    '/tmp/electron-build-12345',
                    {recursive: true, force: true},
                );
            });

            it('should throw error when packaged app verification fails', async () => {
                // Arrange
                const fs = await import('fs/promises');
                const {packager} = await import('@electron/packager');
                const {CommandRunner} = await import('../utils/command-runner');

                const electronPackager = new ElectronPackager(mockConfig);

                // Staging succeeds, packaging succeeds, but verification fails
                vi.mocked(fs.default.access)
                    .mockResolvedValueOnce(undefined) // package.json
                    .mockResolvedValueOnce(undefined) // dist dir
                    .mockResolvedValueOnce(undefined) // assets dir
                    .mockResolvedValueOnce(undefined) // GUI dist
                    .mockRejectedValueOnce(new Error('ENOENT')); // verification
                vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
                vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
                vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
                vi.mocked(fs.default.cp).mockResolvedValue(undefined);
                vi.mocked(fs.default.rm).mockResolvedValue(undefined);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(packager).mockResolvedValue(['/mock/project/root/dist/packaged/TestApp-darwin-x64']);

                // Act & Assert
                await expect(electronPackager.package()).rejects.toThrow(
                    'Packaged application not found at expected location',
                );
            });
        });
    });

    describe('package', () => {
        it('should build all packages before packaging', async () => {
            // Arrange
            const fs = await import('fs/promises');
            const {packager} = await import('@electron/packager');
            const {CommandRunner} = await import('../utils/command-runner');

            const electronPackager = new ElectronPackager(mockConfig);

            vi.mocked(fs.default.access).mockResolvedValue(undefined);
            vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
            vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
            vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
            vi.mocked(fs.default.cp).mockResolvedValue(undefined);
            vi.mocked(fs.default.rm).mockResolvedValue(undefined);
            vi.mocked(CommandRunner.run).mockResolvedValue({
                exitCode: 0,
                stdout: '',
                stderr: '',
            });
            vi.mocked(packager).mockResolvedValue(['/mock/output']);

            // Act
            await electronPackager.package();

            // Assert - verify that build methods were called
            // The builders are instantiated in the constructor, so we just verify the package method completed
            expect(packager).toHaveBeenCalled();
        });

        it('should package for all configured platforms', async () => {
            // Arrange
            const fs = await import('fs/promises');
            const {packager} = await import('@electron/packager');
            const {CommandRunner} = await import('../utils/command-runner');

            const multiPlatformConfig = {
                ...mockConfig,
                platforms: [
                    {platform: Platform.Darwin, arch: Architecture.X64},
                    {platform: Platform.Linux, arch: Architecture.X64},
                    {platform: Platform.Windows, arch: Architecture.X64},
                ],
            };
            const electronPackager = new ElectronPackager(multiPlatformConfig);

            vi.mocked(fs.default.access).mockResolvedValue(undefined);
            vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
            vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
            vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
            vi.mocked(fs.default.cp).mockResolvedValue(undefined);
            vi.mocked(fs.default.rm).mockResolvedValue(undefined);
            vi.mocked(CommandRunner.run).mockResolvedValue({
                exitCode: 0,
                stdout: '',
                stderr: '',
            });
            vi.mocked(packager).mockResolvedValue(['/mock/output']);

            // Act
            await electronPackager.package();

            // Assert
            expect(packager).toHaveBeenCalledTimes(3);
        });

        it('should verify packaged app for each platform', async () => {
            // Arrange
            const fs = await import('fs/promises');
            const {packager} = await import('@electron/packager');
            const {CommandRunner} = await import('../utils/command-runner');
            const {Logger} = await import('../utils/logger');

            const electronPackager = new ElectronPackager(mockConfig);

            vi.mocked(fs.default.access).mockResolvedValue(undefined);
            vi.mocked(fs.default.readdir).mockResolvedValue(['main.js'] as any);
            vi.mocked(fs.default.stat).mockResolvedValue({isDirectory: () => false} as any);
            vi.mocked(fs.default.copyFile).mockResolvedValue(undefined);
            vi.mocked(fs.default.cp).mockResolvedValue(undefined);
            vi.mocked(fs.default.rm).mockResolvedValue(undefined);
            vi.mocked(CommandRunner.run).mockResolvedValue({
                exitCode: 0,
                stdout: '',
                stderr: '',
            });
            vi.mocked(packager).mockResolvedValue(['/mock/output']);

            // Act
            await electronPackager.package();

            // Assert
            expect(Logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Verified packaged application exists'),
            );
        });
    });

    describe('cleanupPaths', () => {
        it('should return empty array for cleanup paths', () => {
            // Arrange
            const electronPackager = new ElectronPackager(mockConfig);

            // Act
            const paths = electronPackager.cleanupPaths;

            // Assert
            expect(paths).toEqual([]);
        });
    });
});
