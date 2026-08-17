import { TitleCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { isAbsolutePathValidator } from '@app/classes';
import { HintsPanelComponent } from '@app/components/layout/hints-panel/hints-panel.component';
import {
    StartingPathType,
} from '@app/components/modals/starting-path-editor-modal/starting-path-editor-modal.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';

@Component({
    selector: 'fme-starting-path-editor-modal',
    templateUrl: './starting-path-editor-modal.component.html',
    styleUrls: ['./starting-path-editor-modal.component.scss'],
    imports: [
        MatDialogTitle,
        TitleCasePipe,
        MatDialogContent,
        MatFormField,
        MatLabel,
        MatInput,
        ReactiveFormsModule,
        MatHint,
        MatError,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class StartingPathEditorModalComponent {
    data = inject(MAT_DIALOG_DATA);
    private dialogRef = inject<MatDialogRef<StartingPathEditorModalComponent, string | null>>(MatDialogRef);
    private bottomSheet = inject(MatBottomSheet);

    startingPath: FormControl;
    configFieldName = '';
    protected readonly StartingPathType = StartingPathType;

    constructor() {
        const data = this.data;

        this.startingPath = new FormControl<string>(data.newStartingPath, isAbsolutePathValidator(data.fileBrowserType));
        this.configFieldName = data.type === StartingPathType.S3 ? 'bucket starting directory' : 'local starting directory';
    }

    /**
     * Show starting path hints
     *
     * @param {MouseEvent} event - Click MouseEvent
     * @param {string} message - Hint message string
     */
    toggleHint(event: MouseEvent, message: string) {
        event.stopPropagation();
        event.preventDefault();

        this.bottomSheet.open(HintsPanelComponent, {
            data: message,
            panelClass: 'bottom-sheet-hints',
        });
    }

    cancel() {
        return () => {
            this.dialogRef.close(null);
        };
    }

    save() {
        return () => {
            this.dialogRef.close(this.startingPath.value?.trim());
        };
    }
}
