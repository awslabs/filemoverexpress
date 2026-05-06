import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { AfterContentInit, AfterViewInit, Component, ElementRef, inject, input, OnDestroy, OnInit, output, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRow } from '@angular/material/chips';
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
import {
    autotuningFieldsIsIntegerValidator,
    autotuningFieldsRequiredValidator,
    bucketValidator,
    chunksizeMinValidator,
    fileExtensionRegExp,
    handleStreamError,
    s3ArnRgx,
    threadsMinValidator,
    TransferProfile,
} from '@app/classes';
import { HintsPanelComponent } from '@app/components/layout/hints-panel/hints-panel.component';
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
    imports: [
        ReactiveFormsModule,
        MatAccordion,
        MatExpansionPanel,
        MatExpansionPanelHeader,
        MatExpansionPanelTitle,
        MatExpansionPanelDescription,
        MatFormField,
        MatLabel,
        MatHint,
        MatError,
        MatInput,
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
        NgTemplateOutlet,
        ObjectSortPipe,
    ],
})
export class TransferProfileFormComponent implements OnInit, OnDestroy, AfterViewInit, AfterContentInit {
    private regionsService = inject(RegionsService);
    private fmeClientService = inject(FmeClientService);
    private bottomSheet = inject(MatBottomSheet);
    private wails = inject(WailsService);

    tutorialMode = input<boolean>(false);
    transferProfile = input<TransferProfile | null>();
    mode = input<EditorMode>('add');
    transferProfileEdited = output<FormGroup<TransferProfileForm>>();
    // non-null assertion operator (!) added for ViewChildren since they can only be initialized in AfterViewInit
    @ViewChild('fileOrderChipList') fileOrderChipList!: MatChipGrid;
    @ViewChild('bucketHint') bucketHint!: ElementRef;
    transferProfileForm: FormGroup = new FormGroup({});
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

        this.bottomSheet.open(HintsPanelComponent, {
            data: message,
            panelClass: 'bottom-sheet-hints',
        });
    }

    private processMetadata(metadata: MetadataEvent) {
        this.daemonOS = metadata.daemonOS;
        this.awsProfiles = metadata.awsProfiles;
    }
}
