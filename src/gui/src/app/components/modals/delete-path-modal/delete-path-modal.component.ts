import { TitleCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatError, MatFormField, MatInput } from '@angular/material/input';
import { isEqualValidator } from '@app/classes';
import { HintPopoverService } from '@services/hint-popover/hint-popover.service';
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
    private hintPopover = inject(HintPopoverService);


    deletePathForm: FormGroup;
    pathToDeleteDisplayPath: string;
    displayPaths: string[];
    protected readonly PathType = PathType;
    protected readonly DELETE_CONFIRMATION_STRING = DELETE_CONFIRMATION_STRING;

    constructor() {
        const data = this.data;

        const paths = data.pathsToDelete?.length ? data.pathsToDelete : [data.pathToDelete];
        this.displayPaths = paths.map((p) => grpcPathToDisplayPath(p, data.osType));
        this.pathToDeleteDisplayPath = this.displayPaths[0];
        this.deletePathForm = new FormGroup({
            confirmDelete: new FormControl<string>('', [
                Validators.required, isEqualValidator(DELETE_CONFIRMATION_STRING),
            ]),
        });
    }

    get isMulti(): boolean {
        return this.displayPaths.length > 1;
    }

    toggleHint(event: MouseEvent, message: string) {
        event.stopPropagation();
        event.preventDefault();

        this.hintPopover.open(event.currentTarget as HTMLElement, message);
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
