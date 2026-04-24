import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import {
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelDescription,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatError, MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { HintsPanelComponent } from '@app/components/layout/hints-panel/hints-panel.component';
import { formErrorMessages, NotificationMessages, sectionTitles } from '@app/constants/common.constants';
import { FmeConfig as IFmeConfig } from '@app/interfaces/config';
import { FmeConfig, HotFolders, TransferProfile } from '@classes/config';
import { isIntegerValidator, maxActiveChecksumsValidator, oneOfValidator } from '@classes/form-validators';
import { handleStreamError } from '@classes/rxjs-operators';
import { HotFolderFormComponent } from '@containers/forms/hot-folder-form/hot-folder-form.component';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { HistoryService } from '@services/history/history.service';
import { MetadataService } from '@services/metadata/metadata.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { VersionService } from '@services/version/version.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { logSeverities } from './config.constants';
import { HotFolderFormGroup } from '@containers/forms/hot-folder-form/hot-folder-form.interfaces';
import {
    ConfigFormApiServerGroup,
    ConfigFormApiServerPermissionsGroup,
    ConfigFormApiServerTLSGroup,
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
    imports: [
        ReactiveFormsModule,
        MatAccordion,
        MatExpansionPanel,
        MatExpansionPanelHeader,
        MatExpansionPanelTitle,
        MatExpansionPanelDescription,
        MatFormField,
        MatLabel,
        MatInput,
        MatError,
        MatHint,
        MatSlideToggle,
        MatSelect,
        MatOption,
        HotFolderFormComponent,
        ButtonComponent,
        AsyncPipe,

    ],
})
export class ConfigComponent implements OnInit {
    fmeClientService = inject(FmeClientService);
    private metadataService = inject(MetadataService);
    private versionService = inject(VersionService);
    private notificationService = inject(NotificationsService);
    private historyService = inject(HistoryService);
    private bottomSheet = inject(MatBottomSheet);

    @ViewChildren(MatExpansionPanel) expansionPanels!: QueryList<MatExpansionPanel>;
    formErrorMessages = formErrorMessages;
    cpuCoreCount = 0;
    logSeverities = logSeverities;
    ConnectionState = ConnectionState;
    transferProfiles: string[] = [];
    hotFolders: HotFolders[] = [];
    hotFolderForm: FormArray<FormGroup<HotFolderFormGroup>> | null = null;
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
            apiServer: new FormGroup<ConfigFormApiServerGroup>({
                enabled: new FormControl<boolean>(true, {nonNullable: true}),
                permissions: new FormGroup<ConfigFormApiServerPermissionsGroup>({
                    allowUiConfiguration: new FormControl<boolean>(false, {nonNullable: true}),
                    allowLocalRenameDelete: new FormControl<boolean>(false, {nonNullable: true}),
                    allowRemoteRenameDelete: new FormControl<boolean>(false, {nonNullable: true}),
                }),
                tls: new FormGroup<ConfigFormApiServerTLSGroup>({
                    enabled: new FormControl<boolean>(false, {nonNullable: true}),
                    certificateFile: new FormControl<string>('', {nonNullable: true}),
                    keyFile: new FormControl<string>('', {nonNullable: true}),
                }),
                blockedPaths: new FormControl<string[]>([], {nonNullable: true}),
                remote: new FormGroup({
                    enabled: new FormControl<boolean>(true, {nonNullable: true}),
                    preSharedKey: new FormControl<string>('/', {nonNullable: true}),
                    address: new FormControl<string>('/', {nonNullable: true}),
                    ports: new FormControl<number[]>([], {nonNullable: true}),
                }),
                allowedOrigins: new FormControl<string[]>([], {nonNullable: true}),
            }),
            protocols: new FormGroup<ConfigFormProtocolsGroup>({
                s3: new FormGroup<ConfigFormS3Group>({
                    transferProfiles: new FormControl<Record<string, TransferProfile>>({}, {nonNullable: true}),
                }),
            }),
            uploadHotFolders: new FormArray<FormGroup<HotFolderFormGroup>>([]),
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
        // check version compatibility
        if (!this.versionService.requiredApiVersion(`edit ${sectionTitles.CONFIGURATION}`)) {
            this.historyService.redirectToPrevious();
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
                    apiServer: result.apiServer,
                    protocols: result.protocols,
                    uploadHotFolders: result.uploadHotFolders,
                });
                this.hotFolders = result.uploadHotFolders;

                this.configForm.markAllAsTouched();
                this.markFormGroupDirty(this.configForm);

                this.configForm.markAsPristine();
            },
            error: (error) => {
                this.notificationService.warning(`${NotificationMessages.GET_CONFIG_FAILURE}: ${error}`);
            },
        });
    }

    onSubmit() {
        return () => {
            if (this.hotFolderForm) {
                for (const ctrl of this.hotFolderForm.controls) {
                    this.configForm.controls.uploadHotFolders.push(ctrl);
                }
            }
            const settings: IFmeConfig = this.configForm.getRawValue() as unknown as IFmeConfig;
            const input = FmeConfig.fromJson(settings);

            this.fmeClientService.setConfiguration(input).subscribe({
                next: () => {
                    this.notificationService.success(NotificationMessages.SET_CONFIG_SUCCESS);
                    this.configForm.markAsPristine();
                    this.historyService.redirectToPrevious();
                },
                error: (error) => {
                    this.notificationService.warning(`${NotificationMessages.SET_CONFIG_FAILURE} ${error}`);
                },
            });
        };
    }

    onCancel() {
        return () => {
            this.historyService.redirectToPrevious();
        };
    }

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

        this.bottomSheet.open(HintsPanelComponent, {
            data: message,
            panelClass: 'bottom-sheet-hints',
        });
    }

    /**
     * Updates the stored hot folder FormGroup.
     *
     * @param {FormArray} hotFolderForm - FormGroup from nested hot folder form component
     */
    updateHotFolderForm(hotFolderForm: FormArray<FormGroup<HotFolderFormGroup>>) {
        this.hotFolderForm = hotFolderForm;
    }
}
