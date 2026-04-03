import { createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import * as JobActions from '../actions/job.actions';
import { Job, JobStatus } from '../../models/job.model';
import { calculateTimeToCompletion } from '@app/classes/time-to-completion';

export const jobFeatureKey = 'jobs';

export type JobState = EntityState<Job>;

export const adapter: EntityAdapter<Job> = createEntityAdapter<Job>({
    sortComparer: (a, b) => {
        if (a.timestampCreated < b.timestampCreated) {
            return -1;
        } else if (a.timestampCreated === b.timestampCreated) {
            return 0;
        } else {
            return 1;
        }
    },
});
export const initialState: JobState = adapter.getInitialState();
const clearableStates: JobStatus[] = [
    JobStatus.Completed,
    JobStatus.Error,
    JobStatus.Cancelled,
];

export const reducer = createReducer(
    initialState,
    on(JobActions.create,
        (state, action) => {
            return adapter.addOne(action.job, state);
        },
    ),

    on(JobActions.progress,
        (state, action) => {
            const entity = state.entities[action.job.id];
            if (!entity) {
                console.debug('[Job] Got a progress event without a start event');
                return state;
            }
            if (entity.status === JobStatus.Cancelled) {
                return state;
            }

            let eta = 'Unknown';
            let progress = 0;

            const {
                bytesTransferred,
                totalBytes,
            } = action.job.changes;

            if (bytesTransferred !== undefined && bytesTransferred < 0) {
                return state;
            }

            if (entity.timestampTransferring && bytesTransferred && totalBytes) {
                progress = parseFloat(((bytesTransferred / totalBytes) * 100).toFixed(2));
                eta = calculateTimeToCompletion(entity.timestampTransferring, totalBytes, bytesTransferred);
            }

            if (entity.status === JobStatus.Paused) {
                const status = entity.status;
                return {
                    ...adapter.updateOne(
                        {
                            ...action.job,
                            changes: {
                                bytesTransferred,
                                totalBytes,
                                status,
                                progress,
                                eta,
                            },
                        },
                        state,
                    ),
                };
            }

            return {
                ...adapter.updateOne(
                    {
                        ...action.job,
                        changes: {
                            ...action.job.changes,
                            progress,
                            eta,
                        },
                    },
                    state,
                ),
            };
        },
    ),

    on(JobActions.pause,
        (state, action) => {
            const entity = state.entities[action.job.id];
            if (!entity) {
                console.debug('[Job] Got a pause event without a create event');
                return state;
            }
            if (entity.status != JobStatus.InProgress) {
                //   console.debug('[Job] Got a pause event when event was not in progress:', entity.status);
                return state;
            }
            return adapter.updateOne(
                {
                    ...action.job,
                    changes: {...action.job.changes},
                }, state,
            );
        },
    ),

    on(JobActions.resume,
        (state, action) => {
            const entity = state.entities[action.job.id];
            if (!entity) {
                console.debug('[Job] Got a resume event without a create event');
                return state;
            }
            if (entity.status != JobStatus.Paused) {
                console.debug('[Job] Got a resume event when event was not paused');
                return state;
            }
            return adapter.updateOne(
                {
                    ...action.job,
                    changes: {...action.job.changes},
                }, state,
            );
        },
    ),

    on(JobActions.cancel,
        (state, action) => {
            const entity = state.entities[action.job.id];
            if (!entity) {
                console.debug('[Job] Got a cancel event without a create event');
                return state;
            }
            if (entity.status == JobStatus.Completed) {
                console.debug('[Job] Got a cancel event when event was already complete');
                return state;
            }
            return adapter.updateOne(
                {
                    ...action.job,
                    changes: {...action.job.changes},
                }, state,
            );
        },
    ),

    on(JobActions.complete,
        (state, action) => {
            const entity = state.entities[action.job.id];
            if (!entity) {
                console.debug('[Job] Got a complete event without a create event');
                return state;
            }
            if (entity.status == JobStatus.Cancelled) {
                return state;
            }

            return {
                ...adapter.updateOne(
                    {
                        ...action.job,
                        changes: {
                            ...action.job.changes,
                            bytesTransferred: entity.totalBytes,
                            progress: 100,
                            eta: 'Completed',
                        },
                    },
                    state,
                ),
            };
        },
    ),

    on(JobActions.error,
        (state, action) => {
            if (!(action.job.id in state.entities)) {
                console.debug('[Job] Got a error event without a create event');
                return state;
            }

            return {
                ...adapter.updateOne(
                    {
                        ...action.job,
                        changes: {
                            ...action.job.changes,
                            eta: 'Error',
                        },
                    },
                    state,
                ),
            };
        },
    ),

    on(JobActions.completeWithErrors,
        (state, action) => {
            if (!(action.job.id in state.entities)) {
                console.debug('[Job] Got a completeWithErrors event without a create event');
                return state;
            }

            return {
                ...adapter.updateOne(
                    {
                        ...action.job,
                        changes: {
                            ...action.job.changes,
                            progress: 100,
                            eta: 'Completed',
                        },
                    },
                    state,
                ),
            };
        },
    ),

    on(JobActions.skip,
        (state, action) => {
            if (!(action.job.id in state.entities)) {
                console.debug('[Job] Got a skip event without a create event');
                return state;
            }

            return {
                ...adapter.updateOne(
                    {
                        ...action.job,
                        changes: {
                            ...action.job.changes,
                            progress: 100,
                            eta: 'Completed',
                        },
                    },
                    state,
                ),
            };
        },
    ),

    on(JobActions.clearCompleted,
        (state) => {
            return {
                ...adapter.removeMany((itm) => clearableStates.includes(itm.status), state),
            };
        },
    ),

    on(JobActions.clearAll,
        (state) => {
            return {
                ...adapter.removeAll(state),
            };
        },
    ),

    on(JobActions.update,
        (state, action) => {
            if (!(action.job.id in state.entities)) {
                console.debug('[Job] Got an update event without a create event');
                return state;
            }

            return {
                ...adapter.updateOne(action.job, state),
            };
        },
    ),

    on(JobActions.updateJobs,
        (state, action) => {
            const jobs = action.jobs.map((itm) => {
                return itm;
            });
            return adapter.setAll(jobs, state);
        },
    ),

    on(JobActions.updateStatus,
        (state, action) => {
            if (!(action.job.id in state.entities)) {
                console.debug('[Job] Got a JobStatusChangeEvent without a create event');
                return state;
            }

            // We're not updating when we get a completion as the `JobCompleteEvent` takes care of signalling all the necessary
            // information necessary for the GUI.
            if (action.job.changes.status === JobStatus.Completed) {
                return state;
            }

            return {
                ...adapter.updateOne(action.job, state),
            };
        },
    ),

    on(JobActions.updateChecksumProgress,
        (state, action) => {
            if (!(action.job.id in state.entities)) {
                console.debug('[Job] Got a JobStatusChangeEvent without a create event');
                return state;
            }

            return adapter.updateOne(action.job, state);
        }),
);

export const {
    selectIds,
    selectEntities,
    selectAll,
    selectTotal,
} = adapter.getSelectors();
