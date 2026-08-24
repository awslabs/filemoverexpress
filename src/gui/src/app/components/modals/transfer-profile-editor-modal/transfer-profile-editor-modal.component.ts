import { TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { TransferProfile } from '@app/classes/config';
import { TransferProfileFormComponent } from '@containers/forms/transfer-profile-form/transfer-profile-form.component';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { TransferProfileEditorModalData } from './transfer-profile-editor-modal.interfaces';

@Component({
    selector: 'fme-transfer-profile-editor-modal',
    templateUrl: './transfer-profile-editor-modal.component.html',
    styleUrls: ['./transfer-profile-editor-modal.component.scss'],
    imports: [
        MatDialogTitle,
        TitleCasePipe,
        MatDialogContent,
        TransferProfileFormComponent,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class TransferProfileEditorModalComponent {
    data = inject<TransferProfileEditorModalData>(MAT_DIALOG_DATA);
    dialogRef = inject<MatDialogRef<TransferProfileEditorModalComponent>>(MatDialogRef);
    private txpService = inject(TransferProfileService);

    @Output() transferProfileSaved = new EventEmitter<TransferProfile>();
    transferProfile: TransferProfile | null;
    transferProfileForm: FormGroup = new FormGroup({});

    constructor() {
        const data = this.data;

        this.transferProfile = data.transferProfile ? data.transferProfile : null;
    }

    updateTransferProfileForm(transferProfileForm: FormGroup) {
        this.transferProfileForm = transferProfileForm;
    }

    cancel() {
        return () => {
            this.dialogRef.close();
        };
    }

    save() {
        return () => {
            const txProfile = TransferProfile.fromJson(this.transferProfileForm.getRawValue());
            this.transferProfileSaved.emit(txProfile);
            this.dialogRef.close();
        };
    }

    delete() {
        return () => {
            if (!this.transferProfile) {
                return;
            }
            // Reuse the shared delete + confirmation flow. Only close the editor once the
            // user actually confirms the deletion (afterClosed emits true on confirm).
            this.txpService.delete(this.transferProfile.name).subscribe((confirmed) => {
                if (confirmed) {
                    this.dialogRef.close();
                }
            });
        };
    }
}
