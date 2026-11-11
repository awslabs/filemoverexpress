import { describe, it, expect } from 'vitest';
import { initialState, reducer } from './job.reducer';
import { Action } from '@ngrx/store';
import * as JobActions from '../actions/job.actions';
import { Job, JobStatus } from '../../models/job.model';
import { TransferDirection } from '@app/interfaces/jobs-table';

function makeJob(id: string, status: JobStatus): Job {
    return {
        id,
        name: id,
        transferProfile: 'p',
        status,
        statusMessage: '',
        totalBytes: 100,
        bytesTransferred: 100,
        progress: 100,
        eta: 'Completed',
        hasTaskErrors: false,
        hasSuccessfulTasks: true,
        lastUpdate: new Date(),
        destination: '/d',
        direction: TransferDirection.Upload,
        timestampCreated: new Date(),
        timestampDiscovering: null,
        timestampChecksumming: null,
        timestampTransferring: null,
        timestampCompleted: new Date(),
        checksumProgress: null,
        force: false,
    };
}

describe('Job Reducer', () => {
    describe('unknown action', () => {
        it('should return the previous state', () => {
            const action = {} as Action;

            const result = reducer(initialState, action);

            expect(result).toBe(initialState);
        });
    });

    describe('clearJob', () => {
        it('removes only the targeted job and leaves the rest', () => {
            let state = reducer(initialState, JobActions.create({job: makeJob('job-a', JobStatus.Completed)}));
            state = reducer(state, JobActions.create({job: makeJob('job-b', JobStatus.Completed)}));

            const result = reducer(state, JobActions.clearJob({jobId: 'job-a'}));

            expect(result.ids).toEqual(['job-b']);
            expect(result.entities['job-a']).toBeUndefined();
            expect(result.entities['job-b']).toBeDefined();
        });

        it('is a no-op when the job id is not present', () => {
            const state = reducer(initialState, JobActions.create({job: makeJob('job-a', JobStatus.Completed)}));

            const result = reducer(state, JobActions.clearJob({jobId: 'missing'}));

            expect(result.ids).toEqual(['job-a']);
        });
    });
});
