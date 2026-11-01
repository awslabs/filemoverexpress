import { FormControl, FormGroup } from '@angular/forms';

export type EditorMode = 'add' | 'update';
export type AuthMethodType = 'aws-profile' | 'oidc' | 'access-key';

export interface TransferProfileForm {
    name: FormControl<string>;
    bucket: FormControl<string>;
    region: FormControl<string>;
    profile: FormControl<string>;

    // authentication method
    authMethod: FormControl<AuthMethodType>;

    // Access-key settings (visible when authMethod === 'access-key').
    // accessKeyId is persisted (non-secret). secretAccessKey is write-only: it is sent to the
    // daemon via a dedicated RPC, never persisted in the config, and never returned on read, so
    // it is NOT a property of the TransferProfile class.
    accessKeyId: FormControl<string>;
    secretAccessKey: FormControl<string>;
    // sessionToken is optional and write-only (same handling as the secret): set only for
    // temporary credentials that can only be vended with a session token.
    sessionToken: FormControl<string>;

    // OIDC settings (visible when authMethod === 'oidc')
    oidcIssuerUrl: FormControl<string>;
    oidcClientId: FormControl<string>;
    oidcRoleArn: FormControl<string>;
    oidcScopes: FormControl<string>;
    oidcSessionDurationSeconds: FormControl<number>;
    oidcPersistSession: FormControl<boolean>;
    oidcCustomCaBundle: FormControl<string>;

    // advanced settings
    accelerated: FormControl<boolean>;
    storageClass: FormControl<string>;
    checksums: FormGroup<{
        enabled: FormControl<boolean>;
        algorithm: FormControl<string>;
    }>;
    paths: FormGroup<{
        local: FormControl<string>;
        remote: FormControl<string>;
    }>;
    endpoint: FormControl<string>;

    // performance settings
    autoTuning: FormControl<boolean>;
    chunkSize: FormControl<number>;
    threads: FormControl<number>;

    // filter and sort settings
    filter: FormControl<string>;
    maxAge: FormControl<string>;
    fileOrder: FormControl<string[]>;
    enableMetadataFilter: FormControl<boolean>;
}

export interface StorageClass {
    key: string;
    value: string;
}

export interface ChecksumAlgorithm {
    value: string,
    viewValue: string,
}
