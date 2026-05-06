import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { Action } from '@ngrx/store';
import { reducer as jobReducer, initialState as jobInitialState, JobState } from './job/reducers/job.reducer';
import { reducer as uiContextReducer, initialState as uiContextInitialState } from './ui-context/reducers/ui-context.reducer';
import { UiContextState } from './models/ui-context.model';
import { Job, JobStatus } from './models/job.model';
import { TransferDirection } from '@app/interfaces/jobs-table';
import * as JobActions from './job/actions/job.actions';
import * as UiContextActions from './ui-context/actions/ui-context.actions';

/**
 * Property-based tests for NgRx reducer state transitions.
 * Validates: Requirements 8.4, 11.1
 *
 * These tests generate arbitrary action sequences and verify that state invariants
 * hold after any sequence of actions is applied to the initial state.
 */

// --- Arbitraries ---

// Use UUID-like IDs to avoid collisions with Object.prototype properties (e.g., "constructor")
const jobIdArb = fc.stringMatching(/^job-[a-z0-9]{1,8}$/);
const jobNameArb = fc.stringMatching(/^[a-zA-Z0-9 _-]{1,20}$/);
const pathArb = fc.stringMatching(/^(\/[a-z0-9_-]{1,8}){0,4}\/?$/);
const bytesArb = fc.nat({ max: 1_000_000_000 });

const jobStatusArb = fc.constantFrom(
    JobStatus.Created,
    JobStatus.Discovering,
    JobStatus.Checksumming,
    JobStatus.Filtering,
    JobStatus.InProgress,
    JobStatus.Paused,
    JobStatus.Cancelled,
    JobStatus.Completed,
    JobStatus.Error,
    JobStatus.Unknown,
);

const directionArb = fc.constantFrom(TransferDirection.Upload, TransferDirection.Download);

const jobArb: fc.Arbitrary<Job> = fc.record({
    id: jobIdArb,
    name: jobNameArb,
    transferProfile: fc.stringMatching(/^[a-z]{1,10}$/),
    status: jobStatusArb,
    statusMessage: fc.string({ maxLength: 20 }),
    totalBytes: bytesArb,
    bytesTransferred: bytesArb,
    progress: fc.integer({ min: 0, max: 100 }),
    eta: fc.string({ maxLength: 15 }),
    hasTaskErrors: fc.boolean(),
    hasSuccessfulTasks: fc.boolean(),
    lastUpdate: fc.date(),
    destination: pathArb,
    direction: directionArb,
    timestampCreated: fc.date(),
    timestampDiscovering: fc.option(fc.date(), { nil: null }),
    timestampChecksumming: fc.option(fc.date(), { nil: null }),
    timestampTransferring: fc.option(fc.date(), { nil: null }),
    timestampCompleted: fc.option(fc.date(), { nil: null }),
    checksumProgress: fc.constant(null),
});

/**
 * Generate an arbitrary job action. We use a mix of create, progress, pause,
 * resume, cancel, complete, error, clearCompleted, clearAll, update, updateJobs, etc.
 */
