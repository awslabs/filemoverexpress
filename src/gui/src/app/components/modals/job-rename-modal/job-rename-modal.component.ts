import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { JobRenameModalData } from '@app/components/modals/job-rename-modal/job-rename-modal.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';

@Component({
    selector: 'fme-job-rename-modal',
    templateUrl: './job-rename-modal.component.html',
    styleUrls: ['./job-rename-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatFormField,
        MatLabel,
        MatInput,
        ReactiveFormsModule,
        MatError,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class JobRenameModalComponent {
    data = inject<JobRenameModalData>(MAT_DIALOG_DATA);
    private dialogRef = inject<MatDialogRef<JobRenameModalComponent, JobRenameModalData>>(MatDialogRef);

    jobName: FormControl;

    constructor() {
        const data = this.data;

        this.jobName = new FormControl<string>(data.jobName, Validators.required);
    }

    cancel() {
        return () => {
            this.dialogRef.close();
        };
    }

    save() {
        return () => {
            if (this.jobName.invalid) {
                return;
            }

            this.dialogRef.close(
                {
                    jobName: this.jobName.value,
                },
            );
        };
    }
}
