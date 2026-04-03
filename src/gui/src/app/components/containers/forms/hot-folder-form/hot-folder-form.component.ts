import { Component, inject, input, OnChanges, OnDestroy, output, viewChildren } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatError, MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { formErrorMessages } from '@app/constants/common.constants';
import { HotFolders } from '@classes/config';
import { validateHotFolderNames } from '@classes/form-validators';
import { HotFolderData } from '@containers/forms/hot-folder-form/hot-folder-form.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { MetadataService } from '@services/metadata/metadata.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'fme-hot-folder-form',
    templateUrl: './hot-folder-form.component.html',
    styleUrls: ['./hot-folder-form.component.scss'],
    imports: [
        ReactiveFormsModule,
        MatAccordion,
        MatExpansionPanel,
        MatExpansionPanelHeader,
        MatExpansionPanelTitle,
        MatTooltip,
        MatIcon,
        MatFormField,
        MatLabel,
        MatInput,
        MatError,
        MatSlideToggle,
        MatSelect,
        MatOption,
        MatHint,
        ButtonComponent,
    ],
})
export class HotFolderFormComponent implements OnDestroy, OnChanges {
    private metadata = inject(MetadataService);
    private notifications = inject(NotificationsService);

    preFillNewHotFolderData = input<HotFolderData>({});
    hotFolders = input<HotFolders[]>([]);
    hotFoldersEdited = output<FormGroup>();
    expansionPanels = viewChildren(MatExpansionPanel);
    transferProfiles: string[] = [];
    hotFolderForm: FormGroup = new FormGroup({uploadHotFolders: new FormArray([])});
    private subscriptions: Subscription[] = [];
    protected readonly formErrorMessages = formErrorMessages;

    constructor() {
        this.subscriptions.push(
            this.metadata.onUpdate.subscribe({
                next: (metadataLoaded) => {
                    try {
                        if (metadataLoaded) {
                            this.transferProfiles = Object.keys(this.metadata.transferProfiles);
                        }
                    } catch (e) {
                        console.error(e);
                    }
                },
            }),
        );
    }

    /**
     * Set form data when the input hot folder list is updated
     */
    ngOnChanges() {
        const hotFoldersArray: FormGroup[] = [];
        this.hotFolders().forEach((hotFolder) => {
            const remoteConfigurations: FormGroup[] = [];
            for (const txp of hotFolder.remoteConfigurations) {
                remoteConfigurations.push(
                    new FormGroup(
                        {
                            remoteConfigurationName: new FormControl<string>(txp.remoteConfigurationName, Validators.required),
                            s3DestinationFolder: new FormControl<string>(txp.s3DestinationFolder),
                        },
                    ),
                );
            }
            hotFoldersArray.push(
                new FormGroup(
                    {
                        name: new FormControl<string>(hotFolder.name, [validateHotFolderNames, Validators.required]),
                        enabled: new FormControl<boolean>(hotFolder.enabled),
                        localSourceFolder: new FormControl<string>(hotFolder.localSourceFolder, Validators.required),
                        remoteConfigurations: new FormArray(remoteConfigurations, Validators.required),
                    },
                ),
            );
        });
        this.hotFolderForm.setControl('uploadHotFolders', new FormArray(hotFoldersArray));

        this.hotFoldersEdited.emit(this.hotFolderForm);

        this.hotFolderForm.get('uploadHotFolders')?.valueChanges.subscribe(
            () => {
                this.hotFoldersEdited.emit(this.hotFolderForm);
            },
        );

        this.hotFolderForm.markAsDirty();
        this.hotFolderForm.markAllAsTouched();
    }

