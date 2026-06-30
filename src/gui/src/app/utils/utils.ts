import { ConnectError } from '@connectrpc/connect';
import { JobStatus, TaskStatus } from '@state/models/job.model';

const sizes = [
    ['Bytes', 'Bytes'],
    ['KB', 'KiB'],
    ['MB', 'MiB'],
    ['GB', 'GiB'],
    ['TB', 'TiB'],
    ['PB', 'PiB'],
    ['EB', 'EiB'],
    ['ZB', 'ZiB'],
    ['YB', 'YiB'],
];

/**
 * formatBytes takes a number, and an optional number of decimals to use.
 * @param {number} bytes Number of bytes
 * @param {number} decimals Optional number of decimal points to use in the output. Default: 2
 * @param {number} divisor The divisor to use, valid values: 1000, 1024, null. Default: 1024
 * @returns {string} A human-readable representation of a byte amount, ex: 1 KB or 37.51 MiB
 */
export function formatBytes(bytes: number, decimals?: number, divisor?: 1000 | 1024 | null): string {
    if (bytes < 0) {
        return '0 Bytes';
    }

    if (bytes < 1) {
        return '0 Bytes';
    }

    decimals = decimals ? decimals : 2;
    divisor = divisor ? divisor : 1024;

    const sizeIndex = Math.floor(Math.log(bytes) / Math.log(divisor));
    const suffix = sizes[sizeIndex][divisor === 1000 ? 0 : 1];

    return parseFloat((bytes / Math.pow(divisor, sizeIndex)).toFixed(decimals)) + ' ' + suffix;
}

/**
 * basename takes a path-like string as input and returns the filename portion of the path. Optionally allows you to
 * change the path delimiter, by passing it as a second argument. If the delimiter is not set, a default value of / will
 * be used
 * @param {string} path - The path to return the file name for
 * @param delimiter - Optional delimiter character to use
 * @returns {string} - Returns the filename portion of the path
 */
export function basename(path: string, delimiter = '/'): string {
    if (path.endsWith(delimiter)) {
        path = path.slice(0, path.length - delimiter.length);
    }
    return path.split(delimiter).reverse()[0];
}

/**
 * dirname takes a path-like string as input and returns the parent path portion of the input.
 * @param path
 * @returns {string} - Returns the parent path portion of the input path
 */
export function dirname(path: string): string {
    if (path === '') {
        return '/';
    }

    const delimiter = path.includes('\\') ? '\\' : '/';

    if (path.endsWith(delimiter)) {
        path = path.substring(0, path.length - delimiter.length - 1);
    }

    const parts = path.split(delimiter);
    parts.pop();
    if (parts.length === 0) {
        return '';
    }

    return parts.join(delimiter) + delimiter;
}

/**
 * s3BasePath takes a s3 object key as input and returns the leading prefix to the object. For example,
 * "my/prefix/abc.txt" returns "my/prefix/"
 * @param s3Path
 * @returns {string} - Returns the parent path portion of the input path
 */
export function s3BasePath(s3Path: string): string {
    if (s3Path === '') {
        return '/';
    }
    const delimiter = '/';
    if (s3Path.endsWith(delimiter)) {
        s3Path = s3Path.substring(0, s3Path.length - delimiter.length - 1);
    }

    const parts = s3Path.split(delimiter);
    parts.pop();
    if (parts.length === 0) {
        return '';
    }

    return parts.join(delimiter) + delimiter;
}

/**
 * Given an array of strings, return an array of arrays, containing the
 * strings split at the given separator
 * @param {!Array<!string>} a
 * @param {string} sep
 * @returns {!Array<!Array<string>>}
 */
const splitStrings = (a: string[], sep = '/'): string[][] => a.map((i) => i.split(sep));

/**
 * Given an index number, return a function that takes an array and returns the
 * element at the given index
 * @param {number} i
 * @return {function(!Array<T>): T}
 */
const elAt = <T>(i: number): (a: T[]) => T => (a: T[]) => a[i];

/**
 * Transpose an array of arrays:
 * Example:
 * [['a', 'b', 'c'], ['A', 'B', 'C'], [1, 2, 3]] ->
 * [['a', 'A', 1], ['b', 'B', 2], ['c', 'C', 3]]
 * @param {!Array<!Array<*>>} a
 * @return {!Array<!Array<*>>}
 */
const rotate = <T>(a: T[][]): T[][] => a[0].map((e, i) => a.map(elAt<T>(i)));

/**
 * Checks of all the elements in the array are the same.
 * @param {!Array<*>} arr - Array to check
 * @return {boolean} - True if all items are equal, else false
 */
const allElementsEqual = <T>(arr: T[]): boolean => arr.every((e) => e === arr[0]);

/**
 * Given a list of strings, find the common part of the split, split by the separator
 * @param {string[]} input - Array of strings
 * @param {string} sep - Separator. Default value: /
 * @returns {string} - Common base path
 */
