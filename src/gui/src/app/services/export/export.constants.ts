import { ExportConfig, ExportData, ExportJobConfig } from './export.interfaces';

const EMPTY_EXPORT_DATA: ExportData = {
    downloads: [],
    uploads: [],
};

export const DEFAULT_EXPORT_JOB_CONFIG: ExportJobConfig = {
    format: 'xlsx',
    filename: 'job-export',
};

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
    format: 'xlsx',
    filename: 'transfers',
    includeDownloads: true,
    includeUploads: true,
    data: EMPTY_EXPORT_DATA,
};
