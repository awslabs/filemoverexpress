import { createReducer, on } from '@ngrx/store';
import { LogEntry } from '@state/models/log-entry.model';
import * as LogsActions from '../actions/logs.actions';

export const logsFeatureKey = 'logs';
export const MAX_LOG_ENTRIES = 500;

export interface LogsState {
    logs: LogEntry[],
}

export const initialState: LogsState = {
    logs: [],
};

export const reducer = createReducer(
    initialState,
    on(
        LogsActions.addLog,
        (state, {log}) => {
            let newLogs = [...state.logs, log];
            if (newLogs.length > MAX_LOG_ENTRIES) {
                newLogs = newLogs.splice(-MAX_LOG_ENTRIES);
            }
            return {
                ...state,
                ...{
                    logs: newLogs,
                },
            };
        },
    ),
    on(
        LogsActions.bulkAddLog,
        (state, {logs}) => {
            let newLogs = [...state.logs, ...logs];
            if (newLogs.length > MAX_LOG_ENTRIES) {
                newLogs = newLogs.splice(-MAX_LOG_ENTRIES);
            }
            return {
                ...state,
                ...{
                    logs: newLogs,
                },
            };
        },
    ),
);
