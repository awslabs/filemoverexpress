import { TransferProfile } from '@classes/config';
import { FormControl, Validators } from '@angular/forms';
import { noSpacesValidator, oneOfValidator } from '@classes/form-validators';

export function validTransferProfileExists(transferProfiles: Record<string, TransferProfile>, regions: string[]): boolean {
    const numTransferProfiles = Object.keys(transferProfiles).length;
    if (!numTransferProfiles) {
        return false;
    }

    let atLeastOneValid = false;
    Object.values(transferProfiles).map(
        (transferProfile) => {
            const nameError = validateName(transferProfile.name);
            const bucketError = validateBucket(transferProfile.bucket);
            const regionError = validateRegion(transferProfile.region, regions);
            const hasError = !!(nameError || bucketError || regionError);
            if (!hasError) {
                atLeastOneValid = true;
            }
        },
    );
    return atLeastOneValid;
}

export function validateName(name: string) {
    const nameControl = new FormControl(name, [
        Validators.required, noSpacesValidator,
    ]);
    if (nameControl.hasError('required')) {
        return 'Remote Configuration name is required';
    }
    if (nameControl.hasError('hasSpaces')) {
        return 'Remote Configuration name cannot have spaces';
    }
    return '';
}

export function validateBucket(bucket: string) {
    const bucketControl = new FormControl(bucket, [
        Validators.required,
    ]);
    if (bucketControl.hasError('required')) {
        return 'S3 Bucket name is required';
    }
    return '';
}

export function validateRegion(region: string, regions: string[]) {
    const regionControl = new FormControl(region, [
        Validators.required, oneOfValidator(regions),
    ]);
    if (regionControl.hasError('required')) {
        return 'AWS region is required';
    }
    if (regionControl.hasError('oneOf')) {
        return regions ? 'Invalid AWS region' : 'Error occurred when validating AWS region';
    }
    return '';
}
