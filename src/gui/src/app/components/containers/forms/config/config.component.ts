import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatInput, MatLabel, MatSuffix } from '@angular/material/input';
import { MatOption, MatSelect, MatSelectChange } from '@angular/material/select';
import { BrowseButtonComponent } from '@primitives/forms/browse-button/browse-button.component';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { ConfirmationModalComponent } from '@app/components/modals/confirmation-modal/confirmation-modal.component';
import { discardUnsavedChangesDialog } from '@app/components/modals/confirmation-modal/confirmation-modal.constants';
import { HintPopoverService } from '@services/hint-popover/hint-popover.service';
import { formErrorMessages, NotificationMessages, sectionTitles } from '@app/constants/common.constants';
import { FmeConfig as IFmeConfig } from '@app/interfaces/config';
import { DEFAULT_GENERAL_SETTINGS } from '@app/constants/config';
import { FmeConfig, TransferProfile } from '@classes/config';
import { isIntegerValidator, maxActiveChecksumsValidator, oneOfValidator } from '@classes/form-validators';
import { handleStreamError } from '@classes/rxjs-operators';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { HistoryService } from '@services/history/history.service';
import { MetadataService } from '@services/metadata/metadata.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { PreferencesService } from '@services/preferences/preferences.service';
import { defaultOptions as defaultPreferences } from '@services/preferences/preferences.constants';
import { DaemonCloseOptions, NotificationDelay, NotificationPositions } from '@app/components/modals/preferences-modal/preferences-modal.constants';
import { VersionService } from '@services/version/version.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { logSeverities } from './config.constants';
import {
    ConfigFormGeneralGroup,
    ConfigFormGroup,
    ConfigFormLoggingGroup,
    ConfigFormProtocolsGroup,
    ConfigFormReportsGroup,
    ConfigFormS3Group,
} from '@containers/forms/config/config.interfaces';

@Component({
    selector: 'fme-config',
    templateUrl: './config.component.html',
    styleUrls: ['./config.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatInput,
        MatError,
        MatHint,
        MatSuffix,
        MatSlideToggle,
        MatSelect,
        MatOption,
        ButtonComponent,
        BrowseButtonComponent,
        AsyncPipe,

    ],
})
export class ConfigComponent implements OnInit {
    fmeClientService = inject(FmeClientService);
    private metadataService = inject(MetadataService);
    private versionService = inject(VersionService);
    private notificationService = inject(NotificationsService);
    private historyService = inject(HistoryService);
    private hintPopover = inject(HintPopoverService);
    private prefService = inject(PreferencesService);
    private dialog = inject(MatDialog);
    // Present when Settings is opened as a modal (from the toolbar cog); null when it is
    // reached via the /home/config route. Close/cancel adapt to whichever host applies.
    private dialogRef = inject<MatDialogRef<ConfigComponent>>(MatDialogRef, {optional: true});

    formErrorMessages = formErrorMessages;
    cpuCoreCount = 0;
    logSeverities = logSeverities;
    ConnectionState = ConnectionState;
    transferProfiles: string[] = [];

    // Left-nav sections (mockup config page). Panels stay mounted; nav toggles visibility.
    // Hot Folders is intentionally NOT here — it lives in its own Configure Hot Folders
    // dialog (reachable from the Local panel overflow and right-click menus).
    activeSection: 'transfers' | 'reports' | 'logging' | 'uiprefs' = 'transfers';

