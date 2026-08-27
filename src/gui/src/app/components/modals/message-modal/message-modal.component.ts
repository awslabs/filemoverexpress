import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MessageModalData } from '@app/components/modals/message-modal/message-modal.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';

const MODAL_DATA_DEFAULTS: MessageModalData = {
    message: '',
    title: '',
    buttonText: 'OK',
};

@Component({
    selector: 'fme-message-modal',
    templateUrl: './message-modal.component.html',
    styleUrls: ['./message-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class MessageModalComponent {
    private dialogRef = inject<MatDialogRef<MessageModalComponent>>(MatDialogRef);
    config: MessageModalData;

    constructor() {
        const data = inject<Partial<MessageModalData>>(MAT_DIALOG_DATA);

        this.config = {
            ...MODAL_DATA_DEFAULTS,
            ...data,
        };
    }

    close() {
        this.dialogRef.close();
    }
}
