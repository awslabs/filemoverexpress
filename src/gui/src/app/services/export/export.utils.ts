import { ExportJobList } from '@services/export/export.interfaces';
// xlsx (SheetJS) is intentionally installed from the SheetJS CDN (cdn.sheetjs.com) rather than npm.
// SheetJS was removed from the npm registry in 2022; the CDN is the only supported distribution channel.
// See: https://docs.sheetjs.com/docs/getting-started/installation/nodejs
import * as XLSX from 'xlsx';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { FlattenedTask, Task } from '@classes/grpc/task';

const csvColumnHeadersJob = [
    'jobName',
    'direction',
    'remoteConfigurationName',
];

const csvColumnHeadersTask = [
    'jobId',
    'taskId',
    'destination',
    'source',
    'size',
    'lastModified',
    'status',
    'statusMessage',
    'checksum',
    'priority',
    'error',
    'bytesTransferred',
];

/**
 * Handles replacing null values and formats dates to ISO 8601 format
 * @param _ - Ignored argument
 * @param value - The value to inspect
 * @returns - Returns the formatted value
 */
export function replacer<T>(_: string, value: T) {
    if (value === null || value === undefined) {
        return '';
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return value;
}

/**
 * Custom replacer to use instead of JSON stringify that does not double escape backslashes.
 * Handles replacing null values and formats dates to ISO 8601 format, and wraps text values in double quotes so
 * commas in a text value aren't considered cell separators for some applications that open CSV files.
 * @param value - The value to inspect
 * @returns - Returns the formatted value
 */
function csvValueReplacer<T>(value: T): string {
    if (value === null || value === undefined) {
        return '';
    }

    if (value instanceof Date) {
        return `"${value.toISOString()}"`;
    }

    if (typeof value === 'string') {
        return `"${value.toString()}"`;
    }

    return value.toString();
}

/**
 * Converts exported NGRX transfer data to CSV
 * @param {ExportData} data - Data to export
 * @returns {string} - Base64 encoded string representation of transfer data in CSV format
 * @private
 */
export function convertTransfersToCsv(data: ExportJobList): string {
    return btoa(transfersToCsv(data));
}

/**
 * Converts a list of Transfer objects to a CSV formatted string, prepending the direction of transfer as the first column
 * @param {ExportJobList} data - List of data to export
 * @private
 * @returns {string} Returns the base64 encoded version of the transfer data CSV
 */
function transfersToCsv(data: ExportJobList): string {
    // header row
    const output: string[] = [[...csvColumnHeadersJob, ...csvColumnHeadersTask].join(',')];

    // data rows
    for (const job of Object.values(data)) {
        for (const transfer of job.transfers) {
            const data: string[] = [
                csvValueReplacer(job.jobName),
                csvValueReplacer(job.direction),
                csvValueReplacer(job.transferProfileName),
            ];

            const flattenedTransfer = Task.toFlattenedTask(transfer, job.bucket);

            for (const field of csvColumnHeadersTask) {
                let fieldValue;
                try {
                    fieldValue = flattenedTransfer[field as keyof FlattenedTask];
                } catch (e) {
                    console.error(`Error getting ${field} data from task: ${e}`);
                    fieldValue = '';
                }
                data.push(csvValueReplacer(fieldValue));
            }

            output.push(data.join(','));
        }
    }

    return output.join('\r\n');
}

/**
 * Converts exported NGRX transfer data to JSON
 * @param {ExportData} data - Data to export
 * @returns {string} - Base64 encoded string representation of JSON data
 * @private
 */
export function convertTransfersToJson(data: ExportJobList): string {
    return btoa(JSON.stringify(data, replacer));
}

/**
 * Convert exported NGRX transfer data to XLSX
 * @param {ExportJobList} data - Transfer input data
 * @returns any - Returns the XLSX formatted data, or empty string if there is no data or an error occurred.
 */
export function convertTransfersToExcel(data: ExportJobList) {
    if (Object.keys(data).length == 0) {
        return '';
    }

    try {
        const wb = XLSX.utils.book_new();

        for (const job of Object.values(data)) {
            const sheetName = sanitizeSheetName(job.jobName);

            const flattenedTransfers: FlattenedTask[] = [];
            for (const transfer of job.transfers) {
                flattenedTransfers.push(Task.toFlattenedTask(transfer, job.bucket));
            }

            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(flattenedTransfers),
                `${sheetName} (${job.direction === TransferDirection.Download ? 'download' : 'upload'})`,
            );
        }

        return XLSX.write(
            wb,
            {
                bookType: 'xlsx',
                type: 'base64',
                bookSST: true,
                cellDates: true,
            },
        );
    } catch (e) {
        console.error(`Error occurred in convertTransfersToExcel: ${e} `);
        return '';
    }
}

function sanitizeSheetName(jobName: string): string {
    let sheetname = jobName;
    if (sheetname.length > 20) {
        sheetname = `${sheetname.substring(0, 17)}...`;
    }

    sheetname = sheetname.replace(/[/\\?*:[\]]/, '_');

    return sheetname;
}
