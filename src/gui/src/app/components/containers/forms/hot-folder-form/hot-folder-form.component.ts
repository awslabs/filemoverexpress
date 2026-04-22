import { Component, computed, inject, input, OnDestroy, output, viewChildren } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    MatAccordion,
    MatExpansionPanel,
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
    HotFolderData,
    HotFolderFormGroup,
    HotFolderRemoteConfigFormGroup,
} from '@containers/forms/hot-folder-form/hot-folder-form.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { MetadataService } from '@services/metadata/metadata.service';
import { toSignal } from '@angular/core/rxjs-interop';
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
export class HotFolderFormComponent implements OnDestroy {
    protected readonly formErrorMessages = formErrorMessages;
    private expansionPanels = viewChildren(MatExpansionPanel);
    private metadata = inject(MetadataService);
    private metadataSignal = toSignal(this.metadata.onUpdate);
    private changeSub: Subscription | null = null;

    preFillNewHotFolderData = input<HotFolderData>({});
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
                hotFolder.remoteConfigurations.map(remoteConfig => new FormGroup<HotFolderRemoteConfigFormGroup>({
                    remoteConfigurationName: new FormControl<string>(remoteConfig.remoteConfigurationName, {
                        validators: [Validators.required],
                        nonNullable: true,
                    }),
                    s3DestinationFolder: new FormControl<string>(remoteConfig.s3DestinationFolder, {
                        validators: [Validators.required],
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

        if (prefills.localSourcePath) {
            if (!hotFolders.find(itm => itm.localSourceFolder === prefills.localSourcePath)) {
                const prefillFormGroup = new FormGroup<HotFolderFormGroup>({
                        name: new FormControl<string>('', {
                            validators: [validateHotFolderNames, Validators.required],
                            nonNullable: true,
                        }),
                        enabled: new FormControl<boolean>(true, {nonNullable: true}),
                        localSourceFolder: new FormControl<string>(this.preFillNewHotFolderData().localSourcePath ?? '', {
                            validators: [Validators.required],
                            nonNullable: true,
                        }),
                        remoteConfigurations: new FormArray<FormGroup<HotFolderRemoteConfigFormGroup>>([
                            new FormGroup<HotFolderRemoteConfigFormGroup>({
                                remoteConfigurationName: new FormControl<string>('', {
                                    validators: [Validators.required],
                                    nonNullable: true,
                                }),
                                s3DestinationFolder: new FormControl<string>(prefills.s3DestinationPath ?? '', {
                                    validators: [Validators.required],
                                    nonNullable: true,
                                }),
                            }),
                        ], {validators: [Validators.required]}),
                    },
                );
                hff.push(prefillFormGroup);

                // To avoid a circular reference we need to run this with a timer
                setTimeout(() => this.expansionPanels()?.at(-1)?.open(), 200);
            }
        }

        this.changeSub?.unsubscribe();
        this.changeSub = hff.statusChanges.subscribe(__status => this.hotFoldersEdited.emit(this.hotFolderFormArray()));

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
                localSourceFolder: new FormControl<string>(this.preFillNewHotFolderData().localSourcePath || '', {
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
            s3DestinationFolder: new FormControl<string>('', {validators: [Validators.required], nonNullable: true}),
        });
    }
}
