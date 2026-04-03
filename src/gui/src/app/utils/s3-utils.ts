interface ProcessErrorInput {
    transferProfile: string,
    s3ErrorMessage: string,
}

export interface S3BrowserError {
    errorMessage: string,
    fixableByConfiguration: boolean,
}

const s3ErrorCodeRegExp = new RegExp('^([A-Z][a-z]+)+$'); // matches Pascal case
const awsRegionRegExp = new RegExp('([a-z]+-){2}([a-z]+-)?[0-9]+'); // matches region names such as us-west-2 and us-gov-west-1
const singleQuotedRegExp = new RegExp('\'([^\']+)\''); // matches text between single quotes
const transferProfilePlaceholder = '__TRANSFER_PROFILE__';
const s3ErrorCodes: Record<string, string> = {
    // creds errors
    'ExpiredToken': `The credentials for the Remote Configuration "${transferProfilePlaceholder}" are expired. Update your credentials and try again.`,
    'NoCredentialProviders': `Missing credentials for the Remote Configuration "${transferProfilePlaceholder}". Update your credentials and try again.`,
    'InvalidToken': `Invalid credentials or invalid Region provided for this Remote Configuration. Update your credentials or update the Region for the Remote Configuration "${transferProfilePlaceholder}".`,
    // region errors
    'RequestError': `Unable to make request. Update the AWS Region for the Remote Configuration "${transferProfilePlaceholder}" to a valid AWS Region.`,
    'MissingRegion': `Missing AWS Region for the Remote Configuration "${transferProfilePlaceholder}". Update the Region to the one that the S3 Bucket is in.`,
    'IllegalLocationConstraintException': `The AWS Region set for the Remote Configuration "${transferProfilePlaceholder}" isn't enabled for the account. Update the Region to the one that the S3 Bucket is in.`,
    'MissingEndpoint': `S3 Bucket name is missing or AWS Region is invalid. Verify that the S3 Bucket name and Region are set correctly for the Remote Configuration "${transferProfilePlaceholder}".`,
    'SignatureDoesNotMatch': `SignatureDoesNotMatch error occurred. The request signature that the server calculated does not match the signature that you provided. Verify that the S3 Bucket name, AWS Region, and credentials are set correctly for the Remote Configuration "${transferProfilePlaceholder}".`,
    // bucket errors
    'InvalidBucketName': `S3 Bucket name is invalid. Update the S3 Bucket name for the Remote Configuration "${transferProfilePlaceholder}".`,
    'NoSuchBucket': `S3 Bucket doesn't exist. Update the S3 Bucket name for the Remote Configuration "${transferProfilePlaceholder}".`,
};
const retryableS3ErrorCodes: Record<string, string> = {
    // internal error
    'InternalError': `An internal error occurred when browsing the S3 Bucket for the Remote Configuration "${transferProfilePlaceholder}". Try again later.`,
};
const complexS3ErrorCodes: Record<string, (input: ProcessErrorInput) => string> = {
    // region errors
    'BucketRegionError': bucketRegionError,
    'AuthorizationHeaderMalformed': authorizationHeaderError,
};
// Error codes where the error is not due to incorrect transfer profile configuration, but due to other reasons
const nonFixableByConfigurationErrors: string[] = [
    'ExpiredToken', 'InternalError',
];

/**
 * Parses out error code from S3 error message
 * @param {string} errorMessage - Original error message from S3
 * @return {string} - Returns error code or empty string if no valid error code was found
 */
function getS3ErrorCode(errorMessage: string): string {
    const errorMessageString: string = JSON.stringify(errorMessage);

    if (errorMessageString.endsWith('missing trailer')) {
        return '';
    }

    const idx = errorMessageString.indexOf(':');
    if (idx === -1) {
        return '';
    }

    const errorCode = errorMessageString.substring(0, idx);
    if (s3ErrorCodeRegExp.test(errorCode)) {
        return errorCode;
    }

    return '';
}

/**
 * Gets custom error message for BucketRegionError error
 * @param {ProcessErrorInput} input - Original error message from S3 and transfer profile name
 * @return {string} - Returns custom error message to be displayed
 */
