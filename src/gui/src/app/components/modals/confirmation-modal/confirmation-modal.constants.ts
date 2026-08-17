import { MatDialogConfig } from '@angular/material/dialog';
import { ConfirmationModalData } from './confirmation-modal.interfaces';

/**
 * Shared config for the "Discard Unsaved Changes?" prompt, used by both the Settings
 * route CanDeactivate guard and the Settings dialog's Cancel handler so the wording
 * stays consistent.
 *
 * "Keep Editing" is the primary/safe default (filled) and is what Esc maps to (cancel
 * closes false = stay); "Discard" is the secondary, destructive action (stroked). The
 * .discard-changes-dialog panelClass reverses the visual order so "Keep Editing" sits
 * on the right as the default and "Discard" on the left.
 */
export const discardUnsavedChangesDialog: MatDialogConfig<ConfirmationModalData> = {
    width: '50%',
    panelClass: 'discard-changes-dialog',
    data: {
        cancelText: 'Keep Editing',
        cancelType: 'filled',
        cancelClass: 'primary',
        confirmText: 'Discard',
        confirmType: 'stroked',
        confirmClass: null,
        message: 'You have unsaved changes. If you leave, your changes will be lost.',
        title: 'Discard Unsaved Changes?',
    },
};
