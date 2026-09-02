import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgClass } from '@angular/common';
import { AfterContentInit, AfterViewInit, Component, ElementRef, inject, input, OnDestroy, OnInit, output, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRow } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { MatError, MatFormField, MatHint, MatInput, MatLabel, MatSuffix } from '@angular/material/input';
import { BrowseButtonComponent } from '@primitives/forms/browse-button/browse-button.component';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import {
    autotuningFieldsIsIntegerValidator,
    autotuningFieldsRequiredValidator,
    bucketValidator,
    chunksizeMinValidator,
    fileExtensionRegExp,
    handleStreamError,
    oidcIssuerUrlValidator,
    s3ArnRgx,
    threadsMinValidator,
    TransferProfile,
} from '@app/classes';
import { HintPopoverService } from '@services/hint-popover/hint-popover.service';
import { formErrorMessages } from '@app/constants/common.constants';
import { ObjectSortPipe } from '@app/pipes/object-sort.pipe';
import { isPackagedApp } from '@app/utils/utils';
import { MetadataEvent } from '@events/core';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { RegionsService } from '@services/regions/regions.service';
import { Subscription } from 'rxjs';
import { checksumAlgorithms, createTransferProfileForm, separatorKeysCodes, storageClasses } from './transfer-profile-form.constants';
import { EditorMode, StorageClass, TransferProfileForm } from './transfer-profile-form.interfaces';
import { WailsService } from '@services/wails/wails.service';

@Component({
    selector: 'fme-transfer-profile-form',
    templateUrl: './transfer-profile-form.component.html',
    styleUrls: ['./transfer-profile-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatHint,
        MatError,
        MatInput,
        MatSuffix,
        BrowseButtonComponent,
        MatSelect,
        MatOption,
        MatAutocompleteTrigger,
        MatAutocomplete,
        MatChipGrid,
        CdkDropList,
        MatChipRow,
        NgClass,
        CdkDrag,
        MatIcon,
        MatChipInput,
        MatSlideToggle,
        ObjectSortPipe,
    ],
})
export class TransferProfileFormComponent implements OnInit, OnDestroy, AfterViewInit, AfterContentInit {
    private regionsService = inject(RegionsService);
    private fmeClientService = inject(FmeClientService);
    private hintPopover = inject(HintPopoverService);
    private wails = inject(WailsService);

    tutorialMode = input<boolean>(false);
    transferProfile = input<TransferProfile | null>();
    mode = input<EditorMode>('add');
    transferProfileEdited = output<FormGroup<TransferProfileForm>>();
    // non-null assertion operator (!) added for ViewChildren since they can only be initialized in AfterViewInit
    @ViewChild('fileOrderChipList') fileOrderChipList!: MatChipGrid;
    @ViewChild('bucketHint') bucketHint!: ElementRef;
    transferProfileForm: FormGroup = new FormGroup({});
    // Left-nav section (matches the Settings page). Panels stay mounted; nav toggles them.
    activeTab: 'connection' | 'authentication' | 'performance' = 'connection';
    daemonOS = '';
    errorMessages = formErrorMessages;
    regions: string[];
    storageClasses: StorageClass[] = storageClasses;
    checksumAlgorithms = checksumAlgorithms;
    awsProfiles: string[] = [];
    protected readonly formErrorMessages = formErrorMessages;
    checksumSelector = new FormControl<string>('none');

    private subscriptions: Subscription[] = [];
    readonly separatorKeysCodes = separatorKeysCodes;

    constructor() {
        this.regions = this.regionsService.getRegions();

        this.regionsService.regions$.pipe(handleStreamError({retryCount: 3})).subscribe({
            next: (regions) => {
                this.regions = regions;
            },
            error: (error) => {
                this.fmeClientService.processStreamError(error);
            },
        });

        this.subscriptions.push(this.fmeClientService.metadata.subscribe(this.processMetadata.bind(this)));
    }

    ngOnInit() {
        this.transferProfileForm = this.setupFormGroup();
    }

    ngOnDestroy() {
        this.subscriptions.map((sub) => sub.unsubscribe());
        this.subscriptions = [];
    }

    ngAfterViewInit() {
        const bucketControl = this.transferProfileForm.get('bucket');
        if (bucketControl) {
            const bucketSubscription = bucketControl.valueChanges.subscribe(
                () => {
                    // In the tabbed layout the bucket hint only exists while the Connection
                    // tab is rendered; guard against it being absent (e.g. another tab active).
                    if (!this.bucketHint) {
                        return;
                    }
                    const bucketHintString = (this.bucketHint.nativeElement as Element).innerHTML;
                    (this.bucketHint.nativeElement as Element).innerHTML = this.getOriginalHint(bucketHintString);
                },
            );
            this.subscriptions.push(bucketSubscription);
        } else {
            console.debug('Unable to get Remote Configuration bucket form control');
        }
    }

