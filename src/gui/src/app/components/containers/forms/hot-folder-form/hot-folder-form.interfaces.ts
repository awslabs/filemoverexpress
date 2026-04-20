import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

export interface HotFolderData {
    localSourcePath?: string;
    s3DestinationPath?: string;
    remoteConfiguration?: string;
}

export interface HotFolderRemoteConfigFormGroup {
    remoteConfigurationName: AbstractControl<string>;
    s3DestinationFolder: AbstractControl<string>;
}

export interface HotFolderFormGroup {
    name: AbstractControl<string>;
    enabled: AbstractControl<boolean>;
    localSourceFolder: AbstractControl<string>;
    remoteConfigurations: FormArray<FormGroup<HotFolderRemoteConfigFormGroup>>;
}
