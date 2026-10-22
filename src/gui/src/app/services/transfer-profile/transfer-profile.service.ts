import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { ConfirmationModalComponent } from '@app/components/modals/confirmation-modal/confirmation-modal.component';
import { TransferProfileEditorModalComponent } from '@app/components/modals/transfer-profile-editor-modal/transfer-profile-editor-modal.component';
import { MetadataService } from '../metadata/metadata.service';
import { BehaviorSubject, Observable, of, Subject, Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocalStorageService } from '../local-storage/local-storage.service';
import { TransferProfileState } from './transfer-profile.interfaces';

// Persists the name of the profile the user last explicitly selected so the choice
// survives an app restart. Without this the selection lives only in memory and every
// relaunch snaps back to the alphabetically-first profile.
export const CURRENT_TRANSFER_PROFILE_STORAGE_KEY = 'currentTransferProfile_v1';

@Injectable({
    providedIn: 'root',
})
export class TransferProfileService implements OnDestroy {
    private metadata = inject(MetadataService);
    private fmeClientService = inject(FmeClientService);
    private notifications = inject(NotificationsService);
    private dialog = inject(MatDialog);
    private readonly storage = inject(LocalStorageService);

    private readonly transferProfileState$: BehaviorSubject<TransferProfileState> = new BehaviorSubject<TransferProfileState>({
        transferProfileList: null,
        currentTransferProfile: null,
        currentProfileIsOIDC: false,
    });
    public readonly transferProfileStateSig = signal<TransferProfileState>(
        {transferProfileList: null, currentTransferProfile: null, currentProfileIsOIDC: false},
    );
    private readonly transferProfileEdited$: Subject<string> = new Subject<string>();

    /** Emits the profile name whenever an existing Transfer Profile is edited and saved. */
    get transferProfileEdited(): Observable<string> {
        return this.transferProfileEdited$.asObservable();
    }
    private _subscriptions: Subscription[] = [];
    private _transferProfileState: TransferProfileState = {
        transferProfileList: null,
        currentTransferProfile: null,
        currentProfileIsOIDC: false,
    };
    // The profile the user last explicitly selected. Kept SEPARATE from _transferProfileState
    // so it survives resetTransferProfileState() (which fires when the daemon goes away). On
    // reconnect the default logic restores this instead of snapping back to the first profile
    // in the alphabetical list (which may be an unauthenticated OIDC config).
    private lastSelectedProfile: string | null = null;

