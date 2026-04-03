import { TaskStatus } from '@state/models/job.model';

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
}

export interface TaskElement {
    name: string;
    progress: number;
    type: ObjectType;
    status: TaskStatus;
}
