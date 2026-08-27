import { KeyValuePipe } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { EnterSubmitDirective } from '@app/directives/enter-submit.directive';
import { ButtonComponent } from '@primitives/buttons/button/button.component';

@Component({
    selector: 'fme-export-job-modal',
    templateUrl: './export-job-modal.component.html',
    styleUrls: ['./export-job-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatFormField,
        MatLabel,
        MatSelect,
        ReactiveFormsModule,
        MatOption,
        KeyValuePipe,
        MatDialogActions,
        ButtonComponent,
        EnterSubmitDirective,
    ],
})
export class ExportJobModalComponent {
    private dialogRef = inject<MatDialogRef<ExportJobModalComponent>>(MatDialogRef);

    outputFormats = {
        'JSON': 'json',
        'XLSX': 'xlsx',
        'CSV': 'csv',
    };
    outputFormat = new FormControl<string>('json', Validators.required);

    close() {
        return () => {
            this.dialogRef.close(null);
        };
    }

    submit() {
        return () => this.dialogRef.close(this.outputFormat.value);
    }
}
