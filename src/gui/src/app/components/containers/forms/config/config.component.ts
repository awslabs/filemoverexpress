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
    configForm: FormGroup = new FormGroup({});
    formErrorMessages = formErrorMessages;
    cpuCoreCount = 0;
    logSeverities = logSeverities;
    ConnectionState = ConnectionState;
    transferProfiles: string[] = [];
    hotFolders: HotFolders[] = [];
    hotFolderForm: FormGroup | null = null;
    originalConfig: FmeConfig | null = null;

    constructor() {
        this.setupConfigForm();
        this.metadataService.onUpdate.pipe(
            handleStreamError({retryCount: 5, fatal: true}),
        ).subscribe({
            next: (metadataLoaded) => {
                try {
                    if (metadataLoaded) {
                        const checksumCtrl = this.configForm.get('protocols')?.get('s3')?.get('maxActiveChecksums');
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
                    apiServer: result.apiServer,
                    logging: result.logging,
                    results: result.reports,
                    protocols: result.protocols,
                    uploadHotFolders: result.uploadHotFolders,
                    reports: result.reports,
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
                this.configForm.setControl('uploadHotFolders', this.hotFolderForm.get('uploadHotFolders') as FormArray);
            }
            const settings: IFmeConfig = this.configForm.getRawValue();
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

    setupConfigForm() {
        this.configForm = new FormGroup(
            {
                general: new FormGroup({
                    noSleep: new FormControl<boolean>(false),
                    retryCount: new FormControl<number>(
                        1,
                        [
                            Validators.required,
                            Validators.min(1),
                            isIntegerValidator,
                        ],
                    ),

                    maxActiveTransfers: new FormControl<number>(1, [
                        Validators.required,
                        Validators.min(1),
                        isIntegerValidator,
                    ]),
                    maxActiveChecksums: new FormControl<number>(1, [
                        Validators.required,
                        Validators.min(1),
                        isIntegerValidator,
                    ]),
                    targetBandwidth: new FormControl<number>(0, [
                        Validators.required,
                        Validators.max(1000000),
                        Validators.min(0),
                        isIntegerValidator,
                    ]),
                }),
                logging: new FormGroup({
                    directory: new FormControl<string>(''),
                    severity: new FormControl<string>('info', [
                        Validators.required, oneOfValidator(this.logSeverities.map((itm) => itm.value)),
                    ]),
                    maxSize: new FormControl<number>(0, [
                        Validators.min(0), isIntegerValidator,
                    ]),
                    maxAge: new FormControl<number>(0, [
                        Validators.min(0), isIntegerValidator,
                    ]),
                    compress: new FormControl<boolean>(true),
                }),
                reports: new FormGroup({
                    directory: new FormControl<string>(''),
                }),
                apiServer: new FormGroup({
                    enabled: new FormControl<boolean>(true),
                    permissions: new FormGroup({
                        allowUiConfiguration: new FormControl<boolean>(false),
                        allowLocalRenameDelete: new FormControl<boolean>(false),
                        allowRemoteRenameDelete: new FormControl<boolean>(false),
                    }),
                    tls: new FormGroup({
                        enabled: new FormControl<boolean>(false),
                        certificateFile: new FormControl<string>(''),
                        keyFile: new FormControl<string>(''),
                    }),
                    blockedPaths: new FormControl<string[]>([]),
                    remote: new FormGroup({
                        enabled: new FormControl<boolean>(true),
                        preSharedKey: new FormControl<string>('/'),
                        address: new FormControl<string>('/'),
                        ports: new FormControl<string>('/'),
                    }),
                    allowedOrigins: new FormControl<string[]>([]),
                }),
                protocols: new FormGroup({
                    s3: new FormGroup({
                        transferProfiles: new FormControl<Record<string, TransferProfile>>({}),
                    }),
                }),
                uploadHotFolders: new FormArray([]),
            },
        );
        this.configForm.disable();
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
     * @param {FormGroup} hotFolderForm - FormGroup from nested hot folder form component
     */
    updateHotFolderForm(hotFolderForm: FormGroup) {
        this.hotFolderForm = hotFolderForm;
    }
}
