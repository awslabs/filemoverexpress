import { COMMA, ENTER, SPACE } from '@angular/cdk/keycodes';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { fileOrderListValidator, noSpacesValidator, oneOfValidator } from '@app/classes';
import {
    AuthMethodType,
    ChecksumAlgorithm,
    StorageClass,
    TransferProfileForm,
} from '@containers/forms/transfer-profile-form/transfer-profile-form.interfaces';

export const storageClasses: StorageClass[] = [
    {key: 'standard', value: 'Standard'},
    {key: 'reduced_redundancy', value: 'Reduced Redundancy'},
    {key: 'standard_ia', value: 'Standard IA'},
    {key: 'onezone_ia', value: 'One Zone IA'},
    {key: 'intelligent_tiering', value: 'Intelligent Tiering'},
    {key: 'glacier', value: 'Glacier'},
    {key: 'deep_archive', value: 'Deep Archive'},
    {key: 'glacier_ir', value: 'Glacier Instant Retrieval'},
];

export const separatorKeysCodes = [
    ENTER,
    COMMA,
    SPACE,
];

export const checksumAlgorithms: ChecksumAlgorithm[] = [
    {
        value: 'none',
        viewValue: 'Disabled',
    },
    {
        value: 'md5-hex',
        viewValue: 'MD5-Hex',
    },
    {
        value: 'xxhash',
        viewValue: 'XXHash',
    },
    {
        value: 'xxhash64',
        viewValue: 'XXHash64',
    },
    {
        value: 'xxh3',
        viewValue: 'XXH3',
    },
];

export function createTransferProfileForm(
    storageClasses: StorageClass[],
    checksumAlgorithms: ChecksumAlgorithm[],
): FormGroup<TransferProfileForm> {
    return new FormGroup<TransferProfileForm>({
        // general settings
        name: new FormControl<string>(
            '',
            {
                nonNullable: true,
                validators: [
                    Validators.required, noSpacesValidator,
                ],
            },
        ),
        bucket: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        region: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        profile: new FormControl<string>('', {nonNullable: true}),
        // authentication method
        authMethod: new FormControl<AuthMethodType>('aws-profile', {nonNullable: true}),
        // OIDC settings
        oidcIssuerUrl: new FormControl<string>('', {nonNullable: true}),
        oidcClientId: new FormControl<string>('', {nonNullable: true}),
        oidcRoleArn: new FormControl<string>('', {nonNullable: true}),
        oidcScopes: new FormControl<string>('openid, email, profile, offline_access', {nonNullable: true}),
        oidcSessionDurationSeconds: new FormControl<number>(0, {nonNullable: true}),
        oidcPersistSession: new FormControl<boolean>(false, {nonNullable: true}),
        oidcCustomCaBundle: new FormControl<string>('', {nonNullable: true}),
        // advanced settings
        accelerated: new FormControl<boolean>(false, {nonNullable: true}),
        storageClass: new FormControl<string>(
            'standard',
            {
                nonNullable: true,
                validators: [Validators.required, oneOfValidator(storageClasses.map((item) => item.key))],
            },
        ),
        checksums: new FormGroup({
            enabled: new FormControl<boolean>(false, {nonNullable: true}),
            algorithm: new FormControl<string>(
                'none',
                {
                    nonNullable: true,
                    validators: [Validators.required, oneOfValidator(checksumAlgorithms.map((itm) => itm.value))],
                },
            ),
        }),
        paths: new FormGroup({
            local: new FormControl<string>('', {nonNullable: true}),
            remote: new FormControl<string>('', {nonNullable: true}),
        }),
        endpoint: new FormControl<string>('', {nonNullable: true}),
        // performance settings
        autoTuning: new FormControl<boolean>(true, {nonNullable: true}),
        chunkSize: new FormControl<number>(25, {nonNullable: true}),
        threads: new FormControl<number>(10, {nonNullable: true}),
        // filter and sort settings
        filter: new FormControl<string>('', {nonNullable: true}),
        maxAge: new FormControl<string>(
            '',
            {
                nonNullable: true,
                validators: [
                    Validators.pattern(new RegExp(/^\s*(\d+)\s*([mhdw])?\s*$/, 'i')),
                ],
            },
        ),
        fileOrder: new FormControl<string[]>([], {nonNullable: true, validators: [fileOrderListValidator]}),
        enableMetadataFilter: new FormControl<boolean>(true, {nonNullable: true}),
    });
}
