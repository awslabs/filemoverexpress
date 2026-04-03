import { createFeatureSelector, createSelector } from '@ngrx/store';
import * as logsReducer from './reducers/logs.reducer';
import { LogsState } from './reducers/logs.reducer';

export const selectLogsState = createFeatureSelector<logsReducer.LogsState>(logsReducer.logsFeatureKey);
export const selectAll = createSelector(
    selectLogsState,
    (state: LogsState) => state.logs,
);
