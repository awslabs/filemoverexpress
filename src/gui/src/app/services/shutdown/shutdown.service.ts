import { inject, Injectable, NgZone, OnDestroy, RendererFactory2 } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { ConfirmationModalComponent } from '@app/components/modals/confirmation-modal/confirmation-modal.component';
import { ConfirmationModalData } from '@app/components/modals/confirmation-modal/confirmation-modal.interfaces';
import { MessageModalComponent } from '@app/components/modals/message-modal/message-modal.component';
import { MessageModalData } from '@app/components/modals/message-modal/message-modal.interfaces';
import { isElectronApp } from '@app/utils/utils';
import { ShutdownResult } from '@gen/es/fme/v1/shared_pb';
import { Store } from '@ngrx/store';
import { ExportService } from '@services/export/export.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { PreferencesService } from '@services/preferences/preferences.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { selectConnectionState } from '@state/fme-client/fme-client.selectors';
import { Observable, Subject, Subscription, take } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class ShutdownService implements OnDestroy {
    private fmeClientService = inject(FmeClientService);
    private prefService = inject(PreferencesService);
    private exportService = inject(ExportService);
    private notifications = inject(NotificationsService);
    private store = inject(Store);
    private dialog = inject(MatDialog);
    private rf = inject(RendererFactory2);
    private zone = inject(NgZone);

    connected = false;
    subscriptions: Subscription[] = [];

    constructor() {
        this.fatalShutdownHandler();
        this.appCloseHandler();
        this.subscriptions.push(this.fmeClientService.connectionState.pipe(
            handleStreamError({retryCount: 5, fatal: true}),
        ).subscribe({
            next: (connectionState) => {
                this.connected = connectionState === ConnectionState.CONNECTED;
            },
            error: (error) => {
                this.fmeClientService.processStreamError(error);
            },
        }));
    }

    ngOnDestroy(): void {
        this.subscriptions.map((subscription) => subscription.unsubscribe());
        this.subscriptions = [];
        if (isElectronApp()) {
            window.fme?.removeAllListeners('closed');
            window.fme?.removeAllListeners('executeDaemonMode');
            window.fme?.removeAllListeners('stopDaemon');
        }
    }

    /**
     * Listens on the fatal-shutdown channel and handles shutdown of the shell when a fatal shutdown occurs.
     * @private
     */
    private fatalShutdownHandler() {
        if (isElectronApp()) {
            window.fme?.on('fatal-shutdown', () => {
                if (this.connected) {
                    const dialogRef = this.dialog.open<ConfirmationModalComponent, Partial<ConfirmationModalData>, boolean>(
                        ConfirmationModalComponent,
                        {
                            data: {
                                cancelText: 'No',
                                confirmText: 'Yes',
                                message: 'A fatal error has occurred and the application will be shut down. ' +
                                    'Would you like to attempt to save a support file and your transfer data?',
                                title: 'Fatal Error',
                                cancelClass: 'warn',
                                confirmClass: 'primary',
                            },
                        },
                    );
                    dialogRef.afterClosed().subscribe({
                        next: (result) => {
                            try {
                                if (result === true) {
                                    this.saveSupportFileAndExportData();
                                } else {
                                    window.fme?.send('closed');
                                }
                            } catch {
                                window.fme?.send('closed');
                            }
                        },
                        error: () => {
                            window.fme?.send('closed');
                        },
                    });
                } else {
                    const dialogRef = this.dialog.open<ConfirmationModalComponent, Partial<ConfirmationModalData>, boolean>(
                        ConfirmationModalComponent,
                        {
                            data: {
                                cancelText: 'No',
                                confirmText: 'Yes',
                                message: 'A fatal error has occurred and the application will be shut down. ' +
                                    'Would you like to attempt to save your transfer data?',
                                title: 'Fatal Error',
                                cancelClass: 'warn',
                                confirmClass: 'primary',
                            },
                        },
                    );
                    dialogRef.afterClosed().subscribe({
                        next: (result) => {
                            try {
                                if (result === true) {
                                    this.exportJobs();
                                } else {
                                    window.fme?.send('closed');
                                }
                            } catch {
                                window.fme?.send('closed');
                            }
                        },
                        error: () => {
                            window.fme?.send('closed');
                        },
                    });
                }
            });
        }
    }

    showDaemonCloseModal(): Observable<boolean> {
        const sub = new Subject<boolean>();
        this.store.select(selectConnectionState).pipe(
            take(1),
            handleStreamError({retryCount: 3}),
        ).subscribe({
            next: (connectionState) => {
                if (connectionState === ConnectionState.CONNECTED) {
                    this.zone.run(() => {
                        const dialogRef = this.dialog.open<ConfirmationModalComponent, Partial<ConfirmationModalData>, boolean>(
                            ConfirmationModalComponent,
                            {
                                disableClose: true,
                                width: '40%',
                                data: {
                                    cancelText: 'Leave running',
                                    confirmText: 'Stop daemon',
                                    message: 'File Transfer can leave the daemon running in the background to complete pending transfers. Would you like File Transfer to leave the background process running?',
                                    title: 'Stop Daemon?',
                                    confirmClass: 'warn',
                                    confirmType: 'stroked',
                                },
                            },
                        );

                        dialogRef.afterClosed().subscribe(
                            (result) => {
                                sub.next(result === undefined ? true : result);
                                sub.complete();
                            });
                    });
                } else {
                    window.fme?.send('closed');
                }
            },
            error: () => {
                window.fme?.send('closed');
            },
        });
        return sub.asObservable();
    }

    private appCloseHandler() {
        if (isElectronApp()) {
            window.fme?.on('app-close', () => {
                switch (this.prefService.daemonClose) {
                    case 'always':
                        this.doShutdown();
                        break;
                    case 'never':
                        window.fme?.send('closed');
                        break;
                    default:
                        this.showDaemonCloseModal().subscribe(
                            (shouldKillDaemon) => {
                                if (shouldKillDaemon) {
                                    this.doShutdown();
                                } else {
                                    window.fme?.send('closed');
                                }
                            },
                        );
                }
            });
        }
    }

    private doShutdown() {
        this.fmeClientService.shutdown().subscribe(
            {
                next: (result) => {
                    switch (result) {
                        case ShutdownResult.SUCCEEDED:
                        case ShutdownResult.RESTRICTED:
                            window.fme?.send('closed');
                            return;
                        case ShutdownResult.FAILED:
                            this.showFailedShutdownModal();
                            return;
                        default:
                            console.debug(`received an unexpected shutdown result ${result}`);
                    }
                },
                error: (err) => {
                    console.error(err);
                },
            },
        );
    }

    private showFailedShutdownModal() {
        const dialogRef = this.dialog.open<MessageModalComponent, Partial<MessageModalData>>(
            MessageModalComponent,
            {
                data: {
                    message: 'Unable to shutdown local daemon. GUI will exit when you click close, but you will need to manually stop the existing daemon process',
                    title: 'Failed to Shutdown',
                },
            },
        );

        dialogRef.afterClosed().subscribe(
            () => {
                window.fme?.send('closed');
            },
        );
    }


    /**
     * Saves a support file and exports the jobs table in the event that a fatal shutdown occurs.
     * @private
     */
    private saveSupportFileAndExportData() {
        this.fmeClientService.generateSupportFile().subscribe({
            next: (result) => {
                if (result.success) {
                    try {
                        window.addEventListener('blur', () => {
                            window.addEventListener('focus', () => {
                                this.exportJobs();
                            });
                        });
                        this.notifications.success('Support file generation completed');
                        const renderer = this.rf.createRenderer(null, null);
                        const link = renderer.createElement('a');
                        link.href = `data:application/zip;base64,${result.data}`;
                        link.download = result.filename;
                        link.click();
                        link.remove();
                    } catch {
                        window.fme?.send('closed');
                    }
                } else {
                    this.notifications.error(result.error);
                    this.exportJobs();
                }
            },
            error: () => {
                this.exportJobs();
            },
        });
    }


    /**
     * Uses the export service to export the jobs.
     * @private
     */
    private exportJobs() {
        window.addEventListener('blur', this.onBlurHandler.bind(this));

        this.exportService.exportJobs({
            format: 'xlsx',
        });
    }

    /**
     * Handles when the window is blurred. This indicates that the export is in progress.
     * @private
     */
    private onBlurHandler() {
        window.addEventListener('focus', this.onFocusHandler.bind(this));
        window.removeEventListener('blur', this.onBlurHandler.bind(this));
    }

    /**
     * Handles when the window is focused on. This indicates that the export has completed.
     * @private
     */
    private onFocusHandler() {
        const closeDialogRef = this.dialog.open<ConfirmationModalComponent, Partial<ConfirmationModalData>, boolean>(
            ConfirmationModalComponent,
            {
                disableClose: true,
                data: {
                    title: 'Export complete',
                    confirmText: 'Close',
                    confirmClass: 'primary',
                },
            },
        );

        closeDialogRef.afterClosed().subscribe((closeApp) => {
            if (closeApp) {
                window.fme?.send('closed');
            }
        });

        window.removeEventListener('focus', this.onFocusHandler.bind(this));
    }
}
