import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { FileBrowserType } from '@app/components/layout/file-browser/file-browser.interfaces';
import { processFavoritePath } from '@services/bookmarks/bookmarks.utils';
import { isUnixAbsolutePath, isWindowsAbsolutePath } from '@app/utils/path-utils';

export const fileExtensionRegExp = /^\.[a-zA-Z0-9]+$/;
const fileExtensionListRegExp = /^\.[a-zA-Z0-9]+(,*\.[a-zA-Z0-9]+)*$/;

// S3 bucket naming rules
const invalidBucketPrefixes = [
    'xn--', 'sthree-',
];
const invalidBucketSuffixes = [
    '-s3alias', '--ol-s3',
];
const ipAddressRegex = /^([0-9]+\.){3}[0-9]+$/;
const bucketRegex = /^[a-z0-9][a-zA-Z0-9.-]{1,61}[a-z0-9]$/;
const pre2018UsEastBucketRegex = /^[a-zA-Z0-9][a-zA-Z0-9.\-_]{1,252}[a-zA-Z0-9]$/;
// Matches an S3 location and captures the bucket name, accepting either an
// s3:// URI or a full S3 bucket ARN (arn:aws:s3:::bucket[/key...]). Used to
// auto-strip a pasted URI/ARN down to just the bucket name. See issue #27.
export const s3ArnRgx = new RegExp(/^(?:s3:\/\/|arn:aws:s3:::)(?<bucket>[a-zA-Z][a-zA-Z0-9.\-_]{1,252}[a-zA-Z])(?:\/.*)?$/);

export function fileOrderListValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value || control.value.length == 0) {
        return null;
    }

    if (fileExtensionListRegExp.test(control.value)) {
        return null;
    }
    return {invalidFileOrder: true};
}

export function maxActiveChecksumsValidator(cpuCoreCount: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (control.value !== null && (isNaN(control.value) || control.value > cpuCoreCount)) {
            return {invalidChecksum: true};
        }
        return null;
    };
}

export function noSpacesValidator(control: AbstractControl): ValidationErrors | null {
    if (/\s/g.test(control.value)) {
        return {hasSpaces: true};
    }
    return null;
}

export function oneOfValidator<T>(validOptions: T[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (!validOptions.includes(control.value)) {
            return {oneOf: true};
        }

        return null;
    };
}

/**
 * Returns validator function that returns error if the control's value is not equal to the match value.
 * @param matchValue Value to check equality against
 * @returns {ValidatorFn} - Equality check validator function
 */
export function isEqualValidator<T>(matchValue: T): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (matchValue !== control.value) {
            return {notEqual: true};
        }
        return null;
    };
}

/**
 * Returns validator function that returns error if the control's value is equal to the match value.
 * Has an optional argument that can be true if you want to ignore the control's value's surrounding whitespace.
 * @param matchValue Value to check inequality against
 * @param ignoreSurroundingWhitespace
 * @returns {ValidatorFn} - Inequality check validator function
 */
export function isNotEqualValidator<T>(matchValue: T, ignoreSurroundingWhitespace = false): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        let processedControlValue = control.value;
        if (ignoreSurroundingWhitespace) {
            processedControlValue = control.value.toString().trim();
        }

        if (matchValue === processedControlValue) {
            return {isEqual: true};
        }
        return null;
    };
}

/**
 * Returns validation error if the control's value is an empty string after trimming whitespace.
 * @param control Control to check value for
 * @returns {ValidationErrors | null} - Validation error or no error
 */
export function isNotEmptyString(control: AbstractControl): ValidationErrors | null {
    if (!control.value.toString().trim()) {
        return {isEmptyString: true};
    }

    return null;
}

/**
 * Returns validator function that returns error if the control's value exists in the
 * given list of favorite paths
 * @param existingPaths Array that control's value is checked for in
 */
export function favoritePathExistsValidator(existingPaths: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const processedValue = processFavoritePath(control.value);
        if (existingPaths.includes(processedValue)) {
            return {favoritePathExists: true};
        }

        return null;
    };
}

export function isIntegerValidator(control: AbstractControl): ValidationErrors | null {
    if (isNaN(control.value) || !Number.isInteger(control.value)) {
        return {isInteger: true};
    }

    return null;
}

export function bucketValidator(control: AbstractControl): ValidationErrors | null {
    const bucketString = control.value;
    if (!control.value || control.value.length == 0) {
        return null;
    }
    if (control.parent?.get('accelerated')?.value && bucketString.includes('.')) {
        return {
            invalidBucket: true,
            acceleratedWithPeriods: true,
        };
    }

    if (bucketString.startsWith('s3://')) {
        return {
            invalidBucket: true,
            bucketURI: true,
        };
    }

    for (const prefix of invalidBucketPrefixes) {
        if (bucketString.startsWith(prefix)) {
            return {
                invalidBucket: true,
                invalidPrefix: prefix,
            };
        }
    }

    for (const suffix of invalidBucketSuffixes) {
        if (bucketString.endsWith(suffix)) {
            return {
                invalidBucket: true,
                invalidSuffix: suffix,
            };
        }
    }

    if (bucketString.includes('..')) {
        return {
            invalidBucket: true,
            hasAdjacentPeriods: true,
        };
    }

    if (ipAddressRegex.test(bucketString)) {
        return {
            invalidBucket: true,
            ipAddressFormat: true,
        };
    }

    if (bucketRegex.test(bucketString) || pre2018UsEastBucketRegex.test(bucketString)) {
        return null;
    }
    return {invalidBucket: true};
}

export function autotuningFieldsRequiredValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.parent?.get('autoTuning')?.value && (control.value === null || control.value === undefined)) {
        return {autotuningFieldsRequired: true};
    }
    return null;
}

export function autotuningFieldsIsIntegerValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.parent?.get('autoTuning')?.value && control.value && !Number.isInteger(control.value)) {
        return {autotuningFieldsIsInteger: true};
    }
    return null;
}

export function chunksizeMinValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.parent?.get('autoTuning')?.value && control.value < 5) {
        return {chunksizeTooSmall: true};
    }
    return null;
}

export function threadsMinValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.parent?.get('autoTuning')?.value && control.value < 1) {
        return {threadsTooSmall: true};
    }
    return null;
}

export function isAbsolutePathValidator(daemonOS: FileBrowserType): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if (!control.value) {
            return null;
        }
        switch (daemonOS) {
            case 'windows':
                if (isWindowsAbsolutePath(control.value)) {
                    return null;
                }
                break;
            case 'darwin':
            case 'linux':
                if (isUnixAbsolutePath(control.value)) {
                    return null;
                }
                break;
            case 's3': {
                return null;
            }
            default:
                if (isUnixAbsolutePath(control.value) || isWindowsAbsolutePath(control.value)) {
                    return null;
                }
                break;
        }
        return {notAbsolutePath: true};
    };
}

export function validateHotFolderNames(control: AbstractControl): ValidationErrors | null {
    const myValue = control.value;

    if (control.parent?.parent?.controls) {
        const ctrls = Object.values(control.parent?.parent?.controls);
        for (const i of ctrls) {
            const nameCtrl = i.get('name');
            if (nameCtrl && nameCtrl !== control) {
                const otherValue = nameCtrl.value;

                if (myValue === otherValue) {
                    return {'duplicate-name': true};
                }
            }
        }
    }

    return null;
}
