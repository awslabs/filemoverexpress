import { createAction, props } from '@ngrx/store';

export const setDaemonBrowserPath = createAction(
    '[UI Context] Set Daemon Browser Path',
    props<{ path: string }>(),
);

export const clearDaemonBrowserPath = createAction(
    '[UI Context] Clear Daemon Browser Path',
);

export const setBucketBrowserPath = createAction(
    '[UI Context] Set Bucket Browser Path',
    props<{ path: string }>(),
);

export const clearBucketBrowserPath = createAction(
    '[UI Context] Clear Bucket Browser Path',
);
