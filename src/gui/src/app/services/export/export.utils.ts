import { ExportJobList } from '@services/export/export.interfaces';
import { ExportJobList as WailsExportJobList } from '@wailsApp/models';
import { WailsService } from '@services/wails/wails.service';
import { Observable } from 'rxjs';

/**
 * Serializes ExportJobList into the shape expected by the Go Wails bindings,
 * converting Date objects to ISO 8601 strings.
 */
function serializeForBinding(data: ExportJobList): WailsExportJobList {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};

    for (const [jobId, job] of Object.entries(data)) {
        result[jobId] = {
            jobName: job.jobName,
            direction: job.direction,
            transferProfileName: job.transferProfileName,
            bucket: job.bucket,
            transfers: job.transfers.map((t) => ({
                taskId: t.taskId,
                destination: t.destination,
                localFile: {
                    path: t.localFile.path,
                    size: t.localFile.size,
                    lastModified: t.localFile.lastModified?.toISOString() ?? '',
                },
                s3Object: {
                    key: t.s3Object.key,
                    size: t.s3Object.size,
                    lastModified: t.s3Object.lastModified?.toISOString() ?? '',
                },
                direction: t.direction,
                status: t.status,
                statusMessage: t.statusMessage,
                jobId: t.jobId,
                checksum: t.checksum,
                priority: t.priority,
                error: t.error,
                bytesTransferred: t.bytesTransferred,
            })),
        };
    }

    return result as WailsExportJobList;
}

/**
 * Generates a base64-encoded CSV report via the Go backend.
 */
export function convertTransfersToCsv(wails: WailsService, data: ExportJobList): Observable<string> {
    return wails.generateCsvReport(serializeForBinding(data));
}

/**
 * Generates a base64-encoded JSON report via the Go backend.
 */
export function convertTransfersToJson(wails: WailsService, data: ExportJobList): Observable<string> {
    return wails.generateJsonReport(serializeForBinding(data));
}

/**
 * Generates a base64-encoded XLSX report via the Go backend.
 */
export function convertTransfersToExcel(wails: WailsService, data: ExportJobList): Observable<string> {
    return wails.generateExcelReport(serializeForBinding(data));
}
