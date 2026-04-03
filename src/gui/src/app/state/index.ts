import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { environment } from '../../environments/environment';
import { FmeClientState, reducer as fmeClientReducer } from '@state/fme-client/reducers/fme-client.reducer';
import { LogsState, reducer as logsReducer } from '@state/logs/reducers/logs.reducer';
import { JobState, reducer as jobReducer } from '@state/job/reducers/job.reducer';
import { reducer as transferStatsReducer, TransferStatsState } from '@state/transfer-stats/reducers/transfer-stats.reducer';
import { NotificationState, reducer as notificationsReducer } from '@state/notifications/reducers/notifications.reducer';

export interface AppState {
    fmeClient: FmeClientState,
    logs: LogsState,
    jobs: JobState,
    transferStats: TransferStatsState,
    notifications: NotificationState,
}

export const reducers: ActionReducerMap<AppState> = {
    fmeClient: fmeClientReducer,
    logs: logsReducer,
    jobs: jobReducer,
    transferStats: transferStatsReducer,
    notifications: notificationsReducer,
};

export const metaReducers: MetaReducer<AppState>[] = !environment.production ? [] : [];
