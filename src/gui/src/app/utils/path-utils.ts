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

/**
 * The pieces needed to render a favorite path on two lines: the leaf folder as a bold
 * headline, and the parent path as a dim second line that is middle-truncated so both its
 * start and its own last folder stay readable.
 */
export interface FavoritePathDisplayParts {
    // Last path segment - the folder the favorite points at (e.g. "CameraRAW"). This is the
    // part that end-truncation used to clip off, so it becomes the row's headline.
    leaf: string,
    // The parent path up to and including the separator before parentTail. Rendered with an
    // end-ellipsis so a very long parent collapses in its middle rather than at its end.
    parentHead: string,
    // The immediate parent folder name (e.g. "01_elements"), kept fully visible as the tail
    // of the middle-truncated parent line.
    parentTail: string,
}

/**
 * Splits a favorite path into a leaf headline plus a middle-truncatable parent line.
 *
 * The dropdown used to show the full path clipped at the END, which hid the leaf folder -
 * the one part that identifies the favorite. This splits off the leaf so it can be shown in
 * full, and splits the parent into a head (ellipsized) and tail (always visible) so a long
 * parent reads as "/Volumes/production/jobs/projecta_2222/ ... 01_elements" rather than
 * losing its own last folder too.
 *
 * Handles both POSIX ("/a/b/c") and Windows display paths ("C:\\a\\b\\c") by splitting on
 * whichever separator the path actually uses. Paths with no parent (a bare root such as "/"
 * or "C:\\", or a single segment) return empty parent pieces, so the caller falls back to a
 * normal single-line row.
 *
 * @param {string} path - Favorite path in display form (POSIX or Windows)
 * @returns {FavoritePathDisplayParts} Leaf plus the two parent pieces
 */
export function splitFavoritePathForDisplay(path: string): FavoritePathDisplayParts {
    const empty: FavoritePathDisplayParts = {leaf: '', parentHead: '', parentTail: ''};
    if (!path) {
        return empty;
    }
    // Pick the separator the path actually uses so Windows display paths and POSIX paths
    // both split correctly.
    const sep = path.includes('\\') ? '\\' : '/';
    // Drop a single trailing separator so ".../b/" still yields leaf "b".
    const trimmed = path.length > 1 && path.endsWith(sep) ? path.slice(0, -1) : path;
    const lastSep = trimmed.lastIndexOf(sep);
    if (lastSep < 0) {
        // No separator at all - the whole thing is the leaf (nothing to truncate).
        return {leaf: trimmed, parentHead: '', parentTail: ''};
    }
    const leaf = trimmed.slice(lastSep + 1);
    if (leaf === '') {
        // Path was just a root (e.g. "/"); show it as the leaf with no parent line.
        return {leaf: trimmed, parentHead: '', parentTail: ''};
    }
    const parent = trimmed.slice(0, lastSep);
    if (parent === '') {
        // Leaf sits directly under root, e.g. "/Volumes" - keep the leading separator.
        return {leaf, parentHead: sep, parentTail: ''};
    }
    const parentLastSep = parent.lastIndexOf(sep);
    if (parentLastSep < 0) {
        // Parent has no separator of its own (e.g. a bare "C:" drive or a lone segment).
        return {leaf, parentHead: '', parentTail: parent};
    }
    return {
        leaf,
        // Keep the trailing separator on the head so "<head>/<tail>" reads naturally.
        parentHead: parent.slice(0, parentLastSep + 1),
        parentTail: parent.slice(parentLastSep + 1),
    };
}
