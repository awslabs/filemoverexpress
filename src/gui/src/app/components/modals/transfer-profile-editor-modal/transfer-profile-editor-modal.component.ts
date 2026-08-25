import { TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, inject, OnDestroy, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { TransferProfile } from '@app/classes/config';
import { EnterSubmitDirective } from '@app/directives/enter-submit.directive';
import { TransferProfileFormComponent } from '@containers/forms/transfer-profile-form/transfer-profile-form.component';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { Subscription } from 'rxjs';
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
        EnterSubmitDirective,
    ],
})
export class TransferProfileEditorModalComponent implements OnDestroy {
    data = inject<TransferProfileEditorModalData>(MAT_DIALOG_DATA);
    dialogRef = inject<MatDialogRef<TransferProfileEditorModalComponent>>(MatDialogRef);
    private txpService = inject(TransferProfileService);

    @Output() transferProfileSaved = new EventEmitter<TransferProfile>();
    transferProfile: TransferProfile | null;
    transferProfileForm: FormGroup = new FormGroup({});

    /**
     * Cached form validity, bound to the Enter-submit directive's [enterSubmitDisabled].
     * Read from a plain field (updated via statusChanges) rather than
     * `transferProfileForm.invalid` directly, because this form carries an async OIDC
     * validator whose status flips mid-change-detection — binding `.invalid` directly
     * trips NG0100 (ExpressionChangedAfterItHasBeenChecked). A cached field is stable
     * within a change-detection pass.
     */
    protected formInvalid = true;
    private formStatusSub?: Subscription;

    constructor() {
        const data = this.data;

        this.transferProfile = data.transferProfile ? data.transferProfile : null;
    }

    ngOnDestroy() {
        this.formStatusSub?.unsubscribe();
    }

    updateTransferProfileForm(transferProfileForm: FormGroup) {
        this.transferProfileForm = transferProfileForm;
        this.formStatusSub?.unsubscribe();
        this.formInvalid = transferProfileForm.invalid;
        this.formStatusSub = transferProfileForm.statusChanges.subscribe(() => {
            this.formInvalid = transferProfileForm.invalid;
        });
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
