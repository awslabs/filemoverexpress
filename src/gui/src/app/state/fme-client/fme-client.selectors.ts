import { createFeatureSelector, createSelector } from '@ngrx/store';
import { fmeClientFeatureKey, FmeClientState } from './reducers/fme-client.reducer';

export const selectFmeClientState = createFeatureSelector<FmeClientState>(fmeClientFeatureKey);
export const selectConnectionState = createSelector(
    selectFmeClientState,
    (state: FmeClientState) => state.connectionState,
);
