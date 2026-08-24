import { Component, computed, inject, input, OnDestroy, output, viewChildren } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelDescription,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatError, MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { formErrorMessages } from '@app/constants/common.constants';
import { HotFolders } from '@classes/config';
import { validateHotFolderNames } from '@classes/form-validators';
import {
    HotFolderFormGroup,
    HotFolderRemoteConfigFormGroup,
} from '@containers/forms/hot-folder-form/hot-folder-form.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { MetadataService } from '@services/metadata/metadata.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ConfigureHotFolderModalData } from '@modals/configure-hot-folder-modal/configure-hot-folder-modal.interfaces';
import { AppState } from '@app/state';
import { Store } from '@ngrx/store';
import { selectBucketBrowserPath } from '@state/ui-context/ui-context.selectors';
import { PanelComponent } from '@app/components/layout/panel/panel.component';

@Component({
    selector: 'fme-hot-folder-form',
    templateUrl: './hot-folder-form.component.html',
    styleUrls: ['./hot-folder-form.component.scss'],
    imports: [
        ReactiveFormsModule,
        MatAccordion,
        MatExpansionPanel,
        MatExpansionPanelDescription,
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
        PanelComponent,
    ],
})
export class HotFolderFormComponent implements OnDestroy {
    protected readonly formErrorMessages = formErrorMessages;
    private expansionPanels = viewChildren(MatExpansionPanel);
    private metadata = inject(MetadataService);
    private metadataSignal = toSignal(this.metadata.onUpdate);
    private changeSub: Subscription | null = null;
    private store = inject<Store<AppState>>(Store);
    private currentS3Path = this.store.selectSignal(selectBucketBrowserPath);
    protected warning: string | null = null;

    preFillNewHotFolderData = input<ConfigureHotFolderModalData | null>(null);
    hotFolders = input<HotFolders[]>([]);
    hotFoldersEdited = output<FormArray<FormGroup<HotFolderFormGroup>>>();

    protected transferProfiles = computed(() => {
        this.metadataSignal(); // Required to trigger update
        return Object.keys(this.metadata.transferProfiles);
    });
    protected hotFolderFormArray = computed(() => {
        const hff: FormArray<FormGroup<HotFolderFormGroup>> = new FormArray<FormGroup<HotFolderFormGroup>>([]);
        const prefills = this.preFillNewHotFolderData();
        const hotFolders = this.hotFolders();

        for (const hotFolder of hotFolders) {
            const remoteConfigs = new FormArray<FormGroup<HotFolderRemoteConfigFormGroup>>(
                hotFolder.remoteConfigurations.map((remoteConfig) => new FormGroup<HotFolderRemoteConfigFormGroup>({
                    remoteConfigurationName: new FormControl<string>(remoteConfig.remoteConfigurationName, {
                        validators: [Validators.required],
                        nonNullable: true,
                    }),
                    s3DestinationFolder: new FormControl<string>(remoteConfig.s3DestinationFolder, {
                        nonNullable: true,
                    }),
                })),
            );
            hff.push(new FormGroup<HotFolderFormGroup>({
                name: new FormControl<string>(hotFolder.name, {validators: [Validators.required], nonNullable: true}),
                enabled: new FormControl<boolean>(hotFolder.enabled, {validators: [Validators.required], nonNullable: true}),
                localSourceFolder: new FormControl<string>(hotFolder.localSourceFolder, {validators: [Validators.required], nonNullable: true}),
                remoteConfigurations: remoteConfigs,
            }));
        }

        if (prefills) {
            const destinationPath = (this.currentS3Path() ?? '') + (prefills.hotFolderDestinationPath ?? '');
            const existingIndex = hotFolders.findIndex((itm) => itm.localSourceFolder === prefills.hotFolderSourcePath);
            if (existingIndex == -1) {
                const prefillFormGroup = new FormGroup<HotFolderFormGroup>({
                    name: new FormControl<string>('', {
                        validators: [validateHotFolderNames, Validators.required],
                        nonNullable: true,
                    }),
                    enabled: new FormControl<boolean>(true, {nonNullable: true}),
                    localSourceFolder: new FormControl<string>(prefills.hotFolderSourcePath ?? '', {
                        validators: [Validators.required],
                        nonNullable: true,
                    }),
                    remoteConfigurations: new FormArray<FormGroup<HotFolderRemoteConfigFormGroup>>([
                        new FormGroup<HotFolderRemoteConfigFormGroup>({
                            remoteConfigurationName: new FormControl<string>(prefills.profileName ?? '', {
                                validators: [Validators.required],
                                nonNullable: true,
                            }),
                            s3DestinationFolder: new FormControl<string>(destinationPath, {
                                nonNullable: true,
                            }),
                        }),
                    ], {validators: [Validators.required]}),
                });
                hff.push(prefillFormGroup);

                // To avoid a circular reference we need to run this with a timer
                setTimeout(() => this.expansionPanels()?.at(-1)?.open(), 100);
            } else {
                const existingHotFolder = hotFolders.at(existingIndex);
                this.warning = `Hot folder ${existingHotFolder?.name} is already configured for ${prefills.hotFolderSourcePath}`;
                setTimeout(() => this.expansionPanels()?.at(existingIndex)?.open(), 100);
            }
        }

        this.changeSub?.unsubscribe();
        this.changeSub = hff.statusChanges.subscribe((__status) => this.hotFoldersEdited.emit(hff));
        // statusChanges does not fire on subscription, so emit the initial state once.
        // Without this the parent modal's mirrored form stays null and its Save guard
        // can't see that a new hot folder is invalid (e.g. missing name).
        setTimeout(() => this.hotFoldersEdited.emit(hff));

        return hff;
    });

    ngOnDestroy() {
        this.changeSub?.unsubscribe();
    }

    /**
     * Adds a set of fields for a new hot folder.
     */
    addHotFolder() {
        return () => {
            setTimeout(() => this.expansionPanels()?.at(-1)?.open(), 100);

            this.hotFolderFormArray().push(new FormGroup<HotFolderFormGroup>({
                name: new FormControl<string>('', {
                    validators: [validateHotFolderNames, Validators.required],
                    nonNullable: true,
                }),
                enabled: new FormControl<boolean>(true, {nonNullable: true}),
                localSourceFolder: new FormControl<string>(this.preFillNewHotFolderData()?.hotFolderSourcePath ?? '', {
                    validators: [Validators.required],
                    nonNullable: true,
                }),
                remoteConfigurations: new FormArray<FormGroup<HotFolderRemoteConfigFormGroup>>(
                    [
                        new FormGroup<HotFolderRemoteConfigFormGroup>({
                            remoteConfigurationName: new FormControl<string>('', {
                                validators: [Validators.required],
                                nonNullable: true,
                            }),
                            s3DestinationFolder: new FormControl<string>('', {nonNullable: true}),
                        }),
                    ],
                    Validators.required,
                ),
            }));
        };
    }

    /**
     * Creates a new empty remote configuration form group
     */
    createRemoteConfigFormGroup() {
        return new FormGroup<HotFolderRemoteConfigFormGroup>({
            remoteConfigurationName: new FormControl<string>('', {
                validators: [Validators.required],
                nonNullable: true,
            }),
            s3DestinationFolder: new FormControl<string>('', {nonNullable: true}),
        });
    }
}
