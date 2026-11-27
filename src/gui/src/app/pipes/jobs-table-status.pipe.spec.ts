import { describe, it, expect } from 'vitest';
import { JobStatusPipe, JobStatusClassPipe } from './jobs-table-status.pipe';
import { Job, JobStatus } from '@state/models/job.model';

function job(partial: Partial<Job>): Job {
    return partial as Job;
}

describe('JobStatusPipe', () => {
    const pipe = new JobStatusPipe();

    it('creates an instance', () => {
        expect(pipe).toBeTruthy();
    });

    it('labels a partial transfer failure (COMPLETED_WITH_WARNINGS + task errors) as "Completed with Errors"', () => {
        const result = pipe.transform(job({ status: JobStatus.CompletedWithWarnings, hasTaskErrors: true, hasSuccessfulTasks: true }));
        expect(result).toBe('Completed with Errors');
    });

    it('labels an ASC MHL verification warning (COMPLETED_WITH_WARNINGS, no task errors) as "Complete w/ Warnings"', () => {
        const result = pipe.transform(job({ status: JobStatus.CompletedWithWarnings, hasTaskErrors: false, hasSuccessfulTasks: true }));
        expect(result).toBe('Complete w/ Warnings');
    });

    it('labels an all-failed job (ERROR) as "Error"', () => {
        const result = pipe.transform(job({ status: JobStatus.Error, hasTaskErrors: true, hasSuccessfulTasks: false }));
        expect(result).toBe('Error');
    });

    it('still labels a legacy COMPLETED job with both flags as "Completed with Errors"', () => {
        const result = pipe.transform(job({ status: JobStatus.Completed, hasTaskErrors: true, hasSuccessfulTasks: true }));
        expect(result).toBe('Completed with Errors');
    });

    it('labels a clean COMPLETED job as "Completed"', () => {
        const result = pipe.transform(job({ status: JobStatus.Completed, hasTaskErrors: false, hasSuccessfulTasks: true }));
        expect(result).toBe('Completed');
    });
});

describe('JobStatusClassPipe', () => {
    const pipe = new JobStatusClassPipe();

    it('gives a partial transfer failure the completed-with-errors class', () => {
        const result = pipe.transform(job({ status: JobStatus.CompletedWithWarnings, hasTaskErrors: true, hasSuccessfulTasks: true }));
        expect(result).toBe('status-completed-with-errors');
    });

    it('gives an ASC MHL verification warning the completed-with-warnings class', () => {
        const result = pipe.transform(job({ status: JobStatus.CompletedWithWarnings, hasTaskErrors: false, hasSuccessfulTasks: true }));
        expect(result).toBe('status-completed-with-warnings');
    });
});
