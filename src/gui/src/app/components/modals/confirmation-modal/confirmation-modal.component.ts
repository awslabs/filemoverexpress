import { Component, HostListener, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { ConfirmationModalData, ConfirmationModalDataDefaults } from './confirmation-modal.interfaces';

@Component({
    selector: 'fme-confirmation-modal',
    templateUrl: './confirmation-modal.component.html',
    styleUrls: ['./confirmation-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class ConfirmationModalComponent {
    data = inject<Partial<ConfirmationModalData>>(MAT_DIALOG_DATA);
    private mdDialogRef = inject<MatDialogRef<ConfirmationModalComponent>>(MatDialogRef);

    config: ConfirmationModalData;

    constructor() {
        const data = this.data;

        this.config = {
            ...ConfirmationModalDataDefaults,
            ...data,
        };
    }

    close(value: boolean): void {
        this.mdDialogRef.close(value);
    }

    cancel() {
        return () => {
            this.close(false);
        };
    }

    confirm() {
        return () => {
            this.close(true);
        };
    }

    @HostListener('keydown.esc')
    public onEsc(): void {
        this.close(false);
    }
}
