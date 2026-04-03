import { createFeatureSelector } from '@ngrx/store';
import * as fromTransferStats from './reducers/transfer-stats.reducer';

export const select = createFeatureSelector<fromTransferStats.TransferStatsState>(
    fromTransferStats.transferStatsFeatureKey,
);
