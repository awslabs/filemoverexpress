import { TitleCasePipe } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { isNotEmptyString, isNotEqualValidator } from '@app/classes';
import { EnterSubmitDirective } from '@app/directives/enter-submit.directive';
import { HintPopoverService } from '@services/hint-popover/hint-popover.service';
import { RenamePathModalData } from '@app/components/modals/rename-path-modal/rename-path-modal.interfaces';
import { GRPC_PATH_SEPARATOR } from '@app/constants/common.constants';
import { PathType } from '@app/interfaces/paths';
import { FileExtensionPipe } from '@app/pipes/file-extension.pipe';
import { TrimStringPipe } from '@app/pipes/trim-string.pipe';
import { getFileExtension, grpcPathToDisplayPath } from '@app/utils/path-utils';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { NotificationsService } from '@services/notifications/notifications.service';

@Component({
    selector: 'fme-rename-path-modal',
    templateUrl: './rename-path-modal.component.html',
    styleUrls: ['./rename-path-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatDialogTitle,
        TitleCasePipe,
        MatDialogContent,
        MatIcon,
        TrimStringPipe,
        FileExtensionPipe,
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
export class RenamePathModalComponent {
    data = inject<RenamePathModalData>(MAT_DIALOG_DATA);
    private dialogRef = inject<MatDialogRef<RenamePathModalComponent>>(MatDialogRef);
    private notifications = inject(NotificationsService);
    private hintPopover = inject(HintPopoverService);

    renamePathForm: FormControl;
    parentDirectoryGRPCPath: string;
    parentDirectoryDisplayPath: string;
    osPathSeparator: string = GRPC_PATH_SEPARATOR;
    fileExtension: string;
    protected readonly PathType = PathType;

    constructor() {
        const data = this.data;

        this.fileExtension = getFileExtension(this.data.objectToRename);
        this.parentDirectoryGRPCPath = this.data.parentDirectory;
        this.parentDirectoryDisplayPath = grpcPathToDisplayPath(this.data.parentDirectory, this.data.osType);
        if (!this.data.parentDirectory.endsWith(GRPC_PATH_SEPARATOR)) {
            this.parentDirectoryGRPCPath += GRPC_PATH_SEPARATOR;
        }
        if (this.data.osType === 'windows') {
            this.osPathSeparator = '\\';
        }
        if (!this.parentDirectoryGRPCPath.endsWith(GRPC_PATH_SEPARATOR)) {
            this.parentDirectoryGRPCPath += GRPC_PATH_SEPARATOR;
        }
        if (!this.parentDirectoryDisplayPath.endsWith(this.osPathSeparator)) {
            this.parentDirectoryDisplayPath += this.osPathSeparator;
        }
        this.renamePathForm = new FormControl<string>(this.data.objectToRename, [
            Validators.required,
            Validators.pattern('^[^\\/\\\\]+$'),
            isNotEqualValidator(data.objectToRename, true),
            isNotEmptyString,
        ]);
    }

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

    submit() {
        return () => {
            if (this.renamePathForm.invalid) {
                this.notifications.error('Invalid new name');
                return;
            }
            const newPathBaseName = this.renamePathForm.value.trim();
            if (!newPathBaseName) {
                this.notifications.error('New name cannot be empty');
                return;
            }
            let newFullPath = [this.parentDirectoryGRPCPath, newPathBaseName].join('');
            if (this.data.pathType === PathType.FOLDER || this.data.pathType === PathType.S3_PREFIX) {
                if (!newFullPath.endsWith(GRPC_PATH_SEPARATOR)) {
                    newFullPath = newFullPath + GRPC_PATH_SEPARATOR;
                }
            }
            this.dialogRef.close(newFullPath);
        };
    }

    protected shouldShowExtensionRenameWarning(data: RenamePathModalData, ext: string) {
        return this.renamePathForm.valid &&
            (data.pathType === PathType.FILE || data.pathType === PathType.S3_OBJECT)
            && this.fileExtension !== ext;
    }
}
