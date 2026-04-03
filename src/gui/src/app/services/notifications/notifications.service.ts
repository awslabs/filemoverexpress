import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { PreferencesService } from '../preferences/preferences.service';
import { NotificationPosition } from '../preferences/preferences.interfaces';
import { handleStreamError, StreamError } from '@app/classes/rxjs-operators';
import { AUTO_DISMISS_LEVELS, PanelLevel } from './notifications.constants';
import { QueuedMessage } from './notifications.interfaces';
import { defaultOptions } from '../preferences/preferences.constants';
import { Store } from '@ngrx/store';
import * as notificationActions from '@app/state/notifications/actions/notifications.actions';

@Injectable({
    providedIn: 'root',
})
export class NotificationsService {
    private snackbar = inject(MatSnackBar);
    private preferences = inject(PreferencesService);
    private store = inject(Store);

    private panelPosition: NotificationPosition = defaultOptions.notificationPosition;
    private panelAutoHide: number = defaultOptions.notificationAutoHideDelay;
    private messageQueue: QueuedMessage[] = [];
    private currentMessage: QueuedMessage | null = null;
    private isOpen = false;

    constructor() {
        this.updateFromPreferences();
        this.preferences.onUpdate.pipe(
            handleStreamError({retryCount: 5}),
        ).subscribe({
            next: () => {
                this.updateFromPreferences();
            },
            error: (error) => {
                this.notifyStreamError(error);
            },
        });
    }

    /**
     * Updates the current panel positioning and autohide settings when the user changes preferences
     * @private
     */
    private updateFromPreferences() {
        this.panelPosition = this.preferences.notificationPosition;
        this.panelAutoHide = this.preferences.notificationHideDelay;
    }

    /** Adds a new message to the pending notifications queue, as long as there's not a duplicate message already being displayed or queued
     *
     * @param message {string} Message for the notification
     * @param level {PanelLevel} Level, or color, for the panel
     * @private
     */
    private addToQueue(message: string, level: PanelLevel) {
        if (this.isOpen && this.currentMessage && this.currentMessage.message === message && this.currentMessage.level === level) {
            return;
        }

        for (const msg of this.messageQueue) {
            if (msg.message === message && msg.level === level) {
                return;
            }
        }
        this.messageQueue.push({
            message: message,
            level: level,
        });
    }

    /**
     * Handle any errors from the observable streams, and display a warning notification if needed
     * @param error
     */
    notifyStreamError(error: StreamError) {
        if (!error?.fatal && error?.message) {
            console.error(error.message);
            this.warning(error.message);
        }
    }

    /**
     * Opens a new notification with the given message and level
     * @param message {string} Notification message to display
     * @param level {PanelLevel} Panel level, or color, for the notification
     */
    open(message: string, level: PanelLevel) {
        if (this.isOpen) {
            this.addToQueue(message, level);
            return;
        }

        const d = new Date();
        this.store.dispatch(notificationActions.create({
            notification: {
                id: d.getTime().toString(),
                timestamp: d,
                message: message,
                level: level,
            },
        }));

        const panelOpts: MatSnackBarConfig = {
            panelClass: [
                'snackbar', level,
            ],
            horizontalPosition: this.panelPosition?.horizontal || 'center',
            verticalPosition: this.panelPosition?.vertical || 'top',
        };

        if (this.panelAutoHide >= 2500 && AUTO_DISMISS_LEVELS.includes(level)) {
            panelOpts.duration = this.panelAutoHide;
        }

        this.currentMessage = {message, level};
        const sb = this.snackbar.open(message, 'close', panelOpts);
        sb.afterDismissed().subscribe(() => {
            try {
                this.isOpen = false;
                this.currentMessage = null;
                this.processQueue();
            } catch (e) {
                console.error(e);
            }
        });
        this.isOpen = true;
    }

    /**
     * Handles processing the queue of notifications, showing the next message if one is available
     */
    processQueue() {
        if (this.messageQueue.length === 0) {
            return;
        }

        const msg = this.messageQueue.shift();
        if (msg) {
            this.open(msg.message, msg.level);
        }
    }

    /**
     * Helper for showing a default level message
     * @param message {string} Notification message to display
     */
    default(message: string) {
        this.open(message, PanelLevel.DEFAULT);
    }

    /**
     * Helper for showing a success level message
     * @param message {string} Notification message to display
     */
    success(message: string) {
        this.open(message, PanelLevel.SUCCESS);
    }

    /**
     * Helper for showing an info level message
     * @param message {string} Notification message to display
     */
    info(message: string) {
        this.open(message, PanelLevel.INFO);
    }

    /**
     * Helper for showing a warning level message
     * @param message {string} Notification message to display
     */
    warning(message: string) {
        this.open(message, PanelLevel.WARNING);
    }

    /**
     * Helper for showing an error level message
     * @param message {string} Notification message to display
     */
    error(message: string) {
        this.open(message, PanelLevel.ERROR);
    }

    /**
     * Clear the history of notifications
     */
    clearHistory() {
        this.store.dispatch(notificationActions.clear());
    }
}
