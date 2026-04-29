import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {executeBuild, getDefaultBuildOptions, parseArchitectures, parsePlatforms} from './build';
import {cleanupMocks} from './test-utils';
import {BuildOptions} from './types/build-target';
import {Architecture, Platform} from './types/platform';

// Mock platform detector
vi.mock('./utils/platform-detector', () => ({
    detectCurrentPlatform: vi.fn(() => Platform.Darwin),
    detectCurrentArchitecture: vi.fn(() => Architecture.X64),
}));

// Mock all builder classes
vi.mock('./builders/cli-builder');
vi.mock('./builders/gui-builder');
vi.mock('./builders/protobuf-builder');
vi.mock('./builders/electron-builder');
vi.mock('./packagers/electron-packager');
vi.mock('./installers/local-installer');
vi.mock('./installers/forge-installer');

// Mock logger
vi.mock('./utils/logger', () => ({
    Logger: {
        verbose: false,
        info: vi.fn(),
        success: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock configs
vi.mock('./config/cli-config', () => ({
    cliConfig: {
        outputDir: 'dist/cli',
    },
}));

vi.mock('./config/gui-config', () => ({
    guiConfig: {
        outputDir: 'dist/gui',
    },
}));

vi.mock('./config/electron-config', () => ({
    electronConfig: {},
}));

describe('build.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('parseArchitectures', () => {
        describe('valid inputs', () => {
            it('should parse single x64 architecture', () => {
                // Act
                const result = parseArchitectures('x64');

                // Assert
                expect(result).toEqual([Architecture.X64]);
            });

            it('should parse single arm64 architecture', () => {
                // Act
                const result = parseArchitectures('arm64');

                // Assert
                expect(result).toEqual([Architecture.ARM64]);
            });

            it('should parse multiple architectures separated by comma', () => {
                // Act
                const result = parseArchitectures('x64,arm64');

                // Assert
                expect(result).toEqual([Architecture.X64, Architecture.ARM64]);
            });

            it('should parse architectures with spaces around commas', () => {
                // Act
                const result = parseArchitectures('x64, arm64');

                // Assert
                expect(result).toEqual([Architecture.X64, Architecture.ARM64]);
            });

            it('should parse architectures with extra whitespace', () => {
                // Act
                const result = parseArchitectures('  x64  ,  arm64  ');

                // Assert
                expect(result).toEqual([Architecture.X64, Architecture.ARM64]);
            });

            it('should parse architectures in reverse order', () => {
                // Act
                const result = parseArchitectures('arm64,x64');

                // Assert
                expect(result).toEqual([Architecture.ARM64, Architecture.X64]);
            });
        });

        describe('invalid inputs', () => {
            it('should throw error for invalid architecture name', () => {
                // Act & Assert
                expect(() => parseArchitectures('invalid')).toThrow(
                    "Invalid architecture 'invalid'. Must be 'x64' or 'arm64'.",
                );
            });

            it('should throw error for partially invalid architectures', () => {
                // Act & Assert
                expect(() => parseArchitectures('x64,invalid')).toThrow(
                    "Invalid architecture 'invalid'. Must be 'x64' or 'arm64'.",
                );
            });

            it('should throw error for x86 architecture', () => {
                // Act & Assert
                expect(() => parseArchitectures('x86')).toThrow(
                    "Invalid architecture 'x86'. Must be 'x64' or 'arm64'.",
                );
            });

            it('should throw error for amd64 architecture', () => {
                // Act & Assert
                expect(() => parseArchitectures('amd64')).toThrow(
                    "Invalid architecture 'amd64'. Must be 'x64' or 'arm64'.",
                );
            });

            it('should throw error for empty string', () => {
                // Act & Assert
                expect(() => parseArchitectures('')).toThrow(
                    "Invalid architecture ''. Must be 'x64' or 'arm64'.",
                );
            });

            it('should throw error for whitespace-only string', () => {
                // Act & Assert
                expect(() => parseArchitectures('   ')).toThrow(
                    "Invalid architecture ''. Must be 'x64' or 'arm64'.",
                );
            });

            it('should throw error for mixed case architecture', () => {
                // Act & Assert
                expect(() => parseArchitectures('X64')).toThrow(
                    "Invalid architecture 'X64'. Must be 'x64' or 'arm64'.",
                );
            });

            it('should throw error for ARM64 in uppercase', () => {
                // Act & Assert
                expect(() => parseArchitectures('ARM64')).toThrow(
                    "Invalid architecture 'ARM64'. Must be 'x64' or 'arm64'.",
                );
            });
        });

        describe('edge cases', () => {
            it('should throw error for trailing comma', () => {
                // Act & Assert - trailing comma creates empty string which should error
                expect(() => parseArchitectures('x64,')).toThrow(
                    "Invalid architecture ''. Must be 'x64' or 'arm64'.",
                );
            });

            it('should handle duplicate architectures', () => {
                // Act
                const result = parseArchitectures('x64,x64');

                // Assert
                expect(result).toEqual([Architecture.X64, Architecture.X64]);
            });
        });
    });

    describe('parsePlatforms', () => {
        describe('valid inputs', () => {
            it('should parse single darwin platform', () => {
                // Act
                const result = parsePlatforms('darwin');

                // Assert
                expect(result).toEqual([Platform.Darwin]);
            });

            it('should parse single linux platform', () => {
                // Act
                const result = parsePlatforms('linux');

                // Assert
                expect(result).toEqual([Platform.Linux]);
            });

            it('should parse single windows platform', () => {
                // Act
                const result = parsePlatforms('windows');

                // Assert
                expect(result).toEqual([Platform.Windows]);
            });

            it('should parse multiple platforms separated by comma', () => {
                // Act
                const result = parsePlatforms('darwin,linux,windows');

                // Assert
                expect(result).toEqual([Platform.Darwin, Platform.Linux, Platform.Windows]);
            });

            it('should parse platforms with spaces around commas', () => {
                // Act
                const result = parsePlatforms('darwin, linux, windows');

                // Assert
                expect(result).toEqual([Platform.Darwin, Platform.Linux, Platform.Windows]);
            });

            it('should parse platforms with extra whitespace', () => {
                // Act
                const result = parsePlatforms('  darwin  ,  linux  ');

                // Assert
                expect(result).toEqual([Platform.Darwin, Platform.Linux]);
            });

            it('should parse two platforms', () => {
                // Act
                const result = parsePlatforms('darwin,windows');

                // Assert
                expect(result).toEqual([Platform.Darwin, Platform.Windows]);
            });
        });

        describe('invalid inputs', () => {
            it('should throw error for invalid platform name', () => {
                // Act & Assert
                expect(() => parsePlatforms('invalid')).toThrow(
                    "Invalid platform 'invalid'. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should throw error for partially invalid platforms', () => {
                // Act & Assert
                expect(() => parsePlatforms('darwin,invalid')).toThrow(
                    "Invalid platform 'invalid'. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should throw error for macos platform', () => {
                // Act & Assert
                expect(() => parsePlatforms('macos')).toThrow(
                    "Invalid platform 'macos'. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should throw error for win32 platform', () => {
                // Act & Assert
                expect(() => parsePlatforms('win32')).toThrow(
                    "Invalid platform 'win32'. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should throw error for empty string', () => {
                // Act & Assert
                expect(() => parsePlatforms('')).toThrow(
                    "Invalid platform ''. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should throw error for whitespace-only string', () => {
                // Act & Assert
                expect(() => parsePlatforms('   ')).toThrow(
                    "Invalid platform ''. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should throw error for mixed case platform', () => {
                // Act & Assert
                expect(() => parsePlatforms('Darwin')).toThrow(
                    "Invalid platform 'Darwin'. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should throw error for LINUX in uppercase', () => {
                // Act & Assert
                expect(() => parsePlatforms('LINUX')).toThrow(
                    "Invalid platform 'LINUX'. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should throw error for Windows with capital W', () => {
                // Act & Assert
                expect(() => parsePlatforms('Windows')).toThrow(
                    "Invalid platform 'Windows'. Must be 'darwin', 'linux', or 'windows'.",
                );
            });
        });

        describe('edge cases', () => {
            it('should throw error for trailing comma', () => {
                // Act & Assert - trailing comma creates empty string which should error
                expect(() => parsePlatforms('darwin,')).toThrow(
                    "Invalid platform ''. Must be 'darwin', 'linux', or 'windows'.",
                );
            });

            it('should handle duplicate platforms', () => {
                // Act
                const result = parsePlatforms('darwin,darwin');

                // Assert
                expect(result).toEqual([Platform.Darwin, Platform.Darwin]);
            });
        });
    });

    describe('getDefaultBuildOptions', () => {
        it('should return current platform from detector', async () => {
            // Arrange
            const {detectCurrentPlatform} = await import('./utils/platform-detector');
            vi.mocked(detectCurrentPlatform).mockReturnValue(Platform.Linux);

            // Act
            const result = getDefaultBuildOptions();

            // Assert
            expect(result.platforms).toEqual([Platform.Linux]);
        });

        it('should return current architecture from detector', async () => {
            // Arrange
            const {detectCurrentArchitecture} = await import('./utils/platform-detector');
            vi.mocked(detectCurrentArchitecture).mockReturnValue(Architecture.ARM64);

            // Act
            const result = getDefaultBuildOptions();

            // Assert
            expect(result.archs).toEqual([Architecture.ARM64]);
        });

        it('should return both platform and architecture', async () => {
            // Arrange
            const {detectCurrentPlatform, detectCurrentArchitecture} = await import('./utils/platform-detector');
            vi.mocked(detectCurrentPlatform).mockReturnValue(Platform.Windows);
            vi.mocked(detectCurrentArchitecture).mockReturnValue(Architecture.X64);

            // Act
            const result = getDefaultBuildOptions();

            // Assert
            expect(result).toEqual({
                platforms: [Platform.Windows],
                archs: [Architecture.X64],
            });
        });

        it('should call platform detector once', async () => {
            // Arrange
            const {detectCurrentPlatform} = await import('./utils/platform-detector');

            // Act
            getDefaultBuildOptions();

            // Assert
            expect(detectCurrentPlatform).toHaveBeenCalledTimes(1);
        });

        it('should call architecture detector once', async () => {
            // Arrange
            const {detectCurrentArchitecture} = await import('./utils/platform-detector');

            // Act
            getDefaultBuildOptions();

            // Assert
            expect(detectCurrentArchitecture).toHaveBeenCalledTimes(1);
        });
    });

    describe('executeBuild', () => {
        let buildOptions: BuildOptions;

        beforeEach(() => {
            buildOptions = {
                platforms: [Platform.Darwin],
                archs: [Architecture.X64],
                production: false,
                verbose: false,
            };
        });

        describe('routing to correct builders', () => {
            it('should route to CLIBuilder for cli component', async () => {
                // Arrange
                const {CLIBuilder} = await import('./builders/cli-builder');
                const mockBuild = vi.fn().mockResolvedValue(undefined);
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = mockBuild;
                } as any);

                // Act
                await executeBuild('cli', 'build', buildOptions);

                // Assert
                expect(CLIBuilder).toHaveBeenCalledTimes(1);
                expect(mockBuild).toHaveBeenCalledWith(buildOptions);
            });

            it('should route to GUIBuilder for gui component', async () => {
                // Arrange
                const {GUIBuilder} = await import('./builders/gui-builder');
                const mockBuild = vi.fn().mockResolvedValue(undefined);
                vi.mocked(GUIBuilder).mockImplementation(function (this: any) {
                    this.build = mockBuild;
                } as any);

                // Act
                await executeBuild('gui', 'build', buildOptions);

                // Assert
                expect(GUIBuilder).toHaveBeenCalledTimes(1);
                expect(mockBuild).toHaveBeenCalledWith(buildOptions);
            });

            it('should route to ProtobufBuilder for proto component', async () => {
                // Arrange
                const {ProtobufBuilder} = await import('./builders/protobuf-builder');
                const mockBuild = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ProtobufBuilder).mockImplementation(function (this: any) {
                    this.build = mockBuild;
                } as any);

                // Act
                await executeBuild('proto', 'build', buildOptions);

                // Assert
                expect(ProtobufBuilder).toHaveBeenCalledTimes(1);
                expect(mockBuild).toHaveBeenCalledWith();
            });

            it('should route to ElectronBuilder for electron component', async () => {
                // Arrange
                const {ElectronBuilder} = await import('./builders/electron-builder');
                const mockBuild = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ElectronBuilder).mockImplementation(function (this: any) {
                    this.build = mockBuild;
                } as any);

                // Act
                await executeBuild('electron', 'build', buildOptions);

                // Assert
                expect(ElectronBuilder).toHaveBeenCalledTimes(1);
                expect(mockBuild).toHaveBeenCalledWith();
            });

            it('should route to ElectronPackager for package component', async () => {
                // Arrange
                const {ElectronPackager} = await import('./packagers/electron-packager');
                const mockPackage = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ElectronPackager).mockImplementation(function (this: any) {
                    this.package = mockPackage;
                } as any);

                // Act
                await executeBuild('package', 'build', buildOptions);

                // Assert
                expect(ElectronPackager).toHaveBeenCalledTimes(1);
                expect(mockPackage).toHaveBeenCalledWith();
            });

            it('should route to LocalInstaller for install component with local target', async () => {
                // Arrange
                const {LocalInstaller} = await import('./installers/local-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(LocalInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);

                // Act
                await executeBuild('install', 'local', buildOptions);

                // Assert
                expect(LocalInstaller).toHaveBeenCalledTimes(1);
                expect(mockGenerate).toHaveBeenCalledWith();
            });

            it('should pass correct config to CLIBuilder', async () => {
                // Arrange
                const {CLIBuilder} = await import('./builders/cli-builder');
                const {cliConfig} = await import('./config/cli-config');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);

                // Act
                await executeBuild('cli', 'build', buildOptions);

                // Assert
                expect(CLIBuilder).toHaveBeenCalledWith(cliConfig);
            });

            it('should pass correct config to GUIBuilder', async () => {
                // Arrange
                const {GUIBuilder} = await import('./builders/gui-builder');
                const {guiConfig} = await import('./config/gui-config');
                vi.mocked(GUIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);

                // Act
                await executeBuild('gui', 'build', buildOptions);

                // Assert
                expect(GUIBuilder).toHaveBeenCalledWith(guiConfig);
            });

            it('should pass platforms and archs to ElectronPackager', async () => {
                // Arrange
                const {ElectronPackager} = await import('./packagers/electron-packager');
                const multiPlatformOptions: BuildOptions = {
                    platforms: [Platform.Darwin, Platform.Linux],
                    archs: [Architecture.X64, Architecture.ARM64],
                    production: false,
                    verbose: false,
                };
                vi.mocked(ElectronPackager).mockImplementation(function (this: any) {
                    this.package = vi.fn().mockResolvedValue(undefined);
                } as any);

                // Act
                await executeBuild('package', 'build', multiPlatformOptions);

                // Assert
                expect(ElectronPackager).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platforms: expect.arrayContaining([
                            {platform: Platform.Darwin, arch: Architecture.X64},
                            {platform: Platform.Darwin, arch: Architecture.ARM64},
                            {platform: Platform.Linux, arch: Architecture.X64},
                            {platform: Platform.Linux, arch: Architecture.ARM64},
                        ]),
                    }),
                );
            });
        });

        describe('error handling', () => {
            it('should propagate error when CLIBuilder build fails', async () => {
                // Arrange
                const {CLIBuilder} = await import('./builders/cli-builder');
                const buildError = new Error('Build failed');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockRejectedValue(buildError);
                } as any);

                // Act & Assert
                await expect(executeBuild('cli', 'build', buildOptions)).rejects.toThrow('Build failed');
            });

            it('should propagate error when GUIBuilder build fails', async () => {
                // Arrange
                const {GUIBuilder} = await import('./builders/gui-builder');
                const buildError = new Error('GUI build failed');
                vi.mocked(GUIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockRejectedValue(buildError);
                } as any);

                // Act & Assert
                await expect(executeBuild('gui', 'build', buildOptions)).rejects.toThrow('GUI build failed');
            });

            it('should propagate error when ProtobufBuilder build fails', async () => {
                // Arrange
                const {ProtobufBuilder} = await import('./builders/protobuf-builder');
                const buildError = new Error('Protobuf generation failed');
                vi.mocked(ProtobufBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockRejectedValue(buildError);
                } as any);

                // Act & Assert
                await expect(executeBuild('proto', 'build', buildOptions)).rejects.toThrow('Protobuf generation failed');
            });

            it('should propagate error when ElectronBuilder build fails', async () => {
                // Arrange
                const {ElectronBuilder} = await import('./builders/electron-builder');
                const buildError = new Error('Electron build failed');
                vi.mocked(ElectronBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockRejectedValue(buildError);
                } as any);

                // Act & Assert
                await expect(executeBuild('electron', 'build', buildOptions)).rejects.toThrow('Electron build failed');
            });

            it('should handle ElectronPackager failure and exit process', async () => {
                // Arrange
                const {ElectronPackager} = await import('./packagers/electron-packager');
                const packageError = new Error('Packaging failed');
                vi.mocked(ElectronPackager).mockImplementation(function (this: any) {
                    this.package = vi.fn().mockRejectedValue(packageError);
                } as any);

                const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
                }) as any);

                // Act
                await executeBuild('package', 'build', buildOptions);

                // Assert
                expect(mockExit).toHaveBeenCalledWith(1);

                // Cleanup
                mockExit.mockRestore();
            });

            it('should handle LocalInstaller failure and exit process', async () => {
                // Arrange
                const {LocalInstaller} = await import('./installers/local-installer');
                const installError = new Error('Installation failed');
                vi.mocked(LocalInstaller).mockImplementation(function (this: any) {
                    this.generate = vi.fn().mockRejectedValue(installError);
                } as any);

                const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
                }) as any);

                // Act
                await executeBuild('install', 'local', buildOptions);

                // Assert
                expect(mockExit).toHaveBeenCalledWith(1);

                // Cleanup
                mockExit.mockRestore();
            });

            it('should throw error for invalid installer target', async () => {
                // Act & Assert
                await expect(executeBuild('install', 'invalid', buildOptions)).rejects.toThrow(
                    'Invalid installer type: invalid',
                );
            });
        });

        describe('logging', () => {
            it('should set Logger.verbose when verbose option is true', async () => {
                // Arrange
                const {Logger} = await import('./utils/logger');
                const {CLIBuilder} = await import('./builders/cli-builder');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);
                const verboseOptions: BuildOptions = {
                    ...buildOptions,
                    verbose: true,
                };

                // Act
                await executeBuild('cli', 'build', verboseOptions);

                // Assert
                expect(Logger.verbose).toBe(true);
            });

            it('should set Logger.verbose to false when verbose option is false', async () => {
                // Arrange
                const {Logger} = await import('./utils/logger');
                const {CLIBuilder} = await import('./builders/cli-builder');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);
                const nonVerboseOptions: BuildOptions = {
                    ...buildOptions,
                    verbose: false,
                };

                // Act
                await executeBuild('cli', 'build', nonVerboseOptions);

                // Assert
                expect(Logger.verbose).toBe(false);
            });

            it('should log build configuration', async () => {
                // Arrange
                const {Logger} = await import('./utils/logger');
                const {CLIBuilder} = await import('./builders/cli-builder');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);

                // Act
                await executeBuild('cli', 'build', buildOptions);

                // Assert
                expect(Logger.info).toHaveBeenCalledWith('Build configuration:');
                expect(Logger.info).toHaveBeenCalledWith('  Component: cli');
                expect(Logger.info).toHaveBeenCalledWith('  Target: build');
            });

            it('should log success message for CLI build', async () => {
                // Arrange
                const {Logger} = await import('./utils/logger');
                const {CLIBuilder} = await import('./builders/cli-builder');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);

                // Act
                await executeBuild('cli', 'build', buildOptions);

                // Assert
                expect(Logger.success).toHaveBeenCalledWith('CLI build completed successfully');
            });

            it('should log success message for GUI build', async () => {
                // Arrange
                const {Logger} = await import('./utils/logger');
                const {GUIBuilder} = await import('./builders/gui-builder');
                vi.mocked(GUIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);

                // Act
                await executeBuild('gui', 'build', buildOptions);

                // Assert
                expect(Logger.success).toHaveBeenCalledWith('GUI build completed successfully');
            });

            it('should log success message for protobuf generation', async () => {
                // Arrange
                const {Logger} = await import('./utils/logger');
                const {ProtobufBuilder} = await import('./builders/protobuf-builder');
                vi.mocked(ProtobufBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);

                // Act
                await executeBuild('proto', 'build', buildOptions);

                // Assert
                expect(Logger.success).toHaveBeenCalledWith('Protobuf generation completed successfully');
            });
        });

        describe('default values', () => {
            it('should use detected platform when platforms is undefined', async () => {
                // Arrange
                const {detectCurrentPlatform} = await import('./utils/platform-detector');
                const {CLIBuilder} = await import('./builders/cli-builder');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);
                vi.mocked(detectCurrentPlatform).mockReturnValue(Platform.Linux);
                const optionsWithoutPlatforms: BuildOptions = {
                    archs: [Architecture.X64],
                    production: false,
                    verbose: false,
                };

                // Act
                await executeBuild('cli', 'build', optionsWithoutPlatforms);

                // Assert
                expect(detectCurrentPlatform).toHaveBeenCalled();
            });

            it('should use detected architecture when archs is undefined', async () => {
                // Arrange
                const {detectCurrentArchitecture} = await import('./utils/platform-detector');
                const {CLIBuilder} = await import('./builders/cli-builder');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);
                vi.mocked(detectCurrentArchitecture).mockReturnValue(Architecture.ARM64);
                const optionsWithoutArchs: BuildOptions = {
                    platforms: [Platform.Darwin],
                    production: false,
                    verbose: false,
                };

                // Act
                await executeBuild('cli', 'build', optionsWithoutArchs);

                // Assert
                expect(detectCurrentArchitecture).toHaveBeenCalled();
            });
        });

        describe('installer command', () => {
            it('should auto-detect darwin platform and create ForgeInstaller', async () => {
                // Arrange
                const {detectCurrentPlatform} = await import('./utils/platform-detector');
                vi.mocked(detectCurrentPlatform).mockReturnValue(Platform.Darwin);
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);
                const optionsWithoutPlatform: BuildOptions = {
                    archs: [Architecture.X64],
                    production: false,
                    verbose: false,
                };

                // Act
                await executeBuild('installer', '', optionsWithoutPlatform);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledTimes(1);
                expect(ForgeInstaller).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: Platform.Darwin,
                    }),
                );
                expect(mockGenerate).toHaveBeenCalledTimes(1);
            });

            it('should auto-detect windows platform and create ForgeInstaller', async () => {
                // Arrange
                const {detectCurrentPlatform} = await import('./utils/platform-detector');
                vi.mocked(detectCurrentPlatform).mockReturnValue(Platform.Windows);
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);
                const optionsWithoutPlatform: BuildOptions = {
                    archs: [Architecture.X64],
                    production: false,
                    verbose: false,
                };

                // Act
                await executeBuild('installer', '', optionsWithoutPlatform);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledTimes(1);
                expect(ForgeInstaller).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: Platform.Windows,
                    }),
                );
                expect(mockGenerate).toHaveBeenCalledTimes(1);
            });

            it('should auto-detect linux platform and create ForgeInstaller', async () => {
                // Arrange
                const {detectCurrentPlatform} = await import('./utils/platform-detector');
                vi.mocked(detectCurrentPlatform).mockReturnValue(Platform.Linux);
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);
                const optionsWithoutPlatform: BuildOptions = {
                    archs: [Architecture.X64],
                    production: false,
                    verbose: false,
                };

                // Act
                await executeBuild('installer', '', optionsWithoutPlatform);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledTimes(1);
                expect(ForgeInstaller).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: Platform.Linux,
                    }),
                );
                expect(mockGenerate).toHaveBeenCalledTimes(1);
            });

            it('should accept "mac" as platform alias for darwin', async () => {
                // Arrange
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);

                // Act
                await executeBuild('installer', 'mac', buildOptions);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: Platform.Darwin,
                    }),
                );
            });

            it('should accept "win" as platform alias for windows', async () => {
                // Arrange
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);

                // Act
                await executeBuild('installer', 'win', buildOptions);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: Platform.Windows,
                    }),
                );
            });

            it('should accept "linux" as platform alias', async () => {
                // Arrange
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);

                // Act
                await executeBuild('installer', 'linux', buildOptions);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: Platform.Linux,
                    }),
                );
            });

            it('should throw error for invalid installer target', async () => {
                // Act & Assert
                await expect(executeBuild('installer', 'invalid', buildOptions)).rejects.toThrow(
                    "Invalid installer target: 'invalid'",
                );
            });

            it('should pass devMode and retainTempFiles options to installer', async () => {
                // Arrange
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);
                const optionsWithDevMode: BuildOptions = {
                    ...buildOptions,
                    devMode: true,
                    retainTempFiles: true,
                };

                // Act
                await executeBuild('installer', '', optionsWithDevMode);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledWith(
                    expect.objectContaining({
                        devMode: true,
                        retainTempFiles: true,
                    }),
                );
            });

            it('should use platform from options when no target is provided', async () => {
                // Arrange
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);
                const optionsWithPlatform: BuildOptions = {
                    ...buildOptions,
                    platforms: [Platform.Linux],
                };

                // Act
                await executeBuild('installer', '', optionsWithPlatform);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledWith(
                    expect.objectContaining({
                        platform: Platform.Linux,
                    }),
                );
            });
        });

        describe('edge cases', () => {
            it('should handle empty platforms array by passing it through', async () => {
                // Arrange
                const {CLIBuilder} = await import('./builders/cli-builder');
                const mockBuild = vi.fn().mockResolvedValue(undefined);
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = mockBuild;
                } as any);
                const optionsWithEmptyPlatforms: BuildOptions = {
                    platforms: [],
                    archs: [Architecture.X64],
                    production: false,
                    verbose: false,
                };

                // Act
                await executeBuild('cli', 'build', optionsWithEmptyPlatforms);

                // Assert - empty array is passed through (not replaced with detected value)
                expect(mockBuild).toHaveBeenCalledWith(optionsWithEmptyPlatforms);
            });

            it('should handle empty archs array by passing it through', async () => {
                // Arrange
                const {CLIBuilder} = await import('./builders/cli-builder');
                const mockBuild = vi.fn().mockResolvedValue(undefined);
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = mockBuild;
                } as any);
                const optionsWithEmptyArchs: BuildOptions = {
                    platforms: [Platform.Linux],
                    archs: [],
                    production: false,
                    verbose: false,
                };

                // Act
                await executeBuild('cli', 'build', optionsWithEmptyArchs);

                // Assert - empty array is passed through (not replaced with detected value)
                expect(mockBuild).toHaveBeenCalledWith(optionsWithEmptyArchs);
            });

            it('should handle both empty platforms and archs arrays', async () => {
                // Arrange
                const {CLIBuilder} = await import('./builders/cli-builder');
                const mockBuild = vi.fn().mockResolvedValue(undefined);
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = mockBuild;
                } as any);
                const optionsWithEmptyArrays: BuildOptions = {
                    platforms: [],
                    archs: [],
                    production: false,
                    verbose: false,
                };

                // Act
                await executeBuild('cli', 'build', optionsWithEmptyArrays);

                // Assert - empty arrays are passed through
                expect(mockBuild).toHaveBeenCalledWith(optionsWithEmptyArrays);
            });
        });

        describe('build version', () => {
            it('should log build version in configuration summary when buildVersion is set', async () => {
                // Arrange
                const {Logger} = await import('./utils/logger');
                const {CLIBuilder} = await import('./builders/cli-builder');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);
                buildOptions.buildVersion = '1.2.3';

                // Act
                await executeBuild('cli', 'build', buildOptions);

                // Assert
                expect(Logger.info).toHaveBeenCalledWith('  Build version: 1.2.3');
            });

            it('should not log build version when buildVersion is not set', async () => {
                // Arrange
                const {Logger} = await import('./utils/logger');
                const {CLIBuilder} = await import('./builders/cli-builder');
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = vi.fn().mockResolvedValue(undefined);
                } as any);

                // Act
                await executeBuild('cli', 'build', buildOptions);

                // Assert
                const infoCalls = vi.mocked(Logger.info).mock.calls.map(call => call[0]);
                const hasVersionLog = infoCalls.some(msg => typeof msg === 'string' && msg.includes('Build version'));
                expect(hasVersionLog).toBe(false);
            });

            it('should forward buildVersion to CLIBuilder', async () => {
                // Arrange
                const {CLIBuilder} = await import('./builders/cli-builder');
                const mockBuild = vi.fn().mockResolvedValue(undefined);
                vi.mocked(CLIBuilder).mockImplementation(function (this: any) {
                    this.build = mockBuild;
                } as any);
                buildOptions.buildVersion = '2.0.0';

                // Act
                await executeBuild('cli', 'build', buildOptions);

                // Assert
                expect(mockBuild).toHaveBeenCalledWith(expect.objectContaining({buildVersion: '2.0.0'}));
            });

            it('should forward buildVersion to ForgeInstaller', async () => {
                // Arrange
                const {ForgeInstaller} = await import('./installers/forge-installer');
                const mockGenerate = vi.fn().mockResolvedValue(undefined);
                vi.mocked(ForgeInstaller).mockImplementation(function (this: any) {
                    this.generate = mockGenerate;
                } as any);
                buildOptions.buildVersion = '3.0.0';

                // Act
                await executeBuild('installer', '', buildOptions);

                // Assert
                expect(ForgeInstaller).toHaveBeenCalledWith(expect.objectContaining({buildVersion: '3.0.0'}));
            });
        });
    });
});
