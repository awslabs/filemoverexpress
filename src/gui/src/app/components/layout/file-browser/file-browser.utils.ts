import { MatSort } from '@angular/material/sort';
import { displayPathToGrpcPath } from '@app/utils/path-utils';
import { basename } from '@app/utils/utils';
import { PREVIOUS_FOLDER_NAME } from './file-browser.constants';
import {
    FileBrowserFilter,
    FileBrowserObject,
    FileBrowserObjectType,
    FileBrowserObjectValue,
    FileBrowserType,
} from './file-browser.interfaces';

/**
 * Determines if a file browser row is filtered out
 * @param data File browser row
 * @param term Filter term
 */
export function browserFilterPredicate(data: FileBrowserObject, term: string): boolean {
    if (term === '' || (data.name === PREVIOUS_FOLDER_NAME && data.type === FileBrowserObjectType.FOLDER)) {
        return true;
    }
    const filters: FileBrowserFilter = JSON.parse(term);

    if (filters.name) {
        return basename(data.name).trim().toLowerCase().includes(filters.name);
    }
    return true;
}

/**
 * Builds the file browser filter term string from a FileBrowserFilter
 * @param data FileBrowserFilter
 */
export function buildBrowserFilterString(data: FileBrowserFilter): string {
    const filter: FileBrowserFilter = {
        name: null,
    };
    if (data.name?.trim()) {
        filter.name = data.name.trim().toLowerCase();
    }
    return JSON.stringify(filter);
}

/**
 * Custom sorts a list of file browser rows with case-insensitive sort and to handle keeping the "cd .." row
 * to always be first.
 * @param data List of FileBrowserObjects to sort
 * @param sort Current MatSort settings
 * @returns Custom sorted list of FileBrowserObjects
 */
export function sortFileBrowserRows(data: FileBrowserObject[], sort: MatSort): FileBrowserObject[] {
    const active = sort.active;
    const direction = sort.direction;
    if (!active || direction == '') {
        return data;
    }
    return data.sort((a: FileBrowserObject, b: FileBrowserObject) => {
        if (a.name === PREVIOUS_FOLDER_NAME && a.type === FileBrowserObjectType.FOLDER) {
            return -1;
        } else if (b.name === PREVIOUS_FOLDER_NAME && b.type === FileBrowserObjectType.FOLDER) {
            return 1;
        }
        let comparatorValue = 0;
        switch (active) {
            case 'name':
                comparatorValue = compareFileBrowserObjects(
                    basename(a.name || '').toLowerCase(),
                    basename(b.name || '').toLowerCase(),
                );
                break;
            case 'size':
                comparatorValue = compareFileBrowserObjects(a.size, b.size);
                break;
            case 'dateModified':
                comparatorValue = compareFileBrowserObjects(a.dateModified, b.dateModified);
                break;
        }
        return comparatorValue * (direction === 'asc' ? 1 : -1);
    });
}

/**
 * Comparator function for sortFileBrowserRows()
 * @param a First value
 * @param b Second value
 * @returns Comparator result
 */
function compareFileBrowserObjects(a: FileBrowserObjectValue, b: FileBrowserObjectValue): number {
    if (a === null && b === null) {
        return 0;
    }
    if (a === null) {
        return -1;
    }
    if (b === null) {
        return 1;
    }
    if (a > b) {
        return 1;
    }
    if (a < b) {
        return -1;
    }
    return 0;
}

/**
 * Converts a string to a FileBrowserType
 *
 * @param {string} fileBrowserTypeString - String representing a file browser type
 * @returns {FileBrowserType} Converted FileBrowserType
 */
export function stringToFileBrowserType(fileBrowserTypeString: string): FileBrowserType {
    switch (fileBrowserTypeString) {
        case 'darwin':
            return 'darwin';
        case 'linux':
            return 'linux';
        case 'windows':
            return 'windows';
        case 's3':
            return 's3';
        default:
            return 'unknown';
    }
}

/**
 * Get the native file browser name based on OS
 *
 * @param fileBrowserType The daemon OS
 * @returns {string} The native file browser name
 */
export function getOSFileBrowserName(fileBrowserType: FileBrowserType): string {
    switch (fileBrowserType) {
        case 'darwin':
            return 'Finder';
        case 'windows':
            return 'File Explorer';
        case 'linux':
            return 'File Manager';
        default:
            return 'OS File Browser';
    }
}

/**
 * Converts a destination path to a file browser path based on the file system type that the file browser is showing
 * files for.
 *
 * @param {string} destination - Destination path to convert
 * @param {fileBrowserType} fileBrowserType - Type of file system that the file browser is showing files for
 * @returns {string} - Converted destination path
 */
export function destinationPathToFileBrowserPath(destination: string, fileBrowserType: FileBrowserType): string {
    return displayPathToGrpcPath(destination, fileBrowserType);
}

/**
 * Cleans a path by removing leading/trailing delimiters and consecutive repeat delimiters. Returns the cleaned path.
 *
 * @param {string} path - Path to clean
 * @param {string} [delimiter] - Delimiter for path. Defaults to '/'
 * @returns {string} - Cleaned path
 */
export function cleanPath(path: string, delimiter = '/'): string {
    return path.split(delimiter).filter((pathSegment) => !!pathSegment).join(delimiter);
}

/**
 * Takes in a path and returns the uppermost parent directory of the path. If the path is empty or is just a file path
 * with no enclosing directory, returns empty string.
 *
 * For example:
 * - getUpperMostParentDirectory('folderA/folderB/file.txt') returns 'folderA'
 * - getUpperMostParentDirectory('abcde') returns ''
 *
 * @param {string} path - Path to find the uppermost parent directory for
 * @param {string} [delimiter] - Delimiter for path. Defaults to '/'
 * @returns {string} - Uppermost parent directory in path or empty string
 */
export function getUppermostParentDirectory(path: string, delimiter = '/'): string {
    if (!path || path === delimiter) {
        return '';
    }
    const splitPath = path.split(delimiter).filter((pathSegment) => !!pathSegment);
    return splitPath.length > 1 ? splitPath[0] : '';
}
