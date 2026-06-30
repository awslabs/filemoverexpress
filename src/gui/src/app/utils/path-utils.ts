import { FileBrowserType } from '@app/components/layout/file-browser/file-browser.interfaces';
import { trimPrefixSuffix } from '@app/utils/utils';

const windowsAbsPathRegExp = /^([a-zA-Z]:[\\/])|^([\\/]{2}[^\s\\/]+[\\/]\S+)/;

/**
 * Returns if a path is a Unix (Mac or Linux) absolute path
 *
 * @param {string} pathName - Path to check
 * @returns {boolean} True if the path is a Unix absolute path
 */
export function isUnixAbsolutePath(pathName: string): boolean {
    return pathName.startsWith('/');
}

/**
 * Returns if a path is a Windows absolute path
 *
 * @param {string} pathName - Path to check
 * @returns {boolean} True if the path is a Windows absolute path
 */
export function isWindowsAbsolutePath(pathName: string): boolean {
    // prefix matches "<drive-letter>:\" or is UNC/DOS path
    return !!pathName.match(windowsAbsPathRegExp);
}

/**
 * Converts a GRPC path to the display path that would show on the original OS. So far this path will only be different
 * if the path is a Windows path. The original path is returned for other OS's.
 *
 * @param {string} grpcPath - Path sent over GRPC. Looks like '/.../.../...' regardless of OS
 * @param {FileBrowserType} pathType - The type of OS to convert the path to
 * @returns {string} Converted path that matches how the passed in OS would display the path as
 */
export function grpcPathToDisplayPath(grpcPath: string, pathType: FileBrowserType): string {
    switch (pathType) {
        case 'windows':
            return grpcPathToWindowsPath(grpcPath);
        default:
            return grpcPath;
    }
}

/**
 * Converts a GRPC path to a Windows path
 *
 * @param {string} grpcPath - Path sent over GRPC. Looks like '/.../.../...' regardless of OS
 * @returns {string} Converted path that matches how Windows would display the path as
 */
function grpcPathToWindowsPath(grpcPath: string): string {
    if (grpcPath === '/' || grpcPath === '') {
        return '';
    }
    const parts = trimPrefixSuffix(grpcPath, '/', '').split('/');
    if (parts.length > 2) {
        return constructWinPath(parts[0], parts.slice(1).join('/'));
    }
    if (parts.length === 1) {
        return constructWinPath(parts[0], '');
    }
    if (parts.length === 2) {
        return constructWinPath(parts[0], parts[1]);
    }
    // error
    return grpcPath;
}

/**
 * Helper function to grpcPathToWindowsPath() that constructs the Windows path from drive letter and drive path.
 *
 * @param {string} driveLetter - Drive letter portion of Windows path
 * @param {string} drivePath - Drive path portion of Windows path. Follows the driver letter portion
 * @returns {string} Constructed Windows path
 */
function constructWinPath(driveLetter: string, drivePath: string): string {
    const winPath = drivePath.split('/').join('\\');
    const upperCaseDriveLetter = driveLetter.toUpperCase();
    if (winPath === '') {
        return `${upperCaseDriveLetter}:\\`;
    }
    return `${upperCaseDriveLetter}:\\${winPath}`;
}

/**
 * Converts a display path that would show on the original OS to a GRPC path. So far this path will only be different
 * if the path is a Windows path. The original path is returned for other OS's.
 *
 * @param {string} displayPath - Path in the format that would show on the original OS
 * @param {FileBrowserType} pathType - The type of OS to convert the path from
 * @returns {string} Converted path in the format that would be sent over GRPC
 */
export function displayPathToGrpcPath(displayPath: string, pathType: FileBrowserType): string {
    switch (pathType) {
        case 'windows':
            return windowsPathToGrpcPath(displayPath);
        default:
            return displayPath;
    }
}

/**
 * Converts a Windows path to a GRPC path.
 *
 * @param {string} displayPath - Windows path in the Windows format
 * @returns {string} Converted path in the format that would be sent over GRPC
 */
function windowsPathToGrpcPath(displayPath: string): string {
    const parts = displayPath.split(':', 2);
    if (parts.length < 2) {
        // there's no drive letter
        return displayPath;
    }
    return `/${parts[0].toLowerCase()}/${trimPrefixSuffix(parts[1], '\\', '').split('\\').join('/')}`;
}

export function toGrpcPath(path: string): string {
    if (!path) {
        return '';
    }

    const isWindowsPath = path.includes(':\\');

    if (isWindowsPath) {
        const [drive, parts] = path.split(isWindowsPath ? '\\' : '/');
        return [drive.replace(':', ''), ...parts].join('/');
    }

    return path;
}

export function getFileExtension(path: string) {
    const extensionStartIndex = path.lastIndexOf('.');
    if (extensionStartIndex <= 0) {
        return '';
    }
    if (extensionStartIndex == (path.length - 1)) {
        return '';
    }
    return path.substring(extensionStartIndex);
}

export function getBasename(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
}
