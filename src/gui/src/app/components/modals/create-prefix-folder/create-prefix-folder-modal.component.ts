import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { EnterSubmitDirective } from '@app/directives/enter-submit.directive';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { NotificationsService } from '@services/notifications/notifications.service';
import { CreatePrefixFolderData, CreatePrefixFolderType } from './create-prefix-folder-modal.interfaces';

const SEPARATOR = '/';

@Component({
    selector: 'fme-create-prefix-folder-modal',
    templateUrl: './create-prefix-folder-modal.component.html',
    styleUrls: ['./create-prefix-folder-modal.component.scss'],
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
        EnterSubmitDirective,
    ],
})
export class CreatePrefixFolderModalComponent {
    data = inject<CreatePrefixFolderData>(MAT_DIALOG_DATA);
    private dialogRef = inject<MatDialogRef<CreatePrefixFolderModalComponent, string | null>>(MatDialogRef);
    private notifications = inject(NotificationsService);

    private parent: string;
    protected readonly CreatePrefixFolderType = CreatePrefixFolderType;
    folder = new FormControl<string>('', {
        validators: [Validators.required, Validators.pattern('^[^\\/\\\\]+$')],
    });

    constructor() {
        const data = this.data;

        if (!data.parent.endsWith(SEPARATOR)) {
            this.parent = data.parent + SEPARATOR;
        } else {
            this.parent = data.parent;
        }
    }

    cancel() {
        return () => {
            this.dialogRef.close(null);
        };
    }

    save() {
        return () => {
            if (this.folder.invalid) {
                this.notifications.error('Invalid folder name');
                return;
            }

            const newFolder = this.folder.value?.trim();
            if (!newFolder) {
                this.notifications.error('Folder name cannot be empty');
            }

            let newPath = [this.parent, newFolder].join('');
            if (this.data.type === CreatePrefixFolderType.S3) {
                if (!newPath.endsWith(SEPARATOR)) {
                    newPath = newPath + SEPARATOR;
                }
            }
            this.dialogRef.close(newPath);
        };
    }
}
