import * as path from 'path';

/**
 * Normalizes a file path to always use forward slashes (POSIX-style).
 * This ensures consistent path separators across Windows, macOS, and Linux.
 */
export function toPosix(filePath: string): string {
    return filePath.split(path.sep).join('/');
}