    ngAfterContentInit() {
        const ctrlEnabled = this.transferProfileForm.get('checksums.enabled');
        const ctrlValue = this.transferProfileForm.get('checksums.algorithm');
        if (ctrlEnabled && ctrlValue) {
            if (ctrlEnabled.value === true) {
                this.checksumSelector.setValue(ctrlValue.value);
            } else {
                this.checksumSelector.setValue('none');
            }
        }

        this.checksumSelector.valueChanges.subscribe((newValue) => {
            if (ctrlEnabled && ctrlValue) {
                if (!newValue || newValue === 'none') {
                    ctrlEnabled.setValue(false);
                    ctrlValue.setValue('none');
                } else {
                    ctrlEnabled.setValue(true);
                    ctrlValue.setValue(newValue);
                }
            }
        });
    }

    private setData() {
        const data = Object.assign({}, this.transferProfile());
        this.transferProfileForm.setValue(data);
        if (!this.transferProfileForm.controls.storageClass.value) {
            this.transferProfileForm.patchValue({storageClass: 'standard'});
        }
        this.transferProfileForm.markAllAsTouched();
    }

    setupFormGroup(): FormGroup<TransferProfileForm> {
        const form = createTransferProfileForm(this.storageClasses, this.checksumAlgorithms);

        // OIDC conditional validation: require fields when auth method is OIDC
        const authMethodControl = form.get('authMethod');
        if (authMethodControl) {
            const oidcFieldNames = ['oidcIssuerUrl',
                'oidcClientId',
                'oidcRoleArn'] as const;
            const issuerUrlAsyncValidator = oidcIssuerUrlValidator(this.wails);
            const authMethodSubscription = authMethodControl.valueChanges.subscribe((value) => {
                for (const fieldName of oidcFieldNames) {
                    const control = form.get(fieldName);
                    if (control) {
                        if (value === 'oidc') {
                            control.addValidators(Validators.required);
                            if (fieldName === 'oidcIssuerUrl') {
                                control.addAsyncValidators(issuerUrlAsyncValidator);
                            }
                        } else {
                            control.removeValidators(Validators.required);
                            if (fieldName === 'oidcIssuerUrl') {
                                control.removeAsyncValidators(issuerUrlAsyncValidator);
                            }
                        }
                        control.updateValueAndValidity({onlySelf: true});
                        // Switching auth method shouldn't paint empty fields red on its own.
                        // Reset the touched/dirty state so the "required" errors only surface
                        // once the user actually edits a field (or attempts to save).
                        control.markAsUntouched();
                        control.markAsPristine();
                    }
                }
            });
            this.subscriptions.push(authMethodSubscription);
        }

        form.get('chunkSize')?.addValidators([
            autotuningFieldsRequiredValidator,
            autotuningFieldsIsIntegerValidator,
            chunksizeMinValidator,
        ]);

        form.get('threads')?.addValidators([
            autotuningFieldsRequiredValidator,
            autotuningFieldsIsIntegerValidator,
            threadsMinValidator,
        ]);

        const autotuningControl = form.get('autoTuning');
        const autotuningThreadsControl = form.get('threads');
        const autotuningChunkSizeControl = form.get('chunkSize');
        if (autotuningControl && autotuningThreadsControl && autotuningChunkSizeControl) {
            const autotuningSubscription = autotuningControl.valueChanges.subscribe(
                () => {
                    autotuningThreadsControl.updateValueAndValidity({onlySelf: true});
                    autotuningChunkSizeControl.updateValueAndValidity({onlySelf: true});
                },
            );
            this.subscriptions.push(autotuningSubscription);
        } else {
            console.debug('Unable to get Remote Configuration autotuning form controls');
        }

        form.get('bucket')?.addValidators(bucketValidator);

        const acceleratedControl = form.get('accelerated');
        const bucketControl = form.get('bucket');
        if (acceleratedControl && bucketControl) {
            const acceleratedSubscription = acceleratedControl.valueChanges.subscribe(
                () => {
                    bucketControl.updateValueAndValidity({onlySelf: true});
                },
            );
            this.subscriptions.push(acceleratedSubscription);
        } else {
            console.debug('Unable to get Remote Configuration accelerated and bucket form controls');
        }

        this.transferProfileEdited.emit(form);

        form.valueChanges.subscribe(
            () => {
                this.transferProfileEdited.emit(form);
            },
        );

        if (this.mode() === 'update') {
            if (!this.transferProfile()) {
                console.error('transferProfile attribute must be set in update mode');
            } else {
                form.get('name')?.disable();
                setTimeout(() => {
                    this.setData(); // Runs on next tick to wait for form controls to be registered
                });
            }
        }

        return form;
    }

