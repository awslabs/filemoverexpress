import { FormControl } from '@angular/forms';

export interface BucketReportForm {
    remoteConfiguration: FormControl<string>;
    format: FormControl<string>;
    includeChecksums: FormControl<boolean>;
}

