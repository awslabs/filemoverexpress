import { createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter, EntityState } from '@ngrx/entity';
import * as NotificationActions from '../actions/notifications.actions';
import { FTNotification } from '../../models/notifications.model';

export const notificationsFeatureKey = 'notifications';

export type NotificationState = EntityState<FTNotification>;

export const adapter: EntityAdapter<FTNotification> = createEntityAdapter<FTNotification>({
    sortComparer: (a, b) => {
        if (a.timestamp < b.timestamp) {
            return 1;
        } else if (a.timestamp === b.timestamp) {
            return 0;
        } else {
            return -1;
        }
    },
});
export const initialState: NotificationState = adapter.getInitialState();

export const reducer = createReducer(
    initialState,
    on(NotificationActions.create,
        (state, action) => {
            return adapter.addOne(action.notification, state);
        },
    ),

    on(NotificationActions.clear,
        (state) => {
            return {
                ...adapter.removeAll(state),
            };
        },
    ),
);

export const {
    selectAll,
    selectTotal,
} = adapter.getSelectors();
