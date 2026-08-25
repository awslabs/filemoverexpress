import { TitleCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { isAbsolutePathValidator } from '@app/classes';
import { HintPopoverService } from '@services/hint-popover/hint-popover.service';
import {
    StartingPathType,
} from '@app/components/modals/starting-path-editor-modal/starting-path-editor-modal.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { EnterSubmitDirective } from '@app/directives/enter-submit.directive';

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
        EnterSubmitDirective,
    ],
})
export class StartingPathEditorModalComponent {
    data = inject(MAT_DIALOG_DATA);
    private dialogRef = inject<MatDialogRef<StartingPathEditorModalComponent, string | null>>(MatDialogRef);
    private hintPopover = inject(HintPopoverService);

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

        this.hintPopover.open(event.currentTarget as HTMLElement, message);
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
