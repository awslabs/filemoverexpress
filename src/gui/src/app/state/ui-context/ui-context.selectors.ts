import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UiContextState } from '@state/models/ui-context.model';
import { uiContextFeatureKey } from './reducers/ui-context.reducer';

export const selectUiContextState = createFeatureSelector<UiContextState>(uiContextFeatureKey);

export const selectDaemonBrowserPath = createSelector(
    selectUiContextState,
    (state: UiContextState) => state.daemonBrowserPath,
);

export const selectBucketBrowserPath = createSelector(
    selectUiContextState,
    (state: UiContextState) => state.bucketBrowserPath,
);
