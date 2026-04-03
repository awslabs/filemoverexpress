import {Architecture, Platform} from '../types/platform';

/**
 * Detects the current operating system platform
 * @returns The detected Platform enum value
 * @throws Error if the platform is unsupported
 */
export function detectCurrentPlatform(): Platform {
    const platform = process.platform;

    switch (platform) {
        case 'darwin':
            return Platform.Darwin;
        case 'linux':
            return Platform.Linux;
        case 'win32':
            return Platform.Windows;
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

/**
 * Detects the current CPU architecture
 * @returns The detected Architecture enum value
 * @throws Error if the architecture is unsupported
 */
export function detectCurrentArchitecture(): Architecture {
    const arch = process.arch;

    switch (arch) {
        case 'x64':
            return Architecture.X64;
        case 'arm64':
            return Architecture.ARM64;
        default:
            throw new Error(`Unsupported architecture: ${arch}`);
    }
}

/**
 * Checks if the current platform is Windows
 * @returns true if running on Windows, false otherwise
 */
export function isWindows(): boolean {
    return process.platform === 'win32';
}

/**
 * Checks if the current platform is macOS
 * @returns true if running on macOS, false otherwise
 */
export function isDarwin(): boolean {
    return process.platform === 'darwin';
}

/**
 * Checks if the current platform is Linux
 * @returns true if running on Linux, false otherwise
 */
export function isLinux(): boolean {
    return process.platform === 'linux';
}
