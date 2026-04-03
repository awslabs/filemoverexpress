import { createFeatureSelector, createSelector } from '@ngrx/store';
import * as jobReducer from './reducers/job.reducer';

export const selectJobState = createFeatureSelector<jobReducer.JobState>(jobReducer.jobFeatureKey);
export const selectAll = createSelector(selectJobState, jobReducer.selectAll);
export const selectTotal = createSelector(selectJobState, jobReducer.selectTotal);
export const selectJobById = (jobId: string) => createSelector(
    selectJobState,
    (state) => state.entities[jobId],
);
