import {Architecture, Platform} from './platform';

/**
 * Installation scope - user-local or system-wide
 */
export enum InstallScope {
    User = 'user',
    System = 'system',
}

/**
 * Options for system configuration during installation
 */
export interface SystemConfigOptions {
    updatePath: boolean;
    createStartMenuShortcut?: boolean;  // Windows only
    createDesktopShortcut?: boolean;    // Windows only
}

/**
 * Complete report of all modifications made during installation
 */
export interface InstallationReport {
    timestamp: Date;
    platform: Platform;
    architecture: Architecture;
    installPath: string;
    filesCopied: FileCopyRecord[];
    pathModifications: PathModification[];
    shortcutsCreated: ShortcutRecord[];
    shellConfigModifications: ShellConfigModification[];
}

/**
 * Record of a single file copy operation
 */
export interface FileCopyRecord {
    source: string;
    destination: string;
    size: number;
}

/**
 * Record of a PATH environment variable modification
 */
export interface PathModification {
    type: 'user' | 'system';
    previousValue: string;
    newValue: string;
}

/**
 * Record of a shortcut creation (Windows only)
 */
export interface ShortcutRecord {
    type: 'start-menu' | 'desktop';
    path: string;
    target: string;
}

/**
 * Record of a shell configuration file modification
 */
export interface ShellConfigModification {
    shell: ShellType;
    configFile: string;
    lineAdded: string;
}

/**
 * Supported shell types for Unix-like systems
 */
export enum ShellType {
    Bash = 'bash',
    Zsh = 'zsh',
    Fish = 'fish'
}
