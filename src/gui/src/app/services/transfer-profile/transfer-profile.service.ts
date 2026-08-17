import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { ConfirmationModalComponent } from '@app/components/modals/confirmation-modal/confirmation-modal.component';
import { TransferProfileEditorModalComponent } from '@app/components/modals/transfer-profile-editor-modal/transfer-profile-editor-modal.component';
import { MetadataService } from '../metadata/metadata.service';
import { BehaviorSubject, Observable, of, Subject, Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransferProfileState } from './transfer-profile.interfaces';

@Injectable({
    providedIn: 'root',
})
export class TransferProfileService implements OnDestroy {
    private metadata = inject(MetadataService);
    private fmeClientService = inject(FmeClientService);
    private notifications = inject(NotificationsService);
    private dialog = inject(MatDialog);

    private readonly transferProfileState$: BehaviorSubject<TransferProfileState> = new BehaviorSubject<TransferProfileState>({
        transferProfileList: null,
        currentTransferProfile: null,
        currentProfileIsOIDC: false,
    });
    public readonly transferProfileStateSig = signal<TransferProfileState>(
        {transferProfileList: null, currentTransferProfile: null, currentProfileIsOIDC: false},
    );
    private readonly transferProfileEdited$: Subject<string> = new Subject<string>();
    private _subscriptions: Subscription[] = [];
    private _transferProfileState: TransferProfileState = {
        transferProfileList: null,
        currentTransferProfile: null,
        currentProfileIsOIDC: false,
    };

    init() {
        this._subscriptions.push(this.metadata.onUpdateTransferProfileNames.subscribe({
            next: () => {
                try {
                    const currentTransferProfile = this._transferProfileState.currentTransferProfile;
                    const transferProfiles = Object.keys(this.metadata.transferProfiles).sort(function(a, b) {
                        return a.toLowerCase().localeCompare(b.toLowerCase());
                    });
                    if (!currentTransferProfile || !transferProfiles.includes(currentTransferProfile)) {
                        this._transferProfileState.currentTransferProfile = transferProfiles.length ? transferProfiles[0] : null;
                    }
                    this._transferProfileState.transferProfileList = transferProfiles;
                    this.transferProfileState$.next(this._transferProfileState);
                    this.transferProfileStateSig.set({...this._transferProfileState});
                } catch {
                    // this.metadata.transferProfiles throws error when metadata is not loaded (means no active session)
                    console.log('Metadata not loaded when transfer profile service started');
                    this.resetTransferProfileState();
                }
            },
        }));
    }

    /**
     * Unsubscribe from all subscriptions
     */
    ngOnDestroy() {
        this._subscriptions.map((subscription) => subscription.unsubscribe());
        this._subscriptions = [];
    }

    /**
     * Resets the state so that the transfer profile list and current transfer profile selection are null
     * @private
     */
    private resetTransferProfileState() {
        this._transferProfileState = {
            currentTransferProfile: null,
            transferProfileList: null,
            currentProfileIsOIDC: false,
        };
        this.transferProfileState$.next(this._transferProfileState);
        this.transferProfileStateSig.set({...this._transferProfileState});
    }

    /**
     * Get observable for transfer profile list and selection
     */
    get transferProfileState(): Observable<TransferProfileState> {
        return this.transferProfileState$ as Observable<TransferProfileState>;
    }

    /**
     * Sets the currently selected transfer profile name to the inputted name
     * @param transferProfile Name of the transfer profile to select
     */
    select(transferProfile: string) {
        if (!this.checkTransferProfileExists(transferProfile)) {
            return;
        }
        this._transferProfileState.currentTransferProfile = transferProfile;
        this.transferProfileState$.next(this._transferProfileState);
        this.transferProfileStateSig.set({...this._transferProfileState});
    }

