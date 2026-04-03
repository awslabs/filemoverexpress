import { createFeatureSelector, createSelector } from '@ngrx/store';
import * as notificationReducer from './reducers/notifications.reducer';

export const selectNotificationState = createFeatureSelector<notificationReducer.NotificationState>(notificationReducer.notificationsFeatureKey);
export const selectAll = createSelector(selectNotificationState, notificationReducer.selectAll);
export const selectTotal = createSelector(selectNotificationState, notificationReducer.selectTotal);