function bucketRegionError(input: ProcessErrorInput): string {
    const wrongRegion = input.s3ErrorMessage.match(new RegExp(`is not in '${awsRegionRegExp.source}' AWS region`));
    const correctRegion = input.s3ErrorMessage.match(new RegExp(`is in '${awsRegionRegExp.source}' AWS region`));
    return getRegionErrorMessage(input.transferProfile, wrongRegion, correctRegion);
}

/**
 * Gets custom error message for AuthorizationHeaderMalformed error
 * @param {ProcessErrorInput} input - Original error message from S3 and transfer profile name
 * @return {string} - Returns custom error message to be displayed
 */
function authorizationHeaderError(input: ProcessErrorInput): string {
    const wrongRegion = input.s3ErrorMessage.match(new RegExp(`the AWS region '${awsRegionRegExp.source}' is wrong`));
    const correctRegion = input.s3ErrorMessage.match(new RegExp(`expecting '${awsRegionRegExp.source}'`));
    return getRegionErrorMessage(input.transferProfile, wrongRegion, correctRegion);
}

/**
 * Processes two RegExpMatchArrays containing the wrong region and correctRegion for a bucket to return a formatted error message.
 * Returns a default error message if any of the RegExpMatchArrays are null.
 * @param transferProfile Transfer profile that the bucket belongs to
 * @param wrongRegion RegExpMatchArray that may contain the wrong region that the user has provided in their configuration
 * @param correctRegion RegExpMatchArray that may contain the correct region that the bucket is in
 */
function getRegionErrorMessage(transferProfile: string, wrongRegion: RegExpMatchArray | null, correctRegion: RegExpMatchArray | null): string {
    if (wrongRegion && correctRegion) {
        const wrongRegionArray = wrongRegion[0].match(singleQuotedRegExp);
        const correctRegionArray = correctRegion[0].match(singleQuotedRegExp);
        if (wrongRegionArray && correctRegionArray) {
            const wrongRegionStr = wrongRegionArray[0].replace(/'/gi, '');
            const correctRegionStr = correctRegionArray[0].replace(/'/gi, '');
            return `The bucket you provided isn't in the "${wrongRegionStr}" Region. The bucket you provided is in the "${correctRegionStr}" Region.
            Update the Region for the Remote Configuration "${transferProfile}".`;
        }
    }
    return `Bucket doesn't exist in the provided Region. Update the Region of the Remote Configuration "${transferProfile}" to the one that the bucket is in.`;
}

/**
 * Checks if the error is considered a retryable error
 * @param {string} s3ErrorMessage - Original error message from S3
 * @return {boolean} - Returns true if the error is considered a retryable error
 */
export function isRetryableError(s3ErrorMessage: string): boolean {
    return getS3ErrorCode(s3ErrorMessage) in retryableS3ErrorCodes;
}

/**
 * Takes in an error message from S3 and returns a processed, custom error message
 * @param {string} s3ErrorMessage - Original error message from S3
 * @param {string} transferProfile - Transfer profile name
 * @return {string} - Returns a custom error message
 */
export function getS3BrowserError(s3ErrorMessage: string, transferProfile: string): S3BrowserError | null {
    // TODO: uncomment and change S3 browser error processing code when updating S3 error handling code for AWS v2 SDK
    //  This error handling implementation is specific to v1 SDK error messages
    try {
        const errorCode = getS3ErrorCode(s3ErrorMessage);
        let errorMessage = `Unable to browse bucket.
        Verify that your configuration and credentials for the Remote Configuration "${transferProfile}" are correct
        or refresh your credentials, then try again by clicking the refresh button.`;
        if (errorCode) {
            if (errorCode in s3ErrorCodes) {
                errorMessage = s3ErrorCodes[errorCode].replace(transferProfilePlaceholder, transferProfile);
            }
            if (errorCode in retryableS3ErrorCodes) {
                errorMessage = retryableS3ErrorCodes[errorCode].replace(transferProfilePlaceholder, transferProfile);
            }
            if (errorCode in complexS3ErrorCodes) {
                const errorInput: ProcessErrorInput = {
                    transferProfile: transferProfile,
                    s3ErrorMessage: s3ErrorMessage,
                };
                errorMessage = complexS3ErrorCodes[errorCode](errorInput);
            }
        }
        return {
            errorMessage: errorMessage,
            fixableByConfiguration: !nonFixableByConfigurationErrors.includes(errorCode),
        };
    } catch (err) {
        console.error('Unexpected error in getS#BrowserError', err);
        return null;
    }
}
