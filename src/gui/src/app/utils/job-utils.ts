import { JobStatus } from '@state/models/job.model';

export function stringToJobStatus(status: string): JobStatus {
    for (const v of Object.values(JobStatus)) {
        if (v.toString() === status) {
            return v;
        }
    }

    console.error(`[stringToJobStatus] Got unknown status "${status}"`);
    return JobStatus.Unknown;
}

export function jobStatusToString(status: JobStatus): string {
    for (const [k, v] of Object.entries(JobStatus)) {
        if (v.toString() === status) {
            return k;
        }
    }

    console.error(`[jobStatusToString] Got unknown status "${status}"`);
    return 'Unknown';
}

export function jobStatusToDisplayString(status: JobStatus): string {
    switch (status) {
        case JobStatus.Created:
            return 'Created';
        case JobStatus.Discovering:
            return 'Discovering';
        case JobStatus.Checksumming:
            return 'Checksumming';
        case JobStatus.Filtering:
            return 'Filtering';
        case JobStatus.InProgress:
            return 'In Progress';
        case JobStatus.Completed:
            return 'Completed';
        case JobStatus.Paused:
            return 'Paused';
        case JobStatus.Cancelled:
            return 'Cancelled';
        case JobStatus.Error:
            return 'Error';
        default:
            return 'Unknown';
    }
}
