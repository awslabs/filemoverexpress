import { KeyValuePipe, NgClass } from '@angular/common';
import { AfterViewInit, Component, inject, viewChild } from '@angular/core';
import { FormGroup, FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatStep, MatStepLabel, MatStepper, MatStepperNext, MatStepperPrevious } from '@angular/material/stepper';
import { MatTooltip } from '@angular/material/tooltip';
import { TransferProfile } from '@app/classes/config';
import { sectionTitles } from '@app/constants/common.constants';
import { docsLinks } from '@app/constants/external-links';
import { validateBucket, validateName, validateRegion } from '@app/utils/config-utils';
import { isPackagedApp } from '@app/utils/utils';
import { TransferProfileFormComponent } from '@containers/forms/transfer-profile-form/transfer-profile-form.component';
import { TransferProfileForm } from '@containers/forms/transfer-profile-form/transfer-profile-form.interfaces';
import { RegionsService } from '@services/regions/regions.service';
import { SetupWizardConfig, SetupWizardData, ValidatedTransferProfile, WizardStepStates } from './setup-wizard-modal.interfaces';
import {
    checksumAlgorithms,
    createTransferProfileForm,
    storageClasses,
} from '@containers/forms/transfer-profile-form/transfer-profile-form.constants';
import { WailsService } from '@services/wails/wails.service';

@Component({
    selector: 'fme-setup-wizard-modal',
    templateUrl: './setup-wizard-modal.component.html',
    styleUrls: ['./setup-wizard-modal.component.scss'],
    imports: [
        TransferProfileFormComponent,
        MatStepper,
        MatStep,
        MatStepLabel,
        MatIcon,
        MatButton,
        MatStepperNext,
        MatStepperPrevious,
        KeyValuePipe,
        MatAccordion,
        MatExpansionPanel,
        MatExpansionPanelHeader,
        MatExpansionPanelTitle,
        NgClass,
        MatTooltip,
        MatCheckbox,
        FormsModule,
    ],
})
export class SetupWizardModalComponent implements AfterViewInit {
    private dialogRef = inject<MatDialogRef<SetupWizardModalComponent>>(MatDialogRef);
    private regionsService = inject(RegionsService);
    private wails = inject(WailsService);

    // non-null assertion operator (!) added for ViewChildren since they can only be initialized in AfterViewInit
    // @ViewChild('wizardStepper') wizardStepper!: MatStepper;
    // @ViewChild('transferProfileStep') transferProfileStep!: MatStep;
    wizardStepper = viewChild<MatStepper>('wizardStepper');
    transferProfileStep = viewChild<MatStep>('transferProfileStep');
    title: string;
    initialData: SetupWizardData;
    skipToEnd: boolean;
    validatedTransferProfiles: Record<string, ValidatedTransferProfile>;
    transferProfilesHaveErrors: boolean;
    firstLaunchComplete: boolean;
    setupWizardResult: SetupWizardData;
    transferProfileForm: FormGroup<TransferProfileForm>;
    wizardStepStates: WizardStepStates;
    stopShowingWizard = false;
    regions: string[] = [];

    sectionTitles = sectionTitles;
    docsLinks = docsLinks;

    constructor() {
        const data = inject<SetupWizardConfig>(MAT_DIALOG_DATA);

        this.skipToEnd = false;
        this.wizardStepStates = {
            transferProfile: {
                needHelp: false,
                validSetup: false,
                edited: false,
                skipped: true,
            },
        };
        this.title = data.title;
        this.initialData = data.initialData;
        this.validatedTransferProfiles = {};
        this.transferProfilesHaveErrors = false;
        this.firstLaunchComplete = data.firstLaunchComplete;
        this.setupWizardResult = {
            checkSetup: this.initialData.checkSetup,
            transferProfiles: this.initialData.transferProfiles,
        };
        this.wizardStepStates.transferProfile.needHelp = Object.keys(this.initialData?.transferProfiles).length === 0;
        if (!this.wizardStepStates.transferProfile.needHelp) {
            this.regionsService.regions$.subscribe(
                (regions) => {
                    this.regions = regions;
                    this.processTransferProfiles();
                },
            );
            this.processTransferProfiles();
        }

        this.transferProfileForm = createTransferProfileForm(storageClasses, checksumAlgorithms);
    }

