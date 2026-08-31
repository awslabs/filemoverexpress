import { JobStatus, TaskStatus } from '@state/models/job.model';

export enum ObjectType {
    File,
    Folder
}

export enum TransferDirection {
    Upload = 'upload',
    Download = 'download'
}

export interface JobDetailsData {
    jobId: string;
    jobName: string;
    direction: TransferDirection;
    destination: string;
    remoteConfiguration: string;
    started: Date;
    completed: Date | null;
    // Summary fields (mockup Job Details): progress, throughput, size, status, errors.
    status: JobStatus;
    statusMessage: string;
    totalBytes: number;
    bytesTransferred: number;
    progress: number;
    timestampTransferring: Date | null;
    hasTaskErrors: boolean;
    hasSuccessfulTasks: boolean;
    // Whether the job was submitted to overwrite existing destination files
    // (the "Overwrite existing files" toggle in the transfer dialog).
    force: boolean;
}

export interface TaskElement {
    name: string;
    progress: number;
    type: ObjectType;
    status: TaskStatus;
    // Full size of the source file in bytes — shown/sortable in the Size column,
    // and summed into the job progress bar's committed (completed-file) floor.
    // Optional so other TaskElement producers don't have to supply it.
    sizeBytes?: number;
    // Last-modified time of the source (local file for uploads, S3 object for downloads).
    // Shown/sortable in the Date Modified column.
    lastModified?: Date;
}