    getOriginalHint(hintMessage: string) {
        const extendedHintIndex = (hintMessage.indexOf('<span class="extended-hint">'));
        if (extendedHintIndex !== -1) {
            hintMessage = hintMessage.substring(0, extendedHintIndex);
        }
        return hintMessage;
    }

    addFileOrderChip(evt: MatChipInputEvent) {
        if (evt.value == '') {
            return;
        }
        const newChips = this.transferProfileForm.controls['fileOrder'].value || [];
        newChips.push(evt.value);
        evt.chipInput!.clear();
        this.transferProfileForm.controls['fileOrder'].setValue(newChips);
        this.fileOrderChipList.errorState = !!this.transferProfileForm.controls['fileOrder'].errors;
    }

    getFileOrderErrors() {
        this.fileOrderChipList.errorState = !!this.transferProfileForm.controls['fileOrder'].errors;
        const extensionList = this.transferProfileForm.controls['fileOrder'].value.toString().split(',');
        let invalidExtensions = '';
        extensionList.forEach((extension: string) => {
            if (!fileExtensionRegExp.test(extension)) {
                invalidExtensions += invalidExtensions ? `, ${extension}` : `${extension}`;
            }
        });
        return invalidExtensions ? `Invalid extensions: ${invalidExtensions}` : '';
    }

    removeFileOrderChip(ext: string) {
        const newChips = this.transferProfileForm.controls['fileOrder'].value.filter((x: string) => x !== ext);
        this.transferProfileForm.controls['fileOrder'].setValue(newChips);
        this.fileOrderChipList.errorState = !!this.transferProfileForm.controls['fileOrder'].errors;
    }

    chipListMovement(event: CdkDragDrop<string[]>) {
        moveItemInArray(this.transferProfileForm.controls['fileOrder'].value, event.previousIndex, event.currentIndex);
    }

    onBucketPaste(event: ClipboardEvent) {
        if (event.clipboardData) {
            this.setBucketValueAndHint(event.clipboardData.getData('text').trim(), event);
        }
    }

    onBucketBlur(event: FocusEvent) {
        this.setBucketValueAndHint(this.transferProfileForm.controls['bucket'].value, event);
    }

    setBucketValueAndHint(fieldValue: string, event: Event) {
        if (fieldValue?.length) {
            const match = fieldValue.match(s3ArnRgx)?.groups;

            if (match) {
                event.stopImmediatePropagation();
                event.preventDefault();

                let hintMessage = (this.bucketHint.nativeElement as Element).innerHTML;

                hintMessage = `${this.getOriginalHint(hintMessage)} <span class="extended-hint">`;
                if (this.tutorialMode()) {
                    hintMessage += '<br> ';
                }
                hintMessage += event instanceof ClipboardEvent
                    ? `Pasted <code>${fieldValue}</code>.`
                    : `Removed <code>s3://</code> from <code>${fieldValue}</code>.`;

                this.transferProfileForm.controls['bucket'].setValue(match['bucket']);
                (this.bucketHint.nativeElement as Element).innerHTML = hintMessage + '</span>';
            }
        }
    }

    getBucketError(): string {
        const error = this.transferProfileForm.controls['bucket'].errors;
        if (!error) {
            return '';
        }
        const errorStrings = {
            acceleratedWithPeriods: 'Buckets used with Amazon S3 Transfer Acceleration can\'t have dots (.) in their names',
            bucketURI: 'Enter bucket name without leading <code>s3://</code>',
            invalidPrefix: `Bucket name cannot start with <code>${error['invalidPrefix']}</code>`,
            invalidSuffix: `Bucket name cannot end with <code>${error['invalidSuffix']}</code>`,
            hasAdjacentPeriods: 'Bucket name cannot have adjacent periods',
            ipAddressFormat: 'Bucket name cannot be formatted as an IP address',
        };
        for (const [
            errorCode, errorMessage,
        ] of Object.entries(errorStrings)) {
            if (errorCode in error) {
                return errorMessage;
            }
        }
        return 'Bucket name format is invalid or there are invalid characters';
    }

    openExternalLink(event: Event, url: string) {
        event.preventDefault();

        if (isPackagedApp()) {
            this.wails.externalLink(url).subscribe();
        }
    }

    toggleHint(event: MouseEvent, message: string) {
        event.stopPropagation();
        event.preventDefault();

        this.hintPopover.open(event.currentTarget as HTMLElement, message);
    }

    private processMetadata(metadata: MetadataEvent) {
        this.daemonOS = metadata.daemonOS;
        this.awsProfiles = metadata.awsProfiles;
    }
}
