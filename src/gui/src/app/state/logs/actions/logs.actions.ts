import { createAction, props } from '@ngrx/store';
import { LogEntry } from '@state/models/log-entry.model';

export const addLog = createAction(
    '[Logs Service] Add Single Log Entry',
    props<{ log: LogEntry }>(),
);

export const bulkAddLog = createAction(
    '[Logs Service] Bulk Add Log Entries',
    props<{ logs: LogEntry[] }>(),
);
