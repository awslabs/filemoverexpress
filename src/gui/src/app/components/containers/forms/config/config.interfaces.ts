import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { TransferProfileForm } from '@containers/forms/transfer-profile-form/transfer-profile-form.interfaces';
import { HotFolderFormGroup } from '@containers/forms/hot-folder-form/hot-folder-form.interfaces';

export interface ConfigFormGeneralGroup {
    noSleep: FormControl<boolean>;
    retryCount: FormControl<number>;
    maxActiveTransfers: FormControl<number>;
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

export interface ConfigFormApiServerPermissionsGroup {
    allowUiConfiguration: FormControl<boolean>;
    allowLocalRenameDelete: FormControl<boolean>;
    allowRemoteRenameDelete: FormControl<boolean>;
}

export interface ConfigFormApiServerTLSGroup {
    enabled: FormControl<boolean>;
    certificateFile: FormControl<string>;
    keyFile: FormControl<string>;
}

export interface ConfigFormApiServerRemoteGroup {
    enabled: FormControl<boolean>;
    preSharedKey: FormControl<string>;
    address: FormControl<string>;
    ports: FormControl<number[]>;
}

export interface ConfigFormApiServerGroup {
    enabled: FormControl<boolean>;
    permissions: FormGroup<ConfigFormApiServerPermissionsGroup>;
    tls: FormGroup<ConfigFormApiServerTLSGroup>;
    blockedPaths: FormControl<string[]>;
    remote: FormGroup<ConfigFormApiServerRemoteGroup>;
    allowedOrigins: FormControl<string[]>;
}

export interface ConfigFormS3Group {
    transferProfiles: FormControl<Record<string, TransferProfileForm>>;
}

export interface ConfigFormProtocolsGroup {
    s3: FormGroup<ConfigFormS3Group>;
}

export interface ConfigFormGroup {
    general: FormGroup<ConfigFormGeneralGroup>;
    logging: FormGroup<ConfigFormLoggingGroup>;
    reports: FormGroup<ConfigFormReportsGroup>;
    apiServer: FormGroup<ConfigFormApiServerGroup>;
    protocols: FormGroup<ConfigFormProtocolsGroup>;
    uploadHotFolders: FormArray<FormGroup<HotFolderFormGroup>>;
}
