import { Pipe, PipeTransform } from '@angular/core';
import { jobStatusToDisplayString, stringToJobStatus } from '@app/utils/job-utils';
import { formatBytes } from '@app/utils/utils';
import { JobChecksumProgressEvent } from '@events/job';
import { Job, JobStatus, TERMINAL_STATES } from '@state/models/job.model';
import { formatDistanceStrict, formatDistanceToNowStrict, intervalToDuration } from 'date-fns';

@Pipe({
    name: 'jobStatus',

})
export class JobStatusPipe implements PipeTransform {
    transform(job: Job): string {
        if (job.status === JobStatus.Completed) {
            if (job.hasTaskErrors && job.hasSuccessfulTasks) {
                return 'Completed with Errors';
            } else if (!job.hasSuccessfulTasks && job.hasTaskErrors) {
                return 'Error';
            } else if (!job.hasSuccessfulTasks && !job.hasTaskErrors) {
                return 'Skipped';
            } else if (job.hasSuccessfulTasks && !job.hasTaskErrors) {
                return 'Completed';
            } else {
                return 'Unknown';
            }
        }
        return jobStatusToDisplayString(job.status);
    }
}

@Pipe({
    name: 'jobStatusClass',

})
export class JobStatusClassPipe implements PipeTransform {
    transform(job: Job): string {
        switch (job.status) {
            case JobStatus.Created:
                return 'status-queued';
            case JobStatus.Discovering:
                return 'status-discovering';
            case JobStatus.Checksumming:
                return 'status-checksumming';
            case JobStatus.Filtering:
                return 'status-filtering';
            case JobStatus.InProgress:
                return 'status-in-progress';
            case JobStatus.Completed:
                if (job.hasTaskErrors && job.hasSuccessfulTasks) {
                    return 'status-completed-with-errors';
                } else if (!job.hasSuccessfulTasks && job.hasTaskErrors) {
                    return 'status-error';
                } else if (!job.hasSuccessfulTasks && !job.hasTaskErrors) {
                    return 'status-skipped';
                } else if (job.hasSuccessfulTasks && !job.hasTaskErrors) {
                    return 'status-completed';
                } else {
                    return 'status-unknown';
                }
            case JobStatus.Paused:
                return 'status-paused';
            case JobStatus.Cancelled:
                return 'status-cancelled';
            case JobStatus.Error:
                return 'status-error';
            default:
                return '';
        }
    }
}

@Pipe({
    name: 'jobsTableChecksumProgress',

})
export class JobsTableChecksumProgressPipe implements PipeTransform {
    transform(jcpe: JobChecksumProgressEvent | null): number {
        if (!jcpe) {
            return 0;
        }

        if (jcpe.total < 1) {
            return 100;
        }

        return parseFloat(((jcpe.completed / jcpe.total) * 100).toFixed(2));
    }
}

@Pipe({
    name: 'taskClass',

})
export class TaskTableStatusClassPipe implements PipeTransform {
    transform(status: string): string {
        status = status.toLowerCase();
        switch (status) {
            case 'queued':
                return 'status-queued';
            case 'in_progress':
                return 'status-in-progress';
            case 'completed':
                return 'status-completed';
            case 'skipped':
                return 'status-paused';
            case 'error':
                return 'status-error';
            case 'cancelled':
                return 'status-cancelled';
            case 'checksumming':
                return 'status-checksumming';
            default:
                return '';
        }
    }
}

@Pipe({
    name: 'jobSpeed',

})
export class JobSpeedPipe implements PipeTransform {
    transform(job: Job): string {
        const end = TERMINAL_STATES.includes(stringToJobStatus(job.status)) && job.timestampCompleted ? job.timestampCompleted : new Date();
        const dur = intervalToDuration({start: job.timestampCreated, end});

        if (!dur || !dur.seconds) {
            return 'Unknown';
        }

        const bps = job.totalBytes / dur.seconds;

        return formatBytes(bps, 2, 1000) + '/s';
    }
}

@Pipe({
    name: 'jobDuration',

})
export class JobDurationPipe implements PipeTransform {
    transform(job: Job): string {
        if (!job.timestampCreated) {
            return 'Unknown';
        }

        if (TERMINAL_STATES.includes(stringToJobStatus(job.status)) && job.timestampCompleted) {
            return formatDistanceStrict(job.timestampCreated, job.timestampCompleted);
        }

        return formatDistanceToNowStrict(job.timestampCreated);
    }
}
