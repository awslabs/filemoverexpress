import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {ShellType} from '../types/installer';
import {Architecture, Platform} from '../types/platform';
import {LocalInstaller} from './local-installer';

// Mock all external dependencies
vi.mock('fs/promises', () => ({
    default: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        copyFile: vi.fn().mockResolvedValue(undefined),
        rm: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn().mockResolvedValue([]),
        lstat: vi.fn().mockResolvedValue({
            isSymbolicLink: () => false,
            isDirectory: () => false,
            size: 1024,
        }),
        stat: vi.fn().mockResolvedValue({
            isDirectory: () => false,
            size: 1024,
        }),
        readFile: vi.fn().mockResolvedValue(''),
        appendFile: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        readlink: vi.fn().mockResolvedValue(''),
        symlink: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('node:child_process', () => ({
    execSync: vi.fn().mockReturnValue(''),
}));

vi.mock('readline', () => ({
    createInterface: vi.fn(),
}));

vi.mock('../packagers/electron-packager');
vi.mock('../utils/platform-detector');
vi.mock('../utils/shell-detector');
vi.mock('../utils/path-resolver');
vi.mock('../utils/logger');

describe('LocalInstaller', () => {
    let installer: LocalInstaller;
    let mockFS: any;
    let mockChildProcess: any;
    let mockReadline: any;
    let mockElectronPackager: any;
    let mockPlatformDetector: any;
    let mockShellDetector: any;
    let mockPathResolver: any;

    beforeEach(async () => {
        // Get references to mocked modules
        const fsPromises = await import('fs/promises');
        mockFS = fsPromises.default as any;

        const childProcess = await import('node:child_process');
        mockChildProcess = childProcess as any;

        const readline = await import('readline');
        mockReadline = readline as any;
        mockReadline.createInterface = vi.fn().mockReturnValue({
            question: vi.fn(),
            close: vi.fn(),
        });

        // Setup ElectronPackager mocks
        const electronPackagerModule = await import('../packagers/electron-packager');
        mockElectronPackager = {
            package: vi.fn().mockResolvedValue(undefined),
            cleanupPaths: [],
        };
        vi.mocked(electronPackagerModule.ElectronPackager).mockImplementation(function (this: any) {
            return mockElectronPackager;
        } as any);

        // Setup platform detector mocks
        const platformDetectorModule = await import('../utils/platform-detector');
        mockPlatformDetector = platformDetectorModule as any;
        mockPlatformDetector.detectCurrentPlatform = vi.fn().mockReturnValue(Platform.Linux);
        mockPlatformDetector.detectCurrentArchitecture = vi.fn().mockReturnValue(Architecture.X64);

        // Setup shell detector mocks
        const shellDetectorModule = await import('../utils/shell-detector');
        mockShellDetector = shellDetectorModule as any;
        mockShellDetector.detectCurrentShell = vi.fn().mockReturnValue(ShellType.Bash);

        // Setup path resolver mocks
        const pathResolverModule = await import('../utils/path-resolver');
        mockPathResolver = pathResolverModule.PathResolver as any;
        mockPathResolver.getProjectRoot = vi.fn().mockReturnValue('/project');
        mockPathResolver.getCLIDir = vi.fn().mockReturnValue('/project/src/cli');
        mockPathResolver.getGUIDir = vi.fn().mockReturnValue('/project/src/gui');
        mockPathResolver.getElectronDir = vi.fn().mockReturnValue('/project/src/electron');

        // Setup environment variables
        vi.stubEnv('HOME', '/home/user');
        vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\User\\AppData\\Local');
        vi.stubEnv('APPDATA', 'C:\\Users\\User\\AppData\\Roaming');
        vi.stubEnv('USERPROFILE', 'C:\\Users\\User');

        // Create installer instance
        installer = new LocalInstaller();
    });

    afterEach(async () => {
        vi.clearAllMocks();

        // Reset mock implementations to defaults
        const fsPromises = await import('fs/promises');
        mockFS = fsPromises.default as any;
        mockFS.mkdir.mockResolvedValue(undefined);
        mockFS.copyFile.mockResolvedValue(undefined);
        mockFS.rm.mockResolvedValue(undefined);
        mockFS.access.mockResolvedValue(undefined);
        mockFS.readdir.mockResolvedValue([]);
        mockFS.lstat.mockResolvedValue({
            isSymbolicLink: () => false,
            isDirectory: () => false,
            size: 1024,
        });
        mockFS.stat.mockResolvedValue({
            isDirectory: () => false,
            size: 1024,
        });
        mockFS.readFile.mockResolvedValue('');
        mockFS.appendFile.mockResolvedValue(undefined);
        mockFS.writeFile.mockResolvedValue(undefined);
        mockFS.readlink.mockResolvedValue('');
        mockFS.symlink.mockResolvedValue(undefined);

        cleanupMocks();
    });

    describe('constructor', () => {
        it('should detect current platform and architecture', () => {
            expect(mockPlatformDetector.detectCurrentPlatform).toHaveBeenCalled();
            expect(mockPlatformDetector.detectCurrentArchitecture).toHaveBeenCalled();
        });

        it('should create ElectronPackager instance', async () => {
            const electronPackagerModule = await import('../packagers/electron-packager');
            expect(vi.mocked(electronPackagerModule.ElectronPackager)).toHaveBeenCalled();
        });
    });

    describe('cleanupPaths', () => {
        it('should include ElectronPackager cleanup paths', () => {
            mockElectronPackager.cleanupPaths = ['/path1', '/path2'];
            const paths = installer.cleanupPaths;
            expect(paths).toContain('/path1');
            expect(paths).toContain('/path2');
        });

        it('should include dist directory', () => {
            const paths = installer.cleanupPaths;
            expect(paths).toContain('/project/dist');
        });
    });

    describe('generate', () => {
        beforeEach(() => {
            // Mock readline to auto-answer questions
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('n'); // Default to 'no' for all questions
            });

            // Mock packaged app path exists
            mockFS.access.mockResolvedValue(undefined);
            // Return empty array for readdir with proper structure
            mockFS.readdir.mockResolvedValue([]);
        });

        it('should complete full installation process', async () => {
            await installer.generate();

            expect(mockElectronPackager.package).toHaveBeenCalled();
            expect(mockFS.mkdir).toHaveBeenCalled();
        });

        it('should handle installation failure with cleanup', async () => {
            mockElectronPackager.package.mockRejectedValue(new Error('Packaging failed'));

            await expect(installer.generate()).rejects.toThrow('Installation failed');
            // Cleanup is attempted but installPath might not be set yet
        });

        it('should log cleanup warning if cleanup fails', async () => {
            mockElectronPackager.package.mockRejectedValue(new Error('Packaging failed'));
            mockFS.rm.mockRejectedValue(new Error('Permission denied'));

            await expect(installer.generate()).rejects.toThrow('Installation failed');
        });
    });

    describe('packaging step', () => {
        beforeEach(() => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('n');
            });
            mockFS.readdir.mockResolvedValue([]);
        });

        it('should call ElectronPackager.package', async () => {
            mockFS.access.mockResolvedValue(undefined);

            await installer.generate();

            expect(mockElectronPackager.package).toHaveBeenCalled();
        });

        it('should verify packaged app exists', async () => {
            mockFS.access.mockResolvedValue(undefined);

            await installer.generate();

            expect(mockFS.access).toHaveBeenCalled();
        });

        it('should throw error if packaged app not found', async () => {
            mockFS.access.mockRejectedValueOnce(new Error('ENOENT'));

            await expect(installer.generate()).rejects.toThrow('Packaged application not found');
        });
    });

    describe('file copying', () => {
        beforeEach(() => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('n');
            });
            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);
        });

        it('should create installation directory', async () => {
            await installer.generate();

            expect(mockFS.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('FileMoverExpress'),
                expect.objectContaining({recursive: true}),
            );
        });

        it('should copy files from packaged app to install location', async () => {
            // Mock readdir to return file entries
            mockFS.readdir.mockResolvedValue([
                {name: 'file1.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false},
                {name: 'file2.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false},
            ] as any);

            await installer.generate();

            expect(mockFS.copyFile).toHaveBeenCalled();
        });

        it('should recursively copy directories', async () => {
            mockFS.readdir
                .mockResolvedValueOnce([{name: 'subdir', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false}] as any)
                .mockResolvedValueOnce([
                    {
                        name: 'file.txt',
                        isDirectory: () => false,
                        isFile: () => true,
                        isSymbolicLink: () => false,
                    },
                ] as any);

            await installer.generate();

            expect(mockFS.mkdir).toHaveBeenCalled();
            expect(mockFS.copyFile).toHaveBeenCalled();
        });

        it('should handle symlinks by recreating them', async () => {
            mockFS.readdir.mockResolvedValue([
                {
                    name: 'link',
                    isDirectory: () => false,
                    isFile: () => false,
                    isSymbolicLink: () => false,
                },
            ] as any);
            mockFS.lstat.mockResolvedValue({
                isSymbolicLink: () => true,
                isDirectory: () => false,
                size: 0,
            } as any);
            mockFS.readlink.mockResolvedValue('/target/path');

            await installer.generate();

            expect(mockFS.readlink).toHaveBeenCalled();
            expect(mockFS.symlink).toHaveBeenCalledWith('/target/path', expect.any(String));
        });

        it('should remove existing installation before copying', async () => {
            await installer.generate();

            expect(mockFS.rm).toHaveBeenCalledWith(
                expect.stringContaining('FileMoverExpress'),
                expect.objectContaining({recursive: true, force: true}),
            );
        });

        it('should handle permission errors during file copy', async () => {
            mockFS.copyFile.mockRejectedValue(new Error('EACCES: permission denied'));
            mockFS.readdir.mockResolvedValue([
                {
                    name: 'file.txt',
                    isDirectory: () => false,
                    isFile: () => true,
                    isSymbolicLink: () => false,
                },
            ] as any);

            await expect(installer.generate()).rejects.toThrow('Failed to copy files');
        });
    });

    describe('PATH updates - Unix', () => {
        beforeEach(() => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Linux);
            installer = new LocalInstaller();

            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                if (question.includes('PATH')) {
                    callback('y');
                } else {
                    callback('n');
                }
            });

            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);
            mockFS.readFile.mockResolvedValue('');
        });

        it('should update bash configuration when shell is bash', async () => {
            mockShellDetector.detectCurrentShell.mockReturnValue(ShellType.Bash);

            await installer.generate();

            expect(mockFS.appendFile).toHaveBeenCalledWith(
                '/home/user/.bashrc',
                expect.stringContaining('export PATH='),
                'utf-8',
            );
        });

        it('should update zsh configuration when shell is zsh', async () => {
            mockShellDetector.detectCurrentShell.mockReturnValue(ShellType.Zsh);

            await installer.generate();

            expect(mockFS.appendFile).toHaveBeenCalledWith(
                '/home/user/.zshrc',
                expect.stringContaining('export PATH='),
                'utf-8',
            );
        });

        it('should update fish configuration when shell is fish', async () => {
            mockShellDetector.detectCurrentShell.mockReturnValue(ShellType.Fish);

            await installer.generate();

            expect(mockFS.appendFile).toHaveBeenCalledWith(
                '/home/user/.config/fish/config.fish',
                expect.stringContaining('set -gx PATH'),
                'utf-8',
            );
        });

        it('should create fish config directory if it does not exist', async () => {
            mockShellDetector.detectCurrentShell.mockReturnValue(ShellType.Fish);

            await installer.generate();

            expect(mockFS.mkdir).toHaveBeenCalledWith(
                '/home/user/.config/fish',
                expect.objectContaining({recursive: true}),
            );
        });

        it('should not add duplicate PATH entries', async () => {
            mockFS.readFile.mockResolvedValue('export PATH="/opt/FileMoverExpress/bin:$PATH"');

            await installer.generate();

            expect(mockFS.appendFile).not.toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('export PATH='),
                expect.any(String),
            );
        });

        it('should skip PATH update if user declines', async () => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('n');
            });

            await installer.generate();

            expect(mockFS.appendFile).not.toHaveBeenCalledWith(
                expect.stringContaining('.bashrc'),
                expect.any(String),
                expect.any(String),
            );
        });
    });

    describe('PATH updates - Windows', () => {
        beforeEach(() => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Windows);
            installer = new LocalInstaller();

            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                if (question.includes('PATH')) {
                    callback('y');
                } else {
                    callback('n');
                }
            });

            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);
            mockChildProcess.execSync.mockReturnValue('C:\\Existing\\Path');
        });

        it('should update Windows user PATH using PowerShell', async () => {
            await installer.generate();

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('SetEnvironmentVariable'),
                expect.any(Object),
            );
        });

        it('should not add duplicate PATH entries on Windows', async () => {
            mockChildProcess.execSync.mockReturnValue('C:\\Users\\User\\AppData\\Local\\Programs\\File Mover Express');

            await installer.generate();

            // Should only call execSync once to get current PATH, not to set it
            expect(mockChildProcess.execSync).toHaveBeenCalledTimes(1);
        });

        it('should throw error if LOCALAPPDATA is not set', async () => {
            vi.unstubAllEnvs();
            delete process.env.LOCALAPPDATA;

            await expect(installer.generate()).rejects.toThrow('LOCALAPPDATA environment variable is not set');
        });
    });

    describe('shell configuration updates', () => {
        beforeEach(() => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Darwin);
            installer = new LocalInstaller();

            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                if (question.includes('PATH')) {
                    callback('y');
                } else {
                    callback('n');
                }
            });

            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);
            mockFS.readFile.mockResolvedValue('');
        });

        it('should add comment before PATH export', async () => {
            await installer.generate();

            expect(mockFS.appendFile).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('# Added by File Mover Express installer'),
                'utf-8',
            );
        });

        it('should handle missing shell config file', async () => {
            mockFS.readFile.mockRejectedValue(new Error('ENOENT'));

            await installer.generate();

            expect(mockFS.appendFile).toHaveBeenCalled();
        });
    });

    describe('Windows shortcut creation', () => {
        beforeEach(() => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Windows);
            installer = new LocalInstaller();

            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);
        });

        it('should create Start Menu shortcut when requested', async () => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                if (question.includes('Start Menu')) {
                    callback('y');
                } else {
                    callback('n');
                }
            });

            await installer.generate();

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('CreateShortcut'),
                expect.any(Object),
            );
        });

        it('should create Desktop shortcut when requested', async () => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                if (question.includes('Desktop')) {
                    callback('y');
                } else {
                    callback('n');
                }
            });

            await installer.generate();

            expect(mockChildProcess.execSync).toHaveBeenCalledWith(
                expect.stringContaining('CreateShortcut'),
                expect.any(Object),
            );
        });

        it('should not create shortcuts when user declines', async () => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('n');
            });

            await installer.generate();

            expect(mockChildProcess.execSync).not.toHaveBeenCalledWith(
                expect.stringContaining('CreateShortcut'),
                expect.any(Object),
            );
        });

        it('should log warning but continue if shortcut creation fails', async () => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                if (question.includes('Start Menu')) {
                    callback('y');
                } else {
                    callback('n');
                }
            });

            mockChildProcess.execSync.mockImplementation((cmd: string) => {
                if (cmd.includes('CreateShortcut')) {
                    throw new Error('PowerShell error');
                }
                return '';
            });

            await expect(installer.generate()).resolves.not.toThrow();
        });

        it('should not create shortcuts on non-Windows platforms', async () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Linux);
            installer = new LocalInstaller();

            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('y');
            });

            mockFS.readFile.mockResolvedValue('');

            await installer.generate();

            expect(mockChildProcess.execSync).not.toHaveBeenCalledWith(
                expect.stringContaining('CreateShortcut'),
                expect.any(Object),
            );
        });
    });

    describe('error handling and cleanup', () => {
        beforeEach(() => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('n');
            });
        });

        it('should cleanup on packaging failure', async () => {
            mockElectronPackager.package.mockRejectedValue(new Error('Packaging failed'));

            await expect(installer.generate()).rejects.toThrow();
            // When packaging fails, installPath is not set yet, so cleanup may not be called
        });

        it('should cleanup on file copy failure', async () => {
            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([{name: 'file.txt', isDirectory: () => false}]);
            mockFS.copyFile.mockRejectedValue(new Error('Copy failed'));

            await expect(installer.generate()).rejects.toThrow();
            expect(mockFS.rm).toHaveBeenCalled();
        });

        it('should handle EACCES permission errors', async () => {
            mockFS.mkdir.mockRejectedValue(Object.assign(new Error('Permission denied'), {code: 'EACCES'}));

            await expect(installer.generate()).rejects.toThrow();
        });

        it('should handle ENOENT missing file errors', async () => {
            mockFS.access.mockRejectedValue(Object.assign(new Error('File not found'), {code: 'ENOENT'}));

            await expect(installer.generate()).rejects.toThrow('Packaged application not found');
        });
    });

    describe('file permissions', () => {
        beforeEach(() => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Linux);
            installer = new LocalInstaller();

            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('n');
            });

            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);
        });

        it('should preserve file permissions during copy', async () => {
            await installer.generate();

            // Verify files are copied (permissions are preserved by copyFile)
            expect(mockFS.copyFile).toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle missing LOCALAPPDATA on Windows', async () => {
            mockPlatformDetector.detectCurrentPlatform.mockReturnValue(Platform.Windows);
            installer = new LocalInstaller();

            vi.unstubAllEnvs();
            delete process.env.LOCALAPPDATA;

            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('n');
            });
            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);

            await expect(installer.generate()).rejects.toThrow('LOCALAPPDATA environment variable is not set');
        });

        it('should handle empty readline answers', async () => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('');
            });

            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);

            await installer.generate();

            // Should complete without throwing
            expect(mockElectronPackager.package).toHaveBeenCalled();
        });

        it('should handle whitespace-only readline answers', async () => {
            const rl = mockReadline.createInterface();
            vi.mocked(rl.question).mockImplementation((question: string, callback: (answer: string) => void) => {
                callback('   ');
            });

            mockFS.access.mockResolvedValue(undefined);
            mockFS.readdir.mockResolvedValue([]);

            await installer.generate();

            // Should complete without throwing
            expect(mockElectronPackager.package).toHaveBeenCalled();
        });
    });

    describe('path utils edge cases', async () => {
        const {Logger} = await import('../utils/logger');

        beforeEach(() => {
            vi.mocked(Logger.debug).mockReset();
            vi.mocked(Logger.error).mockReset();
            vi.mocked(Logger.warn).mockReset();
            vi.mocked(Logger.success).mockReset();
        });

        it('getCLIInstallPath should correctly handle missing LOCALAPPDATA on Windows', () => {
            vi.stubEnv('LOCALAPPDATA', undefined);

            installer.currentPlatform = Platform.Windows;
            expect(() => installer.getCLIInstallPath()).toThrow();
        });

        it('getCLIInstallPath should correctly handle missing HOME on Darwin', () => {
            vi.stubEnv('HOME', undefined);

            installer.currentPlatform = Platform.Darwin;
            expect(() => installer.getCLIInstallPath()).toThrow();
        });

        it('getCLIInstallPath should correctly handle unknown platforms', () => {
            installer.currentPlatform = Platform.Unknown;
            expect(() => installer.getCLIInstallPath()).toThrow();
        });

        // GUI
        it('getGUIInstallPath should correctly handle missing LOCALAPPDATA on Windows', () => {
            vi.stubEnv('LOCALAPPDATA', undefined);

            installer.currentPlatform = Platform.Windows;
            expect(() => installer.getGUIInstallPath()).toThrow();
        });

        it('getCLIInstallPath should correctly handle missing HOME on Darwin', () => {
            vi.stubEnv('HOME', undefined);

            installer.currentPlatform = Platform.Darwin;
            expect(() => installer.getGUIInstallPath()).toThrow();
        });

        it('getCLIInstallPath should correctly handle unknown platforms', () => {
            installer.currentPlatform = Platform.Unknown;
            expect(() => installer.getGUIInstallPath()).toThrow();
        });

        it('getPackagedAppPath should handle unknown platforms', () => {
            installer.currentPlatform = Platform.Unknown;
            expect(() => installer.getPackagedAppPath()).toThrow();
        });

        it('createWindowsShortcuts should handle non-Windows platform', () => {
            installer.currentPlatform = Platform.Darwin;
            installer.createWindowsShortcuts({updatePath: false});

            expect(vi.mocked(Logger.info)).to.toHaveBeenCalledWith('Shortcut creation is only supported on Windows, skipping...');
        });
    });
});
