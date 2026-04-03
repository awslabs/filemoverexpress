import { createAction } from '@ngrx/store';

export const tryConnect = createAction(
    '[Progress Service] Try Connect Session',
);

export const succeedConnect = createAction(
    '[Progress Service] Succeed Connect Session',
);

export const disconnect = createAction(
    '[Progress Service] Disconnect Session',
);
