import { Component, HostListener, inject, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { EnterSubmitDirective } from '@app/directives/enter-submit.directive';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { ConfirmationModalData, ConfirmationModalDataDefaults } from './confirmation-modal.interfaces';

@Component({
    selector: 'fme-confirmation-modal',
    templateUrl: './confirmation-modal.component.html',
    styleUrls: ['./confirmation-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatCheckboxModule,
        FormsModule,
        ButtonComponent,
        EnterSubmitDirective,
    ],
})
export class ConfirmationModalComponent {
    data = inject<Partial<ConfirmationModalData>>(MAT_DIALOG_DATA);
    private mdDialogRef = inject<MatDialogRef<ConfirmationModalComponent>>(MatDialogRef);

    config: ConfirmationModalData;

    /**
     * Checked state of the optional acknowledgement checkbox, shown only when
     * config.acknowledgeText is set. Confirm stays disabled until this is true.
     */
    acknowledged = false;

    constructor() {
        const data = this.data;

        this.config = {
            ...ConfirmationModalDataDefaults,
            ...data,
        };
    }

    /**
     * Confirm is blocked only while an acknowledgement is required and unchecked.
     * Dialogs without acknowledgeText are never blocked.
     * @returns {boolean} True when the confirm action is blocked, else false.
     */
    get confirmDisabled(): boolean {
        return !!this.config.acknowledgeText && !this.acknowledged;
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
            if (this.confirmDisabled) {
                return;
            }
            this.close(true);
        };
    }

    @HostListener('keydown.esc')
    public onEsc(): void {
        this.close(false);
    }
}
