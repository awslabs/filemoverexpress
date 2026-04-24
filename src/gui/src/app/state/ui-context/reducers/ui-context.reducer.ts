import { createReducer, on } from '@ngrx/store';
import { UiContextState } from '@state/models/ui-context.model';
import * as UiContextActions from '../actions/ui-context.actions';

export const uiContextFeatureKey = 'uiContext';

export const initialState: UiContextState = {
    daemonBrowserPath: '',
    bucketBrowserPath: '',
};

export const reducer = createReducer(
    initialState,
    on(UiContextActions.setDaemonBrowserPath,
        (state, { path }) => ({
            ...state,
            daemonBrowserPath: path,
        }),
    ),
    on(UiContextActions.clearDaemonBrowserPath,
        (state) => ({
            ...state,
            daemonBrowserPath: '',
        }),
    ),
    on(UiContextActions.setBucketBrowserPath,
        (state, { path }) => ({
            ...state,
            bucketBrowserPath: path,
        }),
    ),
    on(UiContextActions.clearBucketBrowserPath,
        (state) => ({
            ...state,
            bucketBrowserPath: '',
        }),
    ),
);
