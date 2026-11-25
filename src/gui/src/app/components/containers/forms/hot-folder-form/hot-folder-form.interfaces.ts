import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

export interface HotFolderRemoteConfigFormGroup {
    remoteConfigurationName: AbstractControl<string>;
    s3DestinationFolder: AbstractControl<string>;
}

export interface HotFolderFormGroup {
    name: AbstractControl<string>;
    enabled: AbstractControl<boolean>;
    localSourceFolder: AbstractControl<string>;
    remoteConfigurations: FormArray<FormGroup<HotFolderRemoteConfigFormGroup>>;
    // Not shown in the form. Holds the value from the config file so getRawValue(), which
    // the modal saves, carries it through, and it stays with the folder if it is renamed.
    forceInitialUpload: AbstractControl<boolean>;
}
