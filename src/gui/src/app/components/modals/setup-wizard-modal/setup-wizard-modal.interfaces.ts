import { TransferProfile } from '@app/classes/config';

export interface SetupWizardConfig {
    title: string,
    initialData: SetupWizardData,
    firstLaunchComplete: boolean,
}

export interface SetupWizardData {
    transferProfiles: Record<string, TransferProfile>,
    checkSetup: boolean,
    noChanges?: boolean,
}

export interface ValidatedTransferProfile {
    hasError: boolean,
    fields: {
        name: ValidatedField,
        profile: ValidatedField,
        bucket: ValidatedField,
        region: ValidatedField,
    },
}

export interface ValidatedField {
    title: string,
    value: string,
    error: string,
}

export interface WizardStepStates {
    transferProfile: StepState,
}

export interface StepState {
    needHelp: boolean,
    validSetup: boolean,
    edited: boolean,
    skipped: boolean,
}