    // UI Preferences (client-side, saved on change via PreferencesService — NOT part of
    // the daemon config form's save/cancel flow). Rendered in the General tab.
    notificationPositions = NotificationPositions;
    autoHideOptions = NotificationDelay;
    daemonCloseOptions = DaemonCloseOptions;
    selectedNotificationPosition = '';
    notificationDelay = defaultPreferences.notificationAutoHideDelay;
    selectedDaemonClose = defaultPreferences.daemonClose;
    showHiddenFiles = defaultPreferences.showHiddenFiles;
    originalConfig: FmeConfig | null = null;
    configForm: FormGroup<ConfigFormGroup> = new FormGroup<ConfigFormGroup>(
        {
            general: new FormGroup<ConfigFormGeneralGroup>({
                noSleep: new FormControl<boolean>(false, {nonNullable: true}),
                retryCount: new FormControl<number>(1,
                    {
                        validators: [
                            Validators.required,
                            Validators.min(1),
                            isIntegerValidator,
                        ],
                        nonNullable: true,
                    },
                ),
                maxActiveTransfers: new FormControl<number>(1,
                    {
                        validators: [
                            Validators.required,
                            Validators.min(1),
                            isIntegerValidator,
                        ],
                        nonNullable: true,
                    },
                ),
                autoMaxActiveTransfers: new FormControl<boolean>(false, {nonNullable: true}),
                maxActiveChecksums: new FormControl<number>(1,
                    {
                        validators: [
                            Validators.required,
                            Validators.min(1),
                            isIntegerValidator,
                        ],
                        nonNullable: true,
                    },
                ),
                targetBandwidth: new FormControl<number>(0,
                    {
                        validators: [
                            Validators.required,
                            Validators.max(1000000),
                            Validators.min(0),
                            isIntegerValidator,
                        ],
                        nonNullable: true,
                    },
                ),
            }),
            logging: new FormGroup<ConfigFormLoggingGroup>({
                directory: new FormControl<string>('', {nonNullable: true}),
                severity: new FormControl<string>('info', {
                    validators: [
                        Validators.required, oneOfValidator(this.logSeverities.map((itm) => itm.value)),
                    ],
                    nonNullable: true,
                }),
                maxSize: new FormControl<number>(0, {
                    validators: [
                        Validators.min(0), isIntegerValidator,
                    ],
                    nonNullable: true,
                }),
                maxAge: new FormControl<number>(0, {
                    validators: [
                        Validators.min(0), isIntegerValidator,
                    ],
                    nonNullable: true,
                }),
                compress: new FormControl<boolean>(true, {nonNullable: true}),
            }),
            reports: new FormGroup<ConfigFormReportsGroup>({
                directory: new FormControl<string>('', {nonNullable: true}),
            }),
            protocols: new FormGroup<ConfigFormProtocolsGroup>({
                s3: new FormGroup<ConfigFormS3Group>({
                    transferProfiles: new FormControl<Record<string, TransferProfile>>({}, {nonNullable: true}),
                }),
            }),
        },
    );

    constructor() {
        this.metadataService.onUpdate.pipe(
            handleStreamError({retryCount: 5, fatal: true}),
        ).subscribe({
            next: (metadataLoaded) => {
                try {
                    if (metadataLoaded) {
                        const checksumCtrl = this.configForm.controls.general.controls.maxActiveChecksums;
                        this.cpuCoreCount = this.metadataService.cpuCoreCount;
                        if (checksumCtrl) {
                            checksumCtrl.addValidators(maxActiveChecksumsValidator(this.cpuCoreCount));
                            checksumCtrl.updateValueAndValidity();
                        }
                        this.transferProfiles = Object.keys(this.metadataService.transferProfiles);
                    }
                } catch (e) {
                    console.error(e);
                    this.notificationService.error(NotificationMessages.METADATA_ERROR);
                }
            },
            error: (error) => {
                this.fmeClientService.processStreamError(error);
            },
        });
    }

    ngOnInit(): void {
        this.loadUiPreferences();
        // When AutoMAT is on, the daemon picks maxActiveTransfers, so disable the manual
        // field (its value is still preserved and saved via getRawValue).
        this.configForm.controls.general.controls.autoMaxActiveTransfers.valueChanges.subscribe(
            (auto) => this.setMaxActiveTransfersDisabled(auto),
        );
        // check version compatibility
        if (!this.versionService.requiredApiVersion(`edit ${sectionTitles.CONFIGURATION}`)) {
            this.closeSettings();
            return;
        }
        this.fmeClientService.getConfiguration().subscribe({
            next: (result) => {
                this.originalConfig = result;
                this.configForm.enable();
                this.configForm.patchValue({
                    general: result.general,
                    logging: result.logging,
                    reports: result.reports,
                    protocols: result.protocols,
                });

                // Apply the AutoMAT disabled state BEFORE marking pristine — toggling a
                // control's enabled state dirties the form, so doing it after markAsPristine
                // would make Cancel prompt "Discard changes?" on an untouched form.
                this.setMaxActiveTransfersDisabled(result.general.autoMaxActiveTransfers);

                this.configForm.markAllAsTouched();
                this.markFormGroupDirty(this.configForm);

                this.configForm.markAsPristine();
            },
            error: (error) => {
                this.notificationService.warning(`${NotificationMessages.GET_CONFIG_FAILURE}: ${error}`);
            },
        });
    }

