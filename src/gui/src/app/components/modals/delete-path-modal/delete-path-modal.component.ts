import { TitleCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatError, MatFormField, MatInput } from '@angular/material/input';
import { isEqualValidator } from '@app/classes';
import { HintsPanelComponent } from '@app/components/layout/hints-panel/hints-panel.component';
import { DELETE_CONFIRMATION_STRING } from '@app/components/modals/delete-path-modal/delete-path-modal.constants';
import { DeletePathModalData } from '@app/components/modals/delete-path-modal/delete-path-modal.interfaces';
import { PathType } from '@app/interfaces/paths';
import { grpcPathToDisplayPath } from '@app/utils/path-utils';
import { ButtonComponent } from '@primitives/buttons/button/button.component';

@Component({
    selector: 'fme-delete-path-modal',
    templateUrl: './delete-path-modal.component.html',
    styleUrls: ['./delete-path-modal.component.scss'],
    imports: [
        MatDialogTitle,
        TitleCasePipe,
        MatDialogContent,
        MatIcon,
        ReactiveFormsModule,
        MatFormField,
        MatInput,
        MatError,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class DeletePathModalComponent {
    data = inject<DeletePathModalData>(MAT_DIALOG_DATA);
    dialogRef = inject<MatDialogRef<DeletePathModalComponent>>(MatDialogRef);
    private bottomSheet = inject(MatBottomSheet);


    deletePathForm: FormGroup;
    pathToDeleteDisplayPath: string;
    protected readonly PathType = PathType;
    protected readonly DELETE_CONFIRMATION_STRING = DELETE_CONFIRMATION_STRING;

    constructor() {
        const data = this.data;

        this.pathToDeleteDisplayPath = grpcPathToDisplayPath(data.pathToDelete, data.osType);
        this.deletePathForm = new FormGroup({
            confirmDelete: new FormControl<string>('', [
                Validators.required, isEqualValidator(DELETE_CONFIRMATION_STRING),
            ]),
        });
    }

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
            this.dialogRef.close(false);
        };
    }

    submit() {
        return () => {
            this.dialogRef.close(true);
        };
    }
}
