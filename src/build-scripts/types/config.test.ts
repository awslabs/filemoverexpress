import {describe, expect, it} from 'vitest';
import type {
    AngularConfig,
    BuildConfig,
    CLIBuildConfig,
    ElectronBuildConfig,
    ElectronConfig,
    ElectronPackagerConfig,
    ElectronPackagerOptions,
    GUIBuildConfig,
    PackagerConfig,
} from './config';
import {Architecture, Platform} from './platform';

describe('config types', () => {
    describe('BuildConfig', () => {
        it('should accept valid BuildConfig', () => {
            const config: BuildConfig = {
                outputDir: 'dist',
                sourceDir: 'src',
                platforms: [
                    {platform: Platform.Darwin, arch: Architecture.X64},
                ],
            };
            expect(config.outputDir).toBe('dist');
            expect(config.sourceDir).toBe('src');
            expect(config.platforms).toHaveLength(1);
        });

        it('should accept BuildConfig with multiple platforms', () => {
            const config: BuildConfig = {
                outputDir: 'dist',
                sourceDir: 'src',
                platforms: [
                    {platform: Platform.Darwin, arch: Architecture.X64},
                    {platform: Platform.Linux, arch: Architecture.ARM64},
                    {platform: Platform.Windows, arch: Architecture.X64},
                ],
            };
            expect(config.platforms).toHaveLength(3);
        });

        it('should accept BuildConfig with empty platforms', () => {
            const config: BuildConfig = {
                outputDir: 'dist',
                sourceDir: 'src',
                platforms: [],
            };
            expect(config.platforms).toHaveLength(0);
        });
    });

    describe('CLIBuildConfig', () => {
        it('should accept valid CLIBuildConfig', () => {
            const config: CLIBuildConfig = {
                outputDir: 'dist',
                sourceDir: 'src/cli',
                platforms: [],
                goVersion: '1.24.0',
                buildFlags: ['-trimpath'],
                ldFlags: ['-s', '-w'],
            };
            expect(config.goVersion).toBe('1.24.0');
            expect(config.buildFlags).toEqual(['-trimpath']);
            expect(config.ldFlags).toEqual(['-s', '-w']);
        });

        it('should accept CLIBuildConfig with optional windowsDaemonLauncherPath', () => {
            const config: CLIBuildConfig = {
                outputDir: 'dist',
                sourceDir: 'src/cli',
                platforms: [],
                goVersion: '1.24.0',
                buildFlags: [],
                ldFlags: [],
                windowsDaemonLauncherPath: 'src/windows-daemon-launcher',
            };
            expect(config.windowsDaemonLauncherPath).toBe('src/windows-daemon-launcher');
        });
    });

    describe('ElectronPackagerOptions', () => {
        it('should accept valid ElectronPackagerOptions', () => {
            const options: ElectronPackagerOptions = {
                overwrite: true,
                prune: true,
                asar: false,
            };
            expect(options.overwrite).toBe(true);
            expect(options.prune).toBe(true);
            expect(options.asar).toBe(false);
        });
    });

    describe('ElectronConfig', () => {
        it('should accept valid ElectronConfig', () => {
            const config: ElectronConfig = {
                appName: 'Test App',
                appBundleId: 'com.test.app',
                helperBundleId: 'com.test.app.helper',
                iconPaths: {
                    [Platform.Darwin]: 'assets/icons/mac/icon.icns',
                    [Platform.Linux]: 'assets/icons/png/icon_256x256.png',
                    [Platform.Windows]: 'assets/icons/png/icon.ico',
                    [Platform.Unknown]: 'assets/icons/png/icon.ico',
                },
                packagerOptions: {
                    overwrite: true,
                    prune: true,
                    asar: false,
                },
            };
            expect(config.appName).toBe('Test App');
            expect(config.appBundleId).toBe('com.test.app');
            expect(config.helperBundleId).toBe('com.test.app.helper');
            expect(config.iconPaths[Platform.Darwin]).toBe('assets/icons/mac/icon.icns');
        });
    });

    describe('ElectronBuildConfig', () => {
        it('should accept valid ElectronBuildConfig', () => {
            const config: ElectronBuildConfig = {
                outputDir: 'dist/electron',
                sourceDir: 'src/electron',
                platforms: [],
                appName: 'Test App',
                appBundleId: 'com.test.app',
                helperBundleId: 'com.test.app.helper',
                appAuthor: 'App Author',
                appDescription: 'App Description',
                iconPaths: {
                    [Platform.Darwin]: 'assets/icons/mac/icon.icns',
                    [Platform.Linux]: 'assets/icons/png/icon_256x256.png',
                    [Platform.Windows]: 'assets/icons/png/icon.ico',
                    [Platform.Unknown]: 'assets/icons/png/icon.ico',
                },
                packagerOptions: {
                    overwrite: true,
                    prune: true,
                    asar: false,
                },
            };
            expect(config.outputDir).toBe('dist/electron');
            expect(config.appName).toBe('Test App');
        });
    });

    describe('AngularConfig', () => {
        it('should accept valid AngularConfig with production', () => {
            const config: AngularConfig = {
                project: 'test-project',
                configuration: 'production',
                outputPath: 'dist/gui',
                baseHref: './',
            };
            expect(config.project).toBe('test-project');
            expect(config.configuration).toBe('production');
        });

        it('should accept valid AngularConfig with development', () => {
            const config: AngularConfig = {
                project: 'test-project',
                configuration: 'development',
                outputPath: 'dist/gui',
                baseHref: './',
            };
            expect(config.configuration).toBe('development');
        });
    });

    describe('GUIBuildConfig', () => {
        it('should accept valid GUIBuildConfig', () => {
            const config: GUIBuildConfig = {
                outputDir: 'dist',
                sourceDir: 'src/gui',
                platforms: [],
                angularConfig: {
                    project: 'test-project',
                    configuration: 'production',
                    outputPath: 'dist/gui',
                    baseHref: './',
                },
                electronConfig: {
                    appName: 'Test App',
                    appBundleId: 'com.test.app',
                    helperBundleId: 'com.test.app.helper',
                    iconPaths: {
                        [Platform.Darwin]: 'assets/icons/mac/icon.icns',
                        [Platform.Linux]: 'assets/icons/png/icon_256x256.png',
                        [Platform.Windows]: 'assets/icons/png/icon.ico',
                        [Platform.Unknown]: 'assets/icons/png/icon.ico',
                    },
                    packagerOptions: {
                        overwrite: true,
                        prune: true,
                        asar: false,
                    },
                },
            };
            expect(config.angularConfig.project).toBe('test-project');
            expect(config.electronConfig.appName).toBe('Test App');
        });
    });

    describe('PackagerConfig', () => {
        it('should accept valid PackagerConfig', () => {
            const config: PackagerConfig = {
                outputPath: 'dist/packaged',
            };
            expect(config.outputPath).toBe('dist/packaged');
        });
    });

    describe('ElectronPackagerConfig', () => {
        it('should accept valid ElectronPackagerConfig', () => {
            const config: ElectronPackagerConfig = {
                outputPath: 'dist/packaged',
                platforms: [
                    {platform: Platform.Darwin, arch: Architecture.X64},
                ],
                options: {
                    production: true,
                },
                electronConfig: {
                    appName: 'Test App',
                    appBundleId: 'com.test.app',
                    helperBundleId: 'com.test.app.helper',
                    iconPaths: {
                        [Platform.Darwin]: 'assets/icons/mac/icon.icns',
                        [Platform.Linux]: 'assets/icons/png/icon_256x256.png',
                        [Platform.Windows]: 'assets/icons/png/icon.ico',
                        [Platform.Unknown]: 'assets/icons/png/icon.ico',
                    },
                    packagerOptions: {
                        overwrite: true,
                        prune: true,
                        asar: false,
                    },
                },
            };
            expect(config.outputPath).toBe('dist/packaged');
            expect(config.platforms).toHaveLength(1);
            expect(config.options.production).toBe(true);
        });
    });
});