    /**
     * Enables/disables the manual Max Active Transfers field based on the AutoMAT opt-in.
     * A disabled control's value is still included in getRawValue(), so the last manual
     * number is preserved when saving with AutoMAT on.
     */
    private setMaxActiveTransfersDisabled(auto: boolean) {
        const ctrl = this.configForm.controls.general.controls.maxActiveTransfers;
        if (auto) {
            // getRawValue() includes disabled controls, so a value the user left invalid
            // (cleared or 0) before enabling AutoMAT would be saved and resurface when
            // AutoMAT is later turned off. Normalize to the default before disabling.
            if (ctrl.value == null || ctrl.value < 1) {
                ctrl.setValue(DEFAULT_GENERAL_SETTINGS.maxActiveTransfers, {emitEvent: false});
            }
            ctrl.disable({emitEvent: false});
        } else {
            ctrl.enable({emitEvent: false});
        }
    }

    onSubmit() {
        return () => {
            const settings: IFmeConfig = this.configForm.getRawValue() as unknown as IFmeConfig;
            // Hot folders are edited in their own Configure Hot Folders dialog, not here.
            // The config save writes the whole config, so carry the loaded hot folders
            // through unchanged — otherwise saving Settings would wipe them.
            settings.uploadHotFolders = this.originalConfig?.uploadHotFolders ?? [];
            const input = FmeConfig.fromJson(settings);

            this.fmeClientService.setConfiguration(input).subscribe({
                next: () => {
                    this.notificationService.success(NotificationMessages.SET_CONFIG_SUCCESS);
                    this.configForm.markAsPristine();
                    this.closeSettings();
                },
                error: (error) => {
                    this.notificationService.warning(`${NotificationMessages.SET_CONFIG_FAILURE} ${error}`);
                },
            });
        };
    }

    onCancel() {
        return () => {
            // In dialog mode the route CanDeactivate guard can't run, so prompt here when
            // there are unsaved edits. Esc/backdrop are disabled (disableClose), so Cancel
            // is the only exit.
            if (this.dialogRef && this.configForm.dirty) {
                this.dialog.open(ConfirmationModalComponent, discardUnsavedChangesDialog)
                    .afterClosed().subscribe((discard) => {
                        if (discard) {
                            this.closeSettings();
                        }
                    });
                return;
            }
            this.closeSettings();
        };
    }

    /** Close the settings dialog if hosted in one, otherwise navigate back (route mode). */
    private closeSettings() {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.historyService.redirectToPrevious();
        }
    }

    selectSection(section: 'transfers' | 'reports' | 'logging' | 'uiprefs') {
        this.activeSection = section;
    }

    // region UI Preferences (client-side, immediate save via PreferencesService)
    private loadUiPreferences() {
        const preferences = this.prefService.getAllPreferences();
        const currentPos = preferences.notificationPosition ?? defaultPreferences.notificationPosition;
        const match = this.notificationPositions.find(
            (pos) => pos.position.vertical === currentPos?.vertical && pos.position.horizontal === currentPos?.horizontal,
        );
        this.selectedNotificationPosition = match ? match.name : '';
        this.notificationDelay = preferences.notificationAutoHideDelay;

        const validCloseOptions = this.daemonCloseOptions.map((itm) => itm.value);
        if (!validCloseOptions.includes(preferences.daemonClose)) {
            this.prefService.daemonClose = 'ask';
            preferences.daemonClose = 'ask';
        }
        this.selectedDaemonClose = preferences.daemonClose;
        this.showHiddenFiles = preferences.showHiddenFiles;
    }

    notificationPositionChanged(event: MatSelectChange) {
        const match = this.notificationPositions.find((pos) => pos.name === event.value);
        if (match) {
            this.prefService.notificationPosition = match.position;
        }
    }

    notificationAutoHideChanged(event: MatSelectChange) {
        this.prefService.notificationHideDelay = event.value;
    }

    daemonCloseChanged(event: MatSelectChange) {
        this.prefService.daemonClose = event.value;
    }

    showHiddenFilesChanged(event: MatSlideToggleChange) {
        this.prefService.showHiddenFiles = event.checked;
    }
    // endregion

    private markFormGroupDirty(group: FormGroup) {
        for (const ctrlName in group.controls) {
            const ctrl = group.get(ctrlName);
            if (ctrl?.validator) {
                ctrl.markAsDirty();
            }
            this.markFormGroupDirty(ctrl as FormGroup);
        }
    }

    toggleHint(event: Event, message: string) {
        event.stopPropagation();
        event.preventDefault();

        this.hintPopover.open(event.currentTarget as HTMLElement, message);
    }
}