export function commonPath(input: string[], sep = '/'): string {
    const common = rotate<string>(splitStrings(input, sep)).filter(allElementsEqual<string>).map(elAt<string>(0)).join(sep) + sep;
    if (common.endsWith('//')) {
        return common.replaceAll(/\/{2,}/g, '/');
    }

    return common;
}

/**
 * Formats the date object `d` into YYYYMMDD format, optionally including the timestamp as YYYYMMDD-HHmmss
 * @param {Date} d - Date object
 * @param includeTime - Include timestamp in formatted output
 * @returns {string} - Returns date object formatted as YYYYMMDD / YYYYMMDD-HHmmss
 */
export function formatDate(d: Date, includeTime?: boolean): string {
    const date = [
        d.getFullYear().toString(),
        (d.getMonth() + 1).toString().padStart(2, '0'),
        d.getDate().toString().padStart(2, '0'),
    ].join('');

    if (includeTime) {
        const time = [
            d.getHours().toString().padStart(2, '0'),
            d.getMinutes().toString().padStart(2, '0'),
            d.getSeconds().toString().padStart(2, '0'),
        ].join('');

        return `${date}-${time}`;
    }

    return date;
}

/**
 * Returns whether the shell is running in packaged.
 * @returns {boolean} - Returns true if the application is running as a packaged binary. Will return false if running
 * in dev mode
 */
export function isPackagedApp(): boolean {
    // Detect whether we're running inside a native Wails webview (vs a plain
    // browser under `ng serve`/tests). Mirrors the Wails v3 runtime's own
    // native-bridge detection. The previous check (`window.go`) was a Wails v2
    // -ism and is always false on v3, which silently disabled every
    // native-integration feature (external links, Open/Reveal in folder). See
    // issues #20 and #15.
    const w = window as unknown as {
        chrome?: { webview?: { postMessage?: unknown } };
        webkit?: { messageHandlers?: { external?: { postMessage?: unknown } } };
        wails?: { invoke?: unknown };
    };
    return Boolean(
        w.chrome?.webview?.postMessage ||
        w.webkit?.messageHandlers?.external?.postMessage ||
        w.wails?.invoke,
    );
}

/**
 * Trims out the file portion of a path if the path does not end with the delimiter
 *
 * @param {string} path Path string to trim ending file part out of
 * @param {string} delimiter Path delimiter. If not provided, defaults to /
 * @returns {string} - Returns the directory name of the path without the ending file portion
 */
export function dirName(path: string, delimiter = '/'): string {
    if (!path || path.endsWith(delimiter)) {
        return path;
    }
    const lastDelimiterIndex = path.lastIndexOf(delimiter);
    if (lastDelimiterIndex !== -1) {
        return path.substring(0, lastDelimiterIndex + 1);
    }
    return path;
}

/**
 * Trims out the given leading and ending substrings if they exist, or else returns the original string.
 *
 * @param {string} fullString String to trim
 * @param {string} prefix Leading substring to trim out. Can be the empty string if no trimming is needed
 * @param {string} suffix Ending substring to trim out. Can be the empty string if no trimming is needed
 * @returns {string} - Returns the trimmed string
 */
export function trimPrefixSuffix(fullString: string, prefix: string, suffix: string): string {
    fullString = fullString.startsWith(prefix) ? fullString.substring(prefix.length) : fullString;
    return fullString.endsWith(suffix) ? fullString.substring(0, fullString.length - suffix.length) : fullString;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
 * Suppressing error on using type "any" since the purpose of this function is to check the error type
**/
export function getErrorMessage(error: any): string | null {
    if (error instanceof ConnectError) {
        return error.rawMessage;
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    // return null to signal that error type is unrecognized
    return null;
}

/**
 * Creates the job name for a transfer job
 * @param firstSourceName Source path where job drag was started from, or just a source path in the list
 * of sources
 * @param sourcesLength Number of sources for the transfer job
 */
export function createJobName(firstSourceName: string, sourcesLength: number) {
    if (!firstSourceName) {
        return 'Transfer job';
    }
    let jobName = basename(firstSourceName);
    if (sourcesLength > 1) {
        jobName += ' & others';
    }
    return jobName;
}

/** Converts a string value to a JobStatus object. If the value is not found, JobStatus.Unknown will be returned instead
 *
 * @param value {string} Lookup value
 */
export function stringToJobStatus(value: string): JobStatus {
    const state = Object.values(JobStatus).find((itm) => itm === value);
    if (state) {
        return state;
    }

    return JobStatus.Unknown;
}

/** Converts a string value to a TaskStatus object. If the value is not found, TaskStatus.Unknown will be returned instead
 *
 * @param value {string} Lookup value
 */
export function stringToTaskStatus(value: string): TaskStatus {
    const state = Object.values(TaskStatus).find((itm) => itm === value);
    if (state) {
        return state;
    }

    return TaskStatus.Unknown;
}

/**
 * Adds spaces between capitalized sections of a Pascal or camel case string.
 *
 * @param value Pascal or camel case string
 */
export function pascalCaseToSpace(value: string): string {
    return value.replace(/(?<=[a-zA-Z])(?=[A-Z])/g, ' ');
}
