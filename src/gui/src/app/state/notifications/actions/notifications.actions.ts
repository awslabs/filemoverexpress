import { createAction, props } from '@ngrx/store';
import { FTNotification } from '../../models/notifications.model';

export const create = createAction(
    '[Notifications Service] Add Notification',
    props<{
        notification: FTNotification,
    }>(),
);

export const clear = createAction(
    '[Notifications Service] Clear All Notifications',
);