function jobActionArb(): fc.Arbitrary<Action> {
    return fc.oneof(
        // create action
        jobArb.map((job) => JobActions.create({ job })),
        // progress action
        fc.record({
            id: jobIdArb,
            changes: fc.record({
                bytesTransferred: bytesArb,
                totalBytes: bytesArb,
                status: jobStatusArb,
            }),
        }).map(({ id, changes }) => JobActions.progress({ job: { id, changes } })),
        // pause action
        fc.record({
            id: jobIdArb,
            changes: fc.record({ status: fc.constant(JobStatus.Paused) }),
        }).map(({ id, changes }) => JobActions.pause({ job: { id, changes } })),
        // resume action
        fc.record({
            id: jobIdArb,
            changes: fc.record({ status: fc.constant(JobStatus.InProgress) }),
        }).map(({ id, changes }) => JobActions.resume({ job: { id, changes } })),
        // cancel action
        fc.record({
            id: jobIdArb,
            changes: fc.record({ status: fc.constant(JobStatus.Cancelled) }),
        }).map(({ id, changes }) => JobActions.cancel({ job: { id, changes } })),
        // complete action
        fc.record({
            id: jobIdArb,
            changes: fc.record({ status: fc.constant(JobStatus.Completed) }),
        }).map(({ id, changes }) => JobActions.complete({ job: { id, changes } })),
        // error action
        fc.record({
            id: jobIdArb,
            changes: fc.record({ status: fc.constant(JobStatus.Error), statusMessage: fc.string({ maxLength: 20 }) }),
        }).map(({ id, changes }) => JobActions.error({ job: { id, changes } })),
        // completeWithErrors action
        fc.record({
            id: jobIdArb,
            changes: fc.record({ status: fc.constant(JobStatus.Error) }),
        }).map(({ id, changes }) => JobActions.completeWithErrors({ job: { id, changes } })),
        // skip action
        fc.record({
            id: jobIdArb,
            changes: fc.record({ status: fc.constant(JobStatus.Completed) }),
        }).map(({ id, changes }) => JobActions.skip({ job: { id, changes } })),
        // clearCompleted
        fc.constant(JobActions.clearCompleted()),
        // clearAll
        fc.constant(JobActions.clearAll()),
        // updateJobs (set all)
        fc.array(jobArb, { minLength: 0, maxLength: 3 }).map((jobs) => JobActions.updateJobs({ jobs })),
        // updateStatus
        fc.record({
            id: jobIdArb,
            changes: fc.record({ status: jobStatusArb }),
        }).map(({ id, changes }) => JobActions.updateStatus({ job: { id, changes } })),
    );
}

/**
 * Generate an arbitrary ui-context action.
 */
function uiContextActionArb(): fc.Arbitrary<Action> {
    return fc.oneof(
        pathArb.map((path) => UiContextActions.setDaemonBrowserPath({ path })),
        fc.constant(UiContextActions.clearDaemonBrowserPath()),
        pathArb.map((path) => UiContextActions.setBucketBrowserPath({ path })),
        fc.constant(UiContextActions.clearBucketBrowserPath()),
    );
}

// --- Property Tests ---

