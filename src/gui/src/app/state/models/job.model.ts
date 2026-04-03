import { TransferDirection } from '@app/interfaces/jobs-table';
import { JobChecksumProgressEvent } from '@events/job';

export enum JobStatus {
    Created = 'CREATED',
    Discovering = 'DISCOVERING',
    Checksumming = 'CHECKSUMMING',
    Filtering = 'FILTERING',
    InProgress = 'IN_PROGRESS',
    Paused = 'PAUSED',
    Cancelled = 'CANCELLED',
    Completed = 'COMPLETED',
    Error = 'ERROR',
    Unknown = 'UNKNOWN'
}

export enum TaskStatus {
    Queued = 'QUEUED',
    InProgress = 'IN_PROGRESS',
    Completed = 'COMPLETED',
    Checksumming = 'CHECKSUMMING',
    Cancelled = 'CANCELLED',
    Paused = 'PAUSED',
    Skipped = 'SKIPPED',
    Error = 'ERROR',
    Unknown = 'UNKNOWN'
}

export interface Job {
    id: string;
    name: string;
    transferProfile: string;
    status: JobStatus;
    statusMessage: string;
    totalBytes: number;
    bytesTransferred: number;
    progress: number;
    eta: string;
    hasTaskErrors: boolean,
    hasSuccessfulTasks: boolean,
    lastUpdate: Date;
    destination: string;
    direction: TransferDirection;
    timestampCreated: Date;
    timestampDiscovering: Date | null;
    timestampChecksumming: Date | null;
    timestampTransferring: Date | null;
    timestampCompleted: Date | null;
    checksumProgress: JobChecksumProgressEvent | null;
}

export const PROGRESS_STATES: JobStatus[] = [
    JobStatus.Created,
    JobStatus.Discovering,
    JobStatus.Checksumming,
    JobStatus.InProgress,
];

export const TERMINAL_STATES: JobStatus[] = [JobStatus.Completed, JobStatus.Error];
