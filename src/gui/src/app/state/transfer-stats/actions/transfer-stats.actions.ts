import { createAction, props } from '@ngrx/store';
import { TransferStats } from '@state/models/transfer-stats.model';

export const update = createAction(
    '[TransferStats Service] Update',
    props<{ transferStats: TransferStats }>(),
);