describe('[Reducers] Job reducer state invariants - property tests', () => {
    it('state always has ids array and entities object after any action sequence', () => {
        fc.assert(
            fc.property(
                fc.array(jobActionArb(), { minLength: 1, maxLength: 20 }),
                (actions) => {
                    let state: JobState = jobInitialState;
                    for (const action of actions) {
                        state = jobReducer(state, action);
                    }
                    // Entity state structural invariants
                    expect(state).toHaveProperty('ids');
                    expect(state).toHaveProperty('entities');
                    expect(Array.isArray(state.ids)).toBe(true);
                    expect(typeof state.entities).toBe('object');
                    expect(state.entities).not.toBeNull();
                },
            ),
            { numRuns: 200 },
        );
    });

    it('entity IDs in ids array are always strings, never undefined', () => {
        fc.assert(
            fc.property(
                fc.array(jobActionArb(), { minLength: 1, maxLength: 20 }),
                (actions) => {
                    let state: JobState = jobInitialState;
                    for (const action of actions) {
                        state = jobReducer(state, action);
                    }
                    for (const id of state.ids) {
                        expect(id).toBeDefined();
                        expect(typeof id).toBe('string');
                    }
                },
            ),
            { numRuns: 200 },
        );
    });

    it('every ID in ids array has a corresponding entity that is not undefined', () => {
        fc.assert(
            fc.property(
                fc.array(jobActionArb(), { minLength: 1, maxLength: 20 }),
                (actions) => {
                    let state: JobState = jobInitialState;
                    for (const action of actions) {
                        state = jobReducer(state, action);
                    }
                    for (const id of state.ids) {
                        expect(state.entities[id]).toBeDefined();
                        expect(state.entities[id]).not.toBeNull();
                    }
                },
            ),
            { numRuns: 200 },
        );
    });

    it('entities always have required Job fields (id, name, status) defined', () => {
        fc.assert(
            fc.property(
                fc.array(jobActionArb(), { minLength: 1, maxLength: 15 }),
                (actions) => {
                    let state: JobState = jobInitialState;
                    for (const action of actions) {
                        state = jobReducer(state, action);
                    }
                    for (const id of state.ids) {
                        const entity = state.entities[id];
                        if (entity) {
                            expect(entity.id).toBeDefined();
                            expect(typeof entity.id).toBe('string');
                            expect(entity.name).toBeDefined();
                            expect(entity.status).toBeDefined();
                        }
                    }
                },
            ),
            { numRuns: 200 },
        );
    });

    it('ids array length always matches number of non-undefined entities', () => {
        fc.assert(
            fc.property(
                fc.array(jobActionArb(), { minLength: 1, maxLength: 20 }),
                (actions) => {
                    let state: JobState = jobInitialState;
                    for (const action of actions) {
                        state = jobReducer(state, action);
                    }
                    const entityCount = Object.values(state.entities).filter((e) => e !== undefined).length;
                    expect(state.ids.length).toBe(entityCount);
                },
            ),
            { numRuns: 200 },
        );
    });

    it('no undefined fields in top-level state structure after any action sequence', () => {
        fc.assert(
            fc.property(
                fc.array(jobActionArb(), { minLength: 0, maxLength: 15 }),
                (actions) => {
                    let state: JobState = jobInitialState;
                    for (const action of actions) {
                        state = jobReducer(state, action);
                    }
                    // Top-level fields must not be undefined
                    expect(state.ids).not.toBeUndefined();
                    expect(state.entities).not.toBeUndefined();
                },
            ),
            { numRuns: 200 },
        );
    });
});

describe('[Reducers] UI Context reducer state invariants - property tests', () => {
    it('state always conforms to UiContextState shape after any action sequence', () => {
        fc.assert(
            fc.property(
                fc.array(uiContextActionArb(), { minLength: 1, maxLength: 20 }),
                (actions) => {
                    let state: UiContextState = uiContextInitialState;
                    for (const action of actions) {
                        state = uiContextReducer(state, action);
                    }
                    expect(state).toHaveProperty('daemonBrowserPath');
                    expect(state).toHaveProperty('bucketBrowserPath');
                    expect(typeof state.daemonBrowserPath).toBe('string');
                    expect(typeof state.bucketBrowserPath).toBe('string');
                },
            ),
            { numRuns: 200 },
        );
    });

    it('paths are always strings (never undefined or null) after any action sequence', () => {
        fc.assert(
            fc.property(
                fc.array(uiContextActionArb(), { minLength: 1, maxLength: 30 }),
                (actions) => {
                    let state: UiContextState = uiContextInitialState;
                    for (const action of actions) {
                        state = uiContextReducer(state, action);
                    }
                    expect(state.daemonBrowserPath).not.toBeNull();
                    expect(state.daemonBrowserPath).not.toBeUndefined();
                    expect(state.bucketBrowserPath).not.toBeNull();
                    expect(state.bucketBrowserPath).not.toBeUndefined();
                },
            ),
            { numRuns: 200 },
        );
    });

    it('no undefined fields exist in the state object after any action sequence', () => {
        fc.assert(
            fc.property(
                fc.array(uiContextActionArb(), { minLength: 0, maxLength: 20 }),
                (actions) => {
                    let state: UiContextState = uiContextInitialState;
                    for (const action of actions) {
                        state = uiContextReducer(state, action);
                    }
                    const keys = Object.keys(state) as (keyof UiContextState)[];
                    for (const key of keys) {
                        expect(state[key]).not.toBeUndefined();
                    }
                },
            ),
            { numRuns: 200 },
        );
    });
});