    ngAfterViewInit() {
        const step = this.transferProfileStep();
        if (!step) {
            return;
        }

        step.stepControl = this.transferProfileForm;
    }

    openExternalLink(link: string) {
        if (isPackagedApp()) {
            this.wails.externalLink(link).subscribe();
        }
    }

    processTransferProfiles() {
        let allTransferProfilesInvalid = true;

        Object.keys(this.initialData?.transferProfiles).map(
            (transferProfileName) => {
                const transferProfile = this.initialData.transferProfiles[transferProfileName];
                const nameError = validateName(transferProfile.name);
                const bucketError = validateBucket(transferProfile.bucket);
                const regionError = validateRegion(transferProfile.region, this.regions);
                const hasError = !!(nameError || bucketError || regionError);
                if (hasError) {
                    this.transferProfilesHaveErrors = true;
                } else {
                    allTransferProfilesInvalid = false;
                }

                this.validatedTransferProfiles[transferProfileName] = {
                    hasError: hasError,
                    fields: {
                        name: {
                            title: 'Name',
                            value: transferProfile.name,
                            error: nameError,
                        },
                        bucket: {
                            title: 'Bucket',
                            value: transferProfile.bucket,
                            error: bucketError,
                        },
                        region: {
                            title: 'Region',
                            value: transferProfile.region,
                            error: regionError,
                        },
                        profile: {
                            title: 'AWS named profile',
                            value: transferProfile.profile,
                            error: '',
                        },
                    },
                };
            },
        );

        this.wizardStepStates.transferProfile.validSetup = !allTransferProfilesInvalid;
    }

    doneText() {
        if (this.skipToEnd || this.wizardStepStates.transferProfile.skipped) {
            return 'You have skipped the setup tutorial.';
        }
        if (this.wizardStepStates.transferProfile.validSetup) {
            return 'You have set up a Remote Configuration.';
        }
        return 'You have completed the setup tutorial, but you will need to add a valid Remote Configuration to start any transfers.';
    }

    onWelcomeNext() {
        this.skipToEnd = false;
    }

    onWelcomeSkip() {
        this.onTransferProfileSkip();
        this.skipToEnd = true;
        const stepper = this.wizardStepper();
        if (!stepper) {
            return;
        }

        stepper.selectedIndex = stepper.steps.length - 1;
    }

    onFinalStepPrevious() {
        const stepper = this.wizardStepper();
        if (!stepper) {
            return;
        }
        stepper.selectedIndex = this.skipToEnd ? 0 : stepper.selectedIndex - 1;
    }

    onTransferProfileSkip() {
        this.wizardStepStates.transferProfile.validSetup = false;
        this.wizardStepStates.transferProfile.skipped = true;
        this.wizardStepStates.transferProfile.edited = false;
        this.setupWizardResult.transferProfiles = this.initialData.transferProfiles;
    }

    onTransferProfileSubmit() {
        this.wizardStepStates.transferProfile.validSetup = true;
        this.wizardStepStates.transferProfile.skipped = false;
        this.wizardStepStates.transferProfile.edited = true;
        const txProfile = TransferProfile.fromJson(this.transferProfileForm.getRawValue());
        const txProfileName = this.transferProfileForm.get('name')?.value;
        if (txProfileName) {
            this.setupWizardResult.transferProfiles[txProfileName] = txProfile;
        }
    }

    updateTransferProfileForm(transferProfileForm: FormGroup) {
        this.transferProfileForm = transferProfileForm;
    }

    completeSetup() {
        this.setupWizardResult.checkSetup = !this.stopShowingWizard;
        this.setupWizardResult.noChanges = this.skipToEnd || !this.wizardStepStates.transferProfile.edited;
        this.dialogRef.close(this.setupWizardResult);
    }

    protected readonly Object = Object;
}
