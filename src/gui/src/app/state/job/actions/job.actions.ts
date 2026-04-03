import { createAction, props } from '@ngrx/store';
import { Update } from '@ngrx/entity';
import { Job } from '../../models/job.model';

export const create = createAction(
    '[Job Service] Create Job',
    props<{
        job: Job,
    }>(),
);

export const progress = createAction(
    '[Job Service] Job Progress',
    props<{
        job: Update<Job>,
    }>(),
);

export const complete = createAction(
    '[Job Service] Complete Job',
    props<{
        job: Update<Job>,
    }>(),
);

export const error = createAction(
    '[Job Service] Job Error',
    props<{
        job: Update<Job>,
    }>(),
);

export const pause = createAction(
    '[Job Service] Pause Job',
    props<{
        job: Update<Job>,
    }>(),
);

export const resume = createAction(
    '[Job Service] Resume Job',
    props<{
        job: Update<Job>,
    }>(),
);

export const cancel = createAction(
    '[Job Service] Cancel Job',
    props<{
        job: Update<Job>,
    }>(),
);

export const completeWithErrors = createAction(
    '[Job Service] Complete Job With Errors',
    props<{
        job: Update<Job>,
    }>(),
);

export const skip = createAction(
    '[Job Service] Skip Job',
    props<{
        job: Update<Job>,
    }>(),
);

export const clearCompleted = createAction(
    '[Job Service] Clear Job',
);

export const clearAll = createAction(
    '[Job Service] Clear All Jobs',
);

export const update = createAction(
    '[Job Service] Update Job Details',
    props<{
        job: Update<Job>,
    }>(),
);

export const updateJobs = createAction(
    '[Job Service] Update Jobs',
    props<{
        jobs: Job[],
    }>(),
);

export const updateStatus = createAction(
    '[Job Service] Update Status',
    props<{
        job: Update<Job>,
    }>(),
);

export const updateChecksumProgress = createAction(
    '[Job Service] Update Checksum Progress',
    props<{
        job: Update<Job>,
    }>(),
);
