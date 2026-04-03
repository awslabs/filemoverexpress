import { createReducer, on } from '@ngrx/store';
import { TransferStats } from '@state/models/transfer-stats.model';
import * as TransferStatsAction from '../actions/transfer-stats.actions';

export const transferStatsFeatureKey = 'transferStats';

export type TransferStatsState = TransferStats;

export const initialState: TransferStatsState = {
    activeDownloads: 0,
    activeUploads: 0,
    downloadBps: 0,
    uploadBps: 0,
    totalBytesDownloaded: 0,
    totalBytesUploaded: 0,
};

export const reducer = createReducer(
    initialState,
    on(TransferStatsAction.update,
        (state, action) => {
            return {
                ...state,
                ...action,
            };
        },
    ),
);
