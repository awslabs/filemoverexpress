import {describe, expect, it} from 'vitest';
import type {
    FileCopyRecord,
    InstallationReport,
    PathModification,
    ShellConfigModification,
    ShortcutRecord,
    SystemConfigOptions,
} from './installer';
import {ShellType} from './installer';
import {Architecture, Platform} from './platform';

describe('installer types', () => {
    describe('ShellType enum', () => {
        it('should have Bash value', () => {
            expect(ShellType.Bash).toBe('bash');
        });

        it('should have Zsh value', () => {
            expect(ShellType.Zsh).toBe('zsh');
        });

        it('should have Fish value', () => {
            expect(ShellType.Fish).toBe('fish');
        });

        it('should have exactly 3 shell type values', () => {
            const values = Object.values(ShellType);
            expect(values).toHaveLength(3);
        });

        it('should contain all expected shell type values', () => {
            const values = Object.values(ShellType);
            expect(values).toContain('bash');
            expect(values).toContain('zsh');
            expect(values).toContain('fish');
        });
    });

    describe('SystemConfigOptions', () => {
        it('should accept valid SystemConfigOptions with updatePath only', () => {
            const options: SystemConfigOptions = {
                updatePath: true,
            };
            expect(options.updatePath).toBe(true);
        });

        it('should accept SystemConfigOptions with all properties', () => {
            const options: SystemConfigOptions = {
                updatePath: true,
                createStartMenuShortcut: true,
                createDesktopShortcut: false,
            };
            expect(options.updatePath).toBe(true);
            expect(options.createStartMenuShortcut).toBe(true);
            expect(options.createDesktopShortcut).toBe(false);
        });

        it('should accept SystemConfigOptions with optional properties undefined', () => {
            const options: SystemConfigOptions = {
                updatePath: false,
                createStartMenuShortcut: undefined,
                createDesktopShortcut: undefined,
            };
            expect(options.updatePath).toBe(false);
            expect(options.createStartMenuShortcut).toBeUndefined();
        });
    });

    describe('FileCopyRecord', () => {
        it('should accept valid FileCopyRecord', () => {
            const record: FileCopyRecord = {
                source: '/src/file.txt',
                destination: '/dest/file.txt',
                size: 1024,
            };
            expect(record.source).toBe('/src/file.txt');
            expect(record.destination).toBe('/dest/file.txt');
            expect(record.size).toBe(1024);
        });
    });

    describe('PathModification', () => {
        it('should accept valid PathModification with user type', () => {
            const modification: PathModification = {
                type: 'user',
                previousValue: '/usr/bin',
                newValue: '/usr/bin:/usr/local/bin',
            };
            expect(modification.type).toBe('user');
            expect(modification.previousValue).toBe('/usr/bin');
            expect(modification.newValue).toBe('/usr/bin:/usr/local/bin');
        });

        it('should accept valid PathModification with system type', () => {
            const modification: PathModification = {
                type: 'system',
                previousValue: '/usr/bin',
                newValue: '/usr/bin:/usr/local/bin',
            };
            expect(modification.type).toBe('system');
        });
    });

    describe('ShortcutRecord', () => {
        it('should accept valid ShortcutRecord with start-menu type', () => {
            const record: ShortcutRecord = {
                type: 'start-menu',
                path: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\App.lnk',
                target: 'C:\\Program Files\\App\\app.exe',
            };
            expect(record.type).toBe('start-menu');
            expect(record.path).toContain('Start Menu');
            expect(record.target).toContain('app.exe');
        });

        it('should accept valid ShortcutRecord with desktop type', () => {
            const record: ShortcutRecord = {
                type: 'desktop',
                path: 'C:\\Users\\User\\Desktop\\App.lnk',
                target: 'C:\\Program Files\\App\\app.exe',
            };
            expect(record.type).toBe('desktop');
        });
    });

    describe('ShellConfigModification', () => {
        it('should accept valid ShellConfigModification with bash', () => {
            const modification: ShellConfigModification = {
                shell: ShellType.Bash,
                configFile: '/home/user/.bashrc',
                lineAdded: 'export PATH=$PATH:/usr/local/bin',
            };
            expect(modification.shell).toBe(ShellType.Bash);
            expect(modification.configFile).toBe('/home/user/.bashrc');
            expect(modification.lineAdded).toContain('export PATH');
        });

        it('should accept valid ShellConfigModification with zsh', () => {
            const modification: ShellConfigModification = {
                shell: ShellType.Zsh,
                configFile: '/home/user/.zshrc',
                lineAdded: 'export PATH=$PATH:/usr/local/bin',
            };
            expect(modification.shell).toBe(ShellType.Zsh);
        });

        it('should accept valid ShellConfigModification with fish', () => {
            const modification: ShellConfigModification = {
                shell: ShellType.Fish,
                configFile: '/home/user/.config/fish/config.fish',
                lineAdded: 'set -gx PATH $PATH /usr/local/bin',
            };
            expect(modification.shell).toBe(ShellType.Fish);
        });
    });

    describe('InstallationReport', () => {
        it('should accept valid InstallationReport', () => {
            const report: InstallationReport = {
                timestamp: new Date(),
                platform: Platform.Darwin,
                architecture: Architecture.X64,
                installPath: '/usr/local/app',
                filesCopied: [
                    {
                        source: '/src/app',
                        destination: '/usr/local/app/app',
                        size: 1024000,
                    },
                ],
                pathModifications: [
                    {
                        type: 'user',
                        previousValue: '/usr/bin',
                        newValue: '/usr/bin:/usr/local/app',
                    },
                ],
                shortcutsCreated: [],
                shellConfigModifications: [
                    {
                        shell: ShellType.Bash,
                        configFile: '/home/user/.bashrc',
                        lineAdded: 'export PATH=$PATH:/usr/local/app',
                    },
                ],
            };
            expect(report.platform).toBe(Platform.Darwin);
            expect(report.architecture).toBe(Architecture.X64);
            expect(report.filesCopied).toHaveLength(1);
            expect(report.pathModifications).toHaveLength(1);
            expect(report.shellConfigModifications).toHaveLength(1);
        });

        it('should accept InstallationReport with empty arrays', () => {
            const report: InstallationReport = {
                timestamp: new Date(),
                platform: Platform.Linux,
                architecture: Architecture.ARM64,
                installPath: '/opt/app',
                filesCopied: [],
                pathModifications: [],
                shortcutsCreated: [],
                shellConfigModifications: [],
            };
            expect(report.filesCopied).toHaveLength(0);
            expect(report.pathModifications).toHaveLength(0);
            expect(report.shortcutsCreated).toHaveLength(0);
            expect(report.shellConfigModifications).toHaveLength(0);
        });

        it('should accept InstallationReport with Windows shortcuts', () => {
            const report: InstallationReport = {
                timestamp: new Date(),
                platform: Platform.Windows,
                architecture: Architecture.X64,
                installPath: 'C:\\Program Files\\App',
                filesCopied: [],
                pathModifications: [],
                shortcutsCreated: [
                    {
                        type: 'start-menu',
                        path: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\App.lnk',
                        target: 'C:\\Program Files\\App\\app.exe',
                    },
                    {
                        type: 'desktop',
                        path: 'C:\\Users\\User\\Desktop\\App.lnk',
                        target: 'C:\\Program Files\\App\\app.exe',
                    },
                ],
                shellConfigModifications: [],
            };
            expect(report.shortcutsCreated).toHaveLength(2);
            expect(report.shortcutsCreated[0].type).toBe('start-menu');
            expect(report.shortcutsCreated[1].type).toBe('desktop');
        });
    });
});
