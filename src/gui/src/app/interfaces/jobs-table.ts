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
}

export interface TaskElement {
    name: string;
    progress: number;
    type: ObjectType;
    status: TaskStatus;
}
