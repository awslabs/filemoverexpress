import { MatDialogConfig } from '@angular/material/dialog';
import { ConfirmationModalData } from './confirmation-modal.interfaces';
import { escapeHtml } from '@app/utils/utils';

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


/**
 * Shared config for the "Cancel Transfer" confirmation, used by both the jobs-table
 * row/context menu and the Job Details modal so the wording and buttons stay consistent.
 *
 * "Keep Running" is the safe default (dismiss, Esc maps to it); "Cancel Job" is the
 * destructive action (warn/red). The job name is user-controlled (set via Rename) and the
 * message is rendered with [innerHTML], so it is HTML-escaped here - callers pass the raw
 * name and cannot forget to escape it.
 *
 * @param {string} [jobName] Raw, untrusted job name; omitted falls back to "this job".
 * @returns {MatDialogConfig<ConfirmationModalData>} Dialog config to pass to dialog.open().
 */
export function cancelTransferDialog(jobName?: string): MatDialogConfig<ConfirmationModalData> {
    const name = jobName ? `<b>${escapeHtml(jobName)}</b>` : 'this job';
    return {
        width: '450px',
        data: {
            title: 'Cancel Transfer',
            message: `Are you sure you want to cancel ${name}? Any files still transferring will stop.`,
            cancelText: 'Keep Running',
            cancelType: 'stroked',
            cancelClass: null,
            confirmText: 'Cancel Job',
            confirmType: 'filled',
            confirmClass: 'warn',
        },
    };
}
