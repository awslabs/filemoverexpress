import { FormControl, FormGroup } from '@angular/forms';

export type EditorMode = 'add' | 'update';

export interface TransferProfileForm {
    name: FormControl<string>;
    bucket: FormControl<string>;
    region: FormControl<string>;
    profile: FormControl<string>;

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