    /**
     * Deletes the inputted transfer profile from the configuration file if the user clicks confirm in popup modal.
     * If the currently selected transfer profile is the one being deleted, sets the current selection to null.
     * @param transferProfile Name of the transfer profile to delete
     */
    delete(transferProfile: string): Observable<boolean> {
        if (!this.checkTransferProfileExists(transferProfile)) {
            return of(false);
        }
        let confirmationMessage = `Are you sure you want to delete <b>${transferProfile}</b>?`;
        if (this._transferProfileState.transferProfileList?.length === 1) {
            confirmationMessage += ' You must have at least one remote configuration in order to perform transfers.';
        } else if (this._transferProfileState.currentTransferProfile === transferProfile) {
            confirmationMessage += ' You are currently using this remote configuration.';
        }
        const dialogRef = this.dialog.open(
            ConfirmationModalComponent,
            {
                width: '500px',
                data: {
                    cancelText: 'Cancel',
                    confirmText: 'Delete',
                    confirmClass: 'warn',
                    message: confirmationMessage,
                    title: 'Delete Remote Configuration',
                },
            },
        );
        const afterClosed$ = dialogRef.afterClosed();
        afterClosed$.subscribe((result) => {
            if (result) {
                this.fmeClientService.getConfiguration().subscribe({
                    next: (config) => {
                        delete config.protocols.s3.transferProfiles[transferProfile];
                        this.fmeClientService.setConfiguration(config).subscribe({
                            next: () => {
                                if (this._transferProfileState.currentTransferProfile === transferProfile) {
                                    this._transferProfileState.currentTransferProfile = null;
                                }
                                this.notifications.success(`Successfully deleted remote configuration ${transferProfile}.`);
                            },
                            error: (error) => {
                                this.notifications.warning(`Error occurred when deleting remote configuration ${transferProfile}: ${error}`);
                            },
                        });
                    },
                    error: (error) => {
                        this.notifications.warning(`Error occurred when deleting remote configuration ${transferProfile}: ${error}`);
                    },
                });
            }
        });
        return afterClosed$;
    }

    /**
     * Opens transfer profile editor for inputted transfer profile name. On save, saves the new transfer profile data into the
     * configuration file. Emits name of transfer profile on transferProfileEdited after successful save.
     * @param transferProfile Name of the transfer profile to edit
     */
    edit(transferProfile: string) {
        if (!this.checkTransferProfileExists(transferProfile)) {
            return;
        }
        this.fmeClientService.getConfiguration().subscribe({
            next: (config) => {
                const transferProfileData = config.protocols.s3.transferProfiles[transferProfile];
                if (!transferProfileData) {
                    this.notifications.warning(`Remote configuration ${transferProfile} does not exist in configuration file.`);
                    return;
                }
                const dialogRef = this.dialog.open(TransferProfileEditorModalComponent, {
                    width: '60%',
                    maxWidth: '820px',
                    panelClass: 'rc-editor-dialog',
                    data: {
                        transferProfile: transferProfileData,
                        mode: 'update',
                    },
                    autoFocus: 'dialog',
                });
                dialogRef.componentInstance.transferProfileSaved.subscribe((result) => {
                    config.protocols.s3.transferProfiles[result.name] = result;
                    this.fmeClientService.setConfiguration(config).subscribe({
                        next: () => {
                            this.transferProfileEdited$.next(transferProfile);
                            this.notifications.success(`Successfully edited remote configuration ${transferProfile}.`);
                        },
                        error: (error) => {
                            this.notifications.warning(`Error occurred when editing remote configuration ${transferProfile}: ${error}`);
                        },
                    });
                });
            },
        });
    }

    /**
     * Opens transfer profile editor to add new transfer profile. On save, saves the new transfer profile data into the
     * configuration file.
     */
    add() {
        const dialogRef = this.dialog.open(TransferProfileEditorModalComponent, {
            width: '60%',
            maxWidth: '820px',
            panelClass: 'rc-editor-dialog',
            data: {
                mode: 'add',
            },
            autoFocus: 'dialog',
        });
        dialogRef.componentInstance.transferProfileSaved.subscribe((result) => {
            this.fmeClientService.getConfiguration().subscribe({
                next: (config) => {
                    config.protocols.s3.transferProfiles[result.name] = result;
                    this.fmeClientService.setConfiguration(config).subscribe({
                        next: () => {
                            this.notifications.success(`Successfully added remote configuration ${result.name}.`);
                        },
                        error: (error) => {
                            this.notifications.warning(`Error occurred when adding remote configuration ${result.name}: ${error}`);
                        },
                    });
                },
                error: (error) => {
                    this.notifications.warning(`Error occurred when adding remote configuration ${result.name}: ${error}`);
                },
            });
        });
    }


    /**
     * Checks if the given transfer profile name exists in the list of transfer profiles.
     * @param transferProfile Transfer profile name to check
     * @private
     */
    private checkTransferProfileExists(transferProfile: string): boolean {
        if (!this._transferProfileState.transferProfileList?.includes(transferProfile)) {
            this.notifications.warning(`Remote configuration ${transferProfile} doesn't exist in configuration file.`);
            return false;
        }
        return true;
    }
}