    /**
     * Unsubscribe from all subscriptions
     */
    ngOnDestroy() {
        this.subscriptions.map((subscription) => subscription.unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Gets the form controls for all hot folders.
     */
    getHotFolderControls() {
        return (this.hotFolderForm.get('uploadHotFolders') as FormArray).controls;
    }

    /**
     * Gets the name for a certain hot folder.
     *
     * @param {number} idx - Index of hot folder
     * @returns {string} The name of the hot folder
     */
    getHotFolderName(idx: number): string {
        return (this.hotFolderForm.get(['uploadHotFolders', idx])?.get('name') as FormArray).value || '';
    }

    /**
     * Gets the form controls for a certain hot folder's destination settings.
     *
     * @param {number} idx - Index of hot folder
     */
    getRemoteConfigurationControls(idx: number) {
        return (this.hotFolderForm.get(['uploadHotFolders', idx])?.get('remoteConfigurations') as FormArray).controls;
    }

    /**
     * Returns true if there are other hot folders with the same name as a certain hot folder.
     *
     * @param {number} idx - Index of hot folder
     * @returns {boolean} Whether there is are duplicate names with other hot folders
     */
    duplicateHotFolderNamesError(idx: number): boolean {
        return (this.hotFolderForm.get(['uploadHotFolders', idx])?.get('name') as FormArray).hasError('duplicate-name') || false;
    }

    /**
     * Returns true if the hot folder name is missing
     *
     * @param {number} idx - Index of hot folder
     * @returns {boolean} Whether name is missing
     */
    hotFolderNameRequiredError(idx: number): boolean {
        return (this.hotFolderForm.get(['uploadHotFolders', idx])?.get('name') as FormArray).hasError('required') || false;
    }

    /**
     * Returns true if the hot folder local source folder is missing
     *
     * @param {number} idx - Index of hot folder
     * @returns {boolean} Whether local source folder is missing
     */
    localSourceFolderRequiredError(idx: number): boolean {
        return (this.hotFolderForm.get(['uploadHotFolders', idx])?.get('localSourceFolder') as FormArray).hasError('required') || false;
    }

    /**
     * Returns true if the hot folder has no destinations
     *
     * @param {number} idx - Index of hot folder
     * @returns {boolean} Whether the hot folder has no destinations
     */
    destinationConfigRequiredError(idx: number): boolean {
        return (this.hotFolderForm.get(['uploadHotFolders', idx])?.get(['remoteConfigurations']) as FormArray).hasError('required') || false;
    }

    /**
     * Returns true if a certain destination config for a hot folder has no remote configuration selected
     *
     * @param {number} i - Index of hot folder
     * @param {number} j - Index of destination config
     * @returns {boolean} Whether the destination config is missing a selected remote configuration
     */
    remoteConfigurationRequiredError(i: number, j: number): boolean {
        return (this.hotFolderForm.get(['uploadHotFolders', i])?.get(['remoteConfigurations', j])?.get('remoteConfigurationName') as FormArray).hasError('required') || false;
    }

    /**
     * Returns true if a set of destination settings can be deleted from a certain hot folder.
     *
     * @param {number} idx - Index of hot folder
     * @returns {boolean} Whether destination settings can be deleted from the hot folder
     */
    canDeleteDestination(idx: number): boolean {
        return (this.hotFolderForm.get(['uploadHotFolders',
            idx,
            'remoteConfigurations']) as FormArray).controls.length == 1;
    }

    /**
     * Adds a set of fields for a new hot folder.
     */
    addHotFolder() {
        return () => {
            let preFillRemoteConfiguration = this.preFillNewHotFolderData().remoteConfiguration || '';
            let preFillS3DestinationPath = this.preFillNewHotFolderData().s3DestinationPath || '';
            if (!preFillRemoteConfiguration || !this.transferProfiles.includes(preFillRemoteConfiguration)) {
                preFillRemoteConfiguration = '';
                preFillS3DestinationPath = '';
            }

            const hotFolderArray = this.hotFolderForm.get('uploadHotFolders') as FormArray;
            hotFolderArray.push(new FormGroup({
                name: new FormControl<string>('', [validateHotFolderNames, Validators.required]),
                enabled: new FormControl<boolean>(true),
                localSourceFolder: new FormControl<string>(this.preFillNewHotFolderData().localSourcePath || '', Validators.required),
                remoteConfigurations: new FormArray(
                    [
                        new FormGroup({
                            remoteConfigurationName: new FormControl<string>(preFillRemoteConfiguration, Validators.required),
                            s3DestinationFolder: new FormControl<string>(preFillS3DestinationPath),
                        }),
                    ],
                    Validators.required,
                ),
            }));

            setTimeout(() => this.expansionPanels()[-1].open(), 100);
        };
    }

    /**
     * Deletes a hot folder at a certain index.
     *
     * @param {number} idx - Index of hot folder to delete
     */
    deleteHotFolder(idx: number) {
        return () => {
            const hotFolderArray = this.hotFolderForm.get('uploadHotFolders') as FormArray;
            hotFolderArray.removeAt(idx);
        };
    }

    /**
     * Deletes a certain set of remote configuration destination settings from a hot folder at a certain index.
     *
     * @param {number} i - Index of hot folder to delete destination settings from
     * @param {number} j - Index of destination settings to delete
     */
    deleteRemoteConfiguration(i: number, j: number) {
        return () => {
            const txConfig = this.hotFolderForm?.get(['uploadHotFolders', i])?.get('remoteConfigurations') as FormArray;
            if (txConfig.length > 1) {
                txConfig.removeAt(j);
            } else {
                this.notifications.error('You must provide at least one Destination for a Hot Folder');
            }
        };
    }

    /**
     * Adds a new set of remote configuration destination fields to the hot folder at a certain index.
     *
     * @param {number} idx - Index of hot folder to add destination settings to
     */
    addRemoteConfiguration(idx: number) {
        const txConfig = this.hotFolderForm?.get(['uploadHotFolders', idx])?.get('remoteConfigurations') as FormArray;
        txConfig.push(new FormGroup({
            remoteConfigurationName: new FormControl<string>('', Validators.required),
            s3DestinationFolder: new FormControl<string>(''),
        }));
    }
}
