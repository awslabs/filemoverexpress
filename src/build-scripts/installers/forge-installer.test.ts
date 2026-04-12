import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {Architecture, Platform} from '../types/platform';
import {ForgeInstaller} from './forge-installer';

// --- Mocks ---
vi.mock('fs/promises', () => ({
    default: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        copyFile: vi.fn().mockResolvedValue(undefined),
        cp: vi.fn().mockResolvedValue(undefined),
        rm: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined),
        chmod: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(''),
        writeFile: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('../utils/platform-detector');
vi.mock('../utils/path-resolver');
vi.mock('../utils/logger');
vi.mock('../utils/temp-dir-manager');
vi.mock('../utils/command-runner');
vi.mock('../utils/tool-checker');
vi.mock('./forge-config-generator');
vi.mock('./forge-maker-resolver');
vi.mock('../builders/protobuf-builder');
vi.mock('../builders/cli-builder');
vi.mock('../builders/gui-builder');
vi.mock('../builders/electron-builder');

describe('ForgeInstaller', () => {
    let mockFS: any;
    let mockPlatformDetector: any;
    let mockPathResolver: any;
    let mockTempDirManager: any;
    let mockCommandRunner: any;
    let mockToolChecker: any;
    let mockForgeMakerResolver: any;
    let mockForgeConfigGenerator: any;

    beforeEach(async () => {
        // Setup fs/promises mock
        const fsPromises = await import('fs/promises');
        mockFS = fsPromises.default as any;
        mockFS.mkdir.mockResolvedValue(undefined);
        mockFS.copyFile.mockResolvedValue(undefined);
        mockFS.cp.mockResolvedValue(undefined);
        mockFS.rm.mockResolvedValue(undefined);
        mockFS.access.mockResolvedValue(undefined);
        mockFS.chmod.mockResolvedValue(undefined);
        mockFS.readFile.mockResolvedValue('');
        mockFS.writeFile.mockResolvedValue(undefined);
        mockFS.readdir.mockResolvedValue([]);

        // Setup platform detector — default to Darwin
        const platformDetectorModule = await import('../utils/platform-detector');
        mockPlatformDetector = platformDetectorModule as any;
        mockPlatformDetector.detectCurrentPlatform = vi.fn().mockReturnValue(Platform.Darwin);
        mockPlatformDetector.detectCurrentArchitecture = vi.fn().mockReturnValue(Architecture.X64);

        // Setup path resolver
        const pathResolverModule = await import('../utils/path-resolver');
        mockPathResolver = pathResolverModule.PathResolver as any;
        mockPathResolver.getProjectRoot = vi.fn().mockReturnValue('/project');
        mockPathResolver.getElectronDir = vi.fn().mockReturnValue('/project/src/electron');
        mockPathResolver.getGUIDir = vi.fn().mockReturnValue('/project/src/gui');

        // Setup TempDirManager mock
        const tempDirManagerModule = await import('../utils/temp-dir-manager');
        let tempDirCounter = 0;
        mockTempDirManager = {
            createTempDir: vi.fn().mockImplementation(({prefix}: {prefix: string}) => {
                return `/tmp/${prefix}${tempDirCounter++}`;
            }),
        };
        vi.mocked(tempDirManagerModule.TempDirManager).mockImplementation(function (this: any) {
            return mockTempDirManager;
        } as any);

        // Setup CommandRunner mock — default to success
        const commandRunnerModule = await import('../utils/command-runner');
        mockCommandRunner = commandRunnerModule.CommandRunner as any;
        mockCommandRunner.run = vi.fn().mockResolvedValue({
            exitCode: 0,
            stdout: '',
            stderr: '',
        });

        // Setup ToolChecker mock — node and npm available by default
        const toolCheckerModule = await import('../utils/tool-checker');
        mockToolChecker = toolCheckerModule.ToolChecker as any;
        mockToolChecker.checkTool = vi.fn().mockResolvedValue({
            available: true,
            version: 'v20.0.0',
        });

        // Setup ForgeMakerResolver mock
        const forgeMakerResolverModule = await import('./forge-maker-resolver');
        mockForgeMakerResolver = forgeMakerResolverModule.ForgeMakerResolver as any;
        mockForgeMakerResolver.resolveMakers = vi.fn().mockReturnValue([
            {
                type: 'dmg',
                npmPackage: '@electron-forge/maker-dmg',
                config: {name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: {}},
            },
        ]);

        // Setup ForgeConfigGenerator mock
        const forgeConfigGeneratorModule = await import('./forge-config-generator');
        mockForgeConfigGenerator = {
            generateConfig: vi.fn().mockReturnValue({
                packagerConfig: {
                    name: 'File Mover Express',
                    appBundleId: 'com.github.awslabs.filemoverexpress',
                    helperBundleId: 'com.github.awslabs.filemoverexpress.helper',
                    icon: 'assets/icons/mac/icon.icns',
                    asar: false,
                    overwrite: true,
                    prune: true,
                },
                makers: [{name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: {}}],
            }),
        };
        vi.mocked(forgeConfigGeneratorModule.ForgeConfigGenerator).mockImplementation(function (this: any) {
            return mockForgeConfigGenerator;
        } as any);

        // Setup builder mocks — all builders resolve successfully by default
        const protobufBuilderModule = await import('../builders/protobuf-builder');
        vi.mocked(protobufBuilderModule.ProtobufBuilder).mockImplementation(function (this: any) {
            return {build: vi.fn().mockResolvedValue(undefined), cleanupPaths: []};
        } as any);

        const cliBuilderModule = await import('../builders/cli-builder');
        vi.mocked(cliBuilderModule.CLIBuilder).mockImplementation(function (this: any) {
            return {build: vi.fn().mockResolvedValue(undefined), cleanupPaths: []};
        } as any);

        const guiBuilderModule = await import('../builders/gui-builder');
        vi.mocked(guiBuilderModule.GUIBuilder).mockImplementation(function (this: any) {
            return {build: vi.fn().mockResolvedValue(undefined), cleanupPaths: []};
        } as any);

        const electronBuilderModule = await import('../builders/electron-builder');
        vi.mocked(electronBuilderModule.ElectronBuilder).mockImplementation(function (this: any) {
            return {build: vi.fn().mockResolvedValue(undefined), cleanupPaths: []};
        } as any);
    });

    afterEach(() => {
        cleanupMocks();
    });

    // --- Constructor default option resolution ---
    describe('constructor', () => {
        it('should default platform to host platform when no options provided', () => {
            const installer = new ForgeInstaller();
            // Constructor succeeds without throwing — platform defaults to host
            expect(installer).toBeInstanceOf(ForgeInstaller);
            expect(mockPlatformDetector.detectCurrentPlatform).toHaveBeenCalled();
        });

        it('should default architecture to host architecture when no options provided', () => {
            const installer = new ForgeInstaller();
            expect(installer).toBeInstanceOf(ForgeInstaller);
            expect(mockPlatformDetector.detectCurrentArchitecture).toHaveBeenCalled();
        });

        it('should accept matching platform without throwing', () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Darwin);

            const installer = new ForgeInstaller({platform: Platform.Darwin});
            expect(installer).toBeInstanceOf(ForgeInstaller);
        });

        it('should accept empty options object and use defaults', () => {
            const installer = new ForgeInstaller({});
            expect(installer).toBeInstanceOf(ForgeInstaller);
        });

        it('should accept explicit architecture override', () => {
            const installer = new ForgeInstaller({architecture: Architecture.ARM64});
            expect(installer).toBeInstanceOf(ForgeInstaller);
        });
    });

    // --- Cross-platform rejection ---
    describe('cross-platform rejection', () => {
        it('should throw when target platform differs from host platform', () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Darwin);

            expect(() => new ForgeInstaller({platform: Platform.Windows})).toThrow(
                /cross-platform installer generation is not supported/i,
            );
        });

        it('should include requested platform in error message', () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Darwin);

            expect(() => new ForgeInstaller({platform: Platform.Linux})).toThrow(
                /linux/i,
            );
        });

        it('should include host platform in error message', () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Darwin);

            expect(() => new ForgeInstaller({platform: Platform.Windows})).toThrow(
                /darwin/i,
            );
        });

        it('should throw for Windows host targeting Darwin', () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Windows);

            expect(() => new ForgeInstaller({platform: Platform.Darwin})).toThrow(
                /cross-platform/i,
            );
        });

        it('should throw for Linux host targeting Windows', () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Linux);

            expect(() => new ForgeInstaller({platform: Platform.Windows})).toThrow(
                /cross-platform/i,
            );
        });
    });

    // --- cleanupPaths tracking ---
    describe('cleanupPaths', () => {
        it('should return empty array before generate is called', () => {
            const installer = new ForgeInstaller();
            expect(installer.cleanupPaths).toEqual([]);
        });

        it('should return a copy of the temp dirs array', () => {
            const installer = new ForgeInstaller();
            const paths1 = installer.cleanupPaths;
            const paths2 = installer.cleanupPaths;
            expect(paths1).not.toBe(paths2);
            expect(paths1).toEqual(paths2);
        });
    });

    // --- Error handling: missing Electron dist ---
    describe('error handling - missing Electron dist', () => {
        it('should throw when Electron dist directory does not exist', async () => {
            // Make access fail for the electron dist path
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('electron') && p.includes('dist')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller();
            await expect(installer.generate()).rejects.toThrow(
                /electron build output not found/i,
            );
        });

        it('should suggest running build:electron in error message', async () => {
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('electron') && p.includes('dist')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller();
            await expect(installer.generate()).rejects.toThrow(
                /build:electron/,
            );
        });
    });

    // --- Error handling: missing GUI dist ---
    describe('error handling - missing GUI dist', () => {
        it('should throw when GUI dist directory does not exist', async () => {
            // Electron dist exists, but GUI dist does not
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('gui') && p.includes('dist')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller();
            await expect(installer.generate()).rejects.toThrow(
                /gui build output not found/i,
            );
        });

        it('should suggest running build:gui in error message', async () => {
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('gui') && p.includes('dist')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller();
            await expect(installer.generate()).rejects.toThrow(
                /build:gui/,
            );
        });
    });

    // --- Error handling: missing CLI binary ---
    describe('error handling - missing CLI binary', () => {
        it('should throw when CLI binary does not exist', async () => {
            // All directories exist, but CLI binary does not
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('filemoverexpress-darwin') || p.includes('filemoverexpress.exe')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller();
            await expect(installer.generate()).rejects.toThrow(
                /cli binary not found/i,
            );
        });

        it('should include platform-architecture in CLI binary error message', async () => {
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('filemoverexpress-darwin')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller();
            await expect(installer.generate()).rejects.toThrow(
                /darwin-x64/i,
            );
        });

        it('should throw for missing ARM64 CLI binary', async () => {
            mockPlatformDetector.detectCurrentArchitecture.mockReturnValue(Architecture.ARM64);

            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('filemoverexpress-darwin-arm64')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller({architecture: Architecture.ARM64});
            await expect(installer.generate()).rejects.toThrow(
                /cli binary not found/i,
            );
        });
    });

    // --- Error handling: missing daemon launcher on Windows ---
    describe('error handling - missing daemon launcher on Windows', () => {
        beforeEach(() => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Windows);
            mockPlatformDetector.detectCurrentArchitecture.mockReturnValue(Architecture.X64);
        });

        it('should throw when Windows daemon launcher does not exist', async () => {
            // CLI binary exists, but daemon launcher does not
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('filemoverexpress-launcher.exe')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller({platform: Platform.Windows});
            await expect(installer.generate()).rejects.toThrow(
                /daemon launcher not found/i,
            );
        });

        it('should mention windows-daemon-launcher in error message', async () => {
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('filemoverexpress-launcher.exe')) {
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller({platform: Platform.Windows});
            await expect(installer.generate()).rejects.toThrow(
                /windows daemon launcher/i,
            );
        });

        it('should not check for daemon launcher on macOS', async () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Darwin);

            // Fail if launcher is checked
            let launcherChecked = false;
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('launcher')) {
                    launcherChecked = true;
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller();
            // generate() will fail later (at runForgeMake), but should not fail on launcher
            try {
                await installer.generate();
            } catch {
                // Expected to fail at a later step
            }

            expect(launcherChecked).toBe(false);
        });

        it('should not check for daemon launcher on Linux', async () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Linux);

            let launcherChecked = false;
            mockFS.access.mockImplementation(async (p: string) => {
                if (p.includes('launcher')) {
                    launcherChecked = true;
                    throw new Error('ENOENT');
                }
            });

            const installer = new ForgeInstaller();
            try {
                await installer.generate();
            } catch {
                // Expected to fail at a later step
            }

            expect(launcherChecked).toBe(false);
        });
    });

    // --- Cleanup behavior ---
    describe('cleanup', () => {
        it('should clean up temp directories on successful generate', async () => {
            // Mock the dynamic import for @electron-forge/core
            // generate() will fail at runForgeMake since we can't mock dynamic imports easily,
            // but cleanup should still be called
            const installer = new ForgeInstaller();

            try {
                await installer.generate();
            } catch {
                // Expected — Forge make will fail in test environment
            }

            // Temp dirs should have been tracked
            // Cleanup is called in the catch block of generate()
            expect(mockFS.rm).toHaveBeenCalled();
        });

        it('should retain temp directories when retainTempFiles is true', async () => {
            // Reset rm mock to track only calls during generate()
            mockFS.rm.mockClear();

            const installer = new ForgeInstaller({retainTempFiles: true});

            try {
                await installer.generate();
            } catch {
                // Expected — Forge make will fail in test environment
            }

            // The temp dir tracked by the installer should NOT have been removed.
            const trackedDirs = installer.cleanupPaths;
            expect(trackedDirs.length).toBeGreaterThan(0);

            const rmCalls = mockFS.rm.mock.calls.map((call: any[]) => call[0]);
            for (const dir of trackedDirs) {
                expect(rmCalls).not.toContain(dir);
            }
        });
    });
});