    init() {
        // Restore the profile the user last explicitly selected (persisted across restarts).
        // The onUpdateTransferProfileNames handler below uses lastSelectedProfile as its
        // preferred default, so seeding it here is what makes the selection stick after a
        // relaunch instead of snapping back to the alphabetically-first profile.
        try {
            const remembered = this.storage.getString(CURRENT_TRANSFER_PROFILE_STORAGE_KEY, '');
            this.lastSelectedProfile = remembered || null;
        } catch {
            this.lastSelectedProfile = null;
        }

        this._subscriptions.push(this.metadata.onUpdateTransferProfileNames.subscribe({
            next: () => {
                try {
                    const currentTransferProfile = this._transferProfileState.currentTransferProfile;
                    const transferProfiles = Object.keys(this.metadata.transferProfiles).sort(function(a, b) {
                        return a.toLowerCase().localeCompare(b.toLowerCase());
                    });
                    if (!currentTransferProfile || !transferProfiles.includes(currentTransferProfile)) {
                        // A daemon restart clears the live selection (resetTransferProfileState),
                        // so restore the profile the user last explicitly chose. Only fall back
                        // to the first profile when there's no valid remembered selection —
                        // otherwise every reconnect snaps back to the alphabetically-first
                        // profile, which may be an unauthenticated OIDC config.
                        if (this.lastSelectedProfile && transferProfiles.includes(this.lastSelectedProfile)) {
                            this._transferProfileState.currentTransferProfile = this.lastSelectedProfile;
                        } else {
                            this._transferProfileState.currentTransferProfile = transferProfiles.length ? transferProfiles[0] : null;
                        }
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
        this.lastSelectedProfile = transferProfile;
        this.persistLastSelectedProfile(transferProfile);
        this.transferProfileState$.next(this._transferProfileState);
        this.transferProfileStateSig.set({...this._transferProfileState});
    }

    /**
     * Sets the current profile to a just-saved (edited or added) profile without the
     * existence guard `select()` applies — an added profile isn't in the cached list until
     * the daemon's metadata refresh lands, and we want to switch to it immediately so the
     * bucket browser connects to the config the user just entered and surfaces ITS state
     * (sign-in prompt or error), instead of leaving them on the previously-selected one.
     * The subsequent metadata refresh includes the name and keeps the selection.
     * @private
     */
    private selectSavedProfile(transferProfile: string) {
        this._transferProfileState.currentTransferProfile = transferProfile;
        this.lastSelectedProfile = transferProfile;
        this.persistLastSelectedProfile(transferProfile);
        if (this._transferProfileState.transferProfileList
            && !this._transferProfileState.transferProfileList.includes(transferProfile)) {
            this._transferProfileState.transferProfileList =
                [...this._transferProfileState.transferProfileList, transferProfile]
                    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        }
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
            confirmationMessage += ' You must have at least one transfer profile in order to perform transfers.';
        } else if (this._transferProfileState.currentTransferProfile === transferProfile) {
            confirmationMessage += ' You are currently using this transfer profile.';
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
                    title: 'Delete Transfer Profile',
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
                                this.notifications.success(`Successfully deleted transfer profile ${transferProfile}.`);
                            },
                            error: (error) => {
                                this.notifications.warning(`Error occurred when deleting transfer profile ${transferProfile}: ${error}`);
                            },
                        });
                    },
                    error: (error) => {
                        this.notifications.warning(`Error occurred when deleting transfer profile ${transferProfile}: ${error}`);
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
                    this.notifications.warning(`Transfer profile ${transferProfile} does not exist in configuration file.`);
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
                    const profile = result.profile;
                    const saveConfig = () => {
                        config.protocols.s3.transferProfiles[profile.name] = profile;
                        this.fmeClientService.setConfiguration(config).subscribe({
                            next: () => {
                                this.selectSavedProfile(profile.name);
                                this.transferProfileEdited$.next(transferProfile);
                                this.notifications.success(`Successfully edited transfer profile ${transferProfile}.`);
                            },
                            error: (error) => {
                                this.notifications.warning(`Error occurred when editing transfer profile ${transferProfile}: ${error}`);
                            },
                        });
                    };
                    // Only touch the credential store when the user actually entered a new secret.
                    // A blank secret on edit means "keep the stored one" (the dedicated store is
                    // untouched by the config save), and switching AWAY from access-key is reclaimed
                    // daemon-side by SetConfiguration.
                    if (profile.authMethod === 'access-key' && result.secretAccessKey) {
                        this.fmeClientService.updateStaticCredentials({
                            transferProfile: profile.name,
                            accessKeyId: profile.accessKeyId ?? '',
                            secretAccessKey: result.secretAccessKey,
                            sessionToken: result.sessionToken,
                        }).subscribe({
                            next: () => saveConfig(),
                            error: (error) => {
                                this.notifications.warning(`Error storing credentials for ${profile.name}: ${error}`);
                            },
                        });
                    } else {
                        saveConfig();
                    }
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
            const profile = result.profile;
            this.fmeClientService.getConfiguration().subscribe({
                next: (config) => {
                    const saveConfig = () => {
                        config.protocols.s3.transferProfiles[profile.name] = profile;
                        this.fmeClientService.setConfiguration(config).subscribe({
                            next: () => {
                                this.selectSavedProfile(profile.name);
                                this.notifications.success(`Successfully added transfer profile ${profile.name}.`);
                            },
                            error: (error) => {
                                this.notifications.warning(`Error occurred when adding transfer profile ${profile.name}: ${error}`);
                            },
                        });
                    };
                    // For access-key auth, store + validate (fail closed) the secret BEFORE persisting
                    // the profile, so a bad key never leaves a broken profile behind.
                    if (profile.authMethod === 'access-key' && result.secretAccessKey) {
                        this.fmeClientService.createStaticCredentials({
                            transferProfile: profile.name,
                            accessKeyId: profile.accessKeyId ?? '',
                            secretAccessKey: result.secretAccessKey,
                            sessionToken: result.sessionToken,
                            bucket: profile.bucket,
                            region: profile.region,
                            endpoint: profile.endpoint,
                        }).subscribe({
                            next: () => saveConfig(),
                            error: (error) => {
                                this.notifications.warning(`Error storing credentials for ${profile.name}: ${error}`);
                            },
                        });
                    } else {
                        saveConfig();
                    }
                },
                error: (error) => {
                    this.notifications.warning(`Error occurred when adding transfer profile ${profile.name}: ${error}`);
                },
            });
        });
    }


    /**
     * Persists the name of the last explicitly selected transfer profile to local storage so
     * the selection survives an app restart. Storage failures are non-fatal - a lost write just
     * means the next launch falls back to the first profile, so we log and move on rather than
     * interrupting the user.
     * @param transferProfile Name of the transfer profile to remember
     * @private
     */
    private persistLastSelectedProfile(transferProfile: string) {
        try {
            this.storage.set(CURRENT_TRANSFER_PROFILE_STORAGE_KEY, transferProfile);
        } catch (e) {
            console.debug(`Couldn't persist selected transfer profile: ${e instanceof Error ? e.message : e}`);
        }
    }

    /**
     * Checks if the given transfer profile name exists in the list of transfer profiles.
     * @param transferProfile Transfer profile name to check
     * @private
     */
    private checkTransferProfileExists(transferProfile: string): boolean {
        if (!this._transferProfileState.transferProfileList?.includes(transferProfile)) {
            this.notifications.warning(`Transfer profile ${transferProfile} doesn't exist in configuration file.`);
            return false;
        }
        return true;
    }
}
