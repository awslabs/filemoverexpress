import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { HotFolderFormGroup } from '@containers/forms/hot-folder-form/hot-folder-form.interfaces';
import { TransferProfile } from '@app/classes';

export interface ConfigFormGeneralGroup {
    noSleep: FormControl<boolean>;
    retryCount: FormControl<number>;
    maxActiveTransfers: FormControl<number>;
    autoMaxActiveTransfers: FormControl<boolean>;
    maxActiveChecksums: FormControl<number>;
    targetBandwidth: FormControl<number>;
}

export interface ConfigFormLoggingGroup {
    compress: FormControl<boolean>;
    directory: FormControl<string>;
    maxAge: FormControl<number>;
    maxSize: FormControl<number>;
    severity: FormControl<string>;
}

export interface ConfigFormReportsGroup {
    directory: FormControl<string>;
}

export interface ConfigFormS3Group {
    transferProfiles: FormControl<Record<string, TransferProfile>>;
}

export interface ConfigFormProtocolsGroup {
    s3: FormGroup<ConfigFormS3Group>;
}

export interface ConfigFormGroup {
    general: FormGroup<ConfigFormGeneralGroup>;
    logging: FormGroup<ConfigFormLoggingGroup>;
    reports: FormGroup<ConfigFormReportsGroup>;
    protocols: FormGroup<ConfigFormProtocolsGroup>;
    uploadHotFolders: FormArray<FormGroup<HotFolderFormGroup>>;
}
