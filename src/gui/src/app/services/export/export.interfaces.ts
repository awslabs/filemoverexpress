import { Transfer } from '@state/models/transfer.model';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { Task } from '@classes/grpc/task';

export interface ExportData {
    downloads: Transfer[],
    uploads: Transfer[],
}

export type ExportJobList = Record<string, ExportJobData>;

export interface ExportJobData {
    jobName: string;
    destination: string;
    direction: TransferDirection;
    transferProfileName: string;
    bucket: string;
    transfers: Task[];
}

export enum ExportMimeTypes {
    XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    CSV = 'text/csv',
    JSON = 'application/json'
}

export type ExportFormat = 'json' | 'xlsx' | 'csv';

export interface ExportJobConfig {
    format: ExportFormat;
    filename: string;
}

export interface ExportConfig {
    format: ExportFormat;
    filename: string;
    includeDownloads: boolean;
    includeUploads: boolean;
    data: ExportData;
}
