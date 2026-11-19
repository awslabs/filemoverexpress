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
/**
 * Shared config for the "Resubmit this job?" prompt, used by the jobs table and the
 * job-details modal so the wording stays consistent. Resubmitting re-runs the whole
 * transfer from scratch, so it is a deliberate action worth confirming (especially
 * for a job that completed with verification warnings, where the source may be the
 * thing that needs attention first).
 *
 * "Cancel" is the safe default (filled) and is what Esc maps to; "Resubmit" is the
 * action (stroked).
 */
export const resubmitJobDialog: MatDialogConfig<ConfirmationModalData> = {
    width: '480px',
    data: {
        cancelText: 'Cancel',
        cancelType: 'filled',
        cancelClass: 'primary',
        confirmText: 'Resubmit',
        confirmType: 'stroked',
        confirmClass: null,
        message: 'This re-runs the entire transfer from the beginning. If the job completed '
            + 'with warnings, check the source files named in the logs first - resubmitting '
            + 'will not fix a corrupt or missing source.',
        title: 'Resubmit this job?',
    },
};

/**
 * Shared config for the pre-upload ASC MHL verification gate, raised when a job
 * enters NEEDS_REVIEW because a supplied manifest failed verification before any
 * upload started. "Stop" is the safe default (filled, primary, Esc maps to it)
 * and resolves the gate to cancel; "Upload anyway" is the deliberate override
 * (stroked, warn) gated behind an acknowledgement checkbox. The counts summarize
 * what failed. All text is plain ASCII.
 *
 * @param {number} problems Number of ASC MHL integrity problems found.
 * @param {number} verified Number of listed files that matched their hash.
 * @param {number} listed Number of files the manifest(s) listed.
 * @param {string} [algorithm] Hash algorithm used (e.g. "xxhash64").
 * @returns {MatDialogConfig<ConfirmationModalData>} Dialog config for dialog.open().
 */
export function verificationGateDialog(
    problems: number,
    verified: number,
    listed: number,
    algorithm?: string,
): MatDialogConfig<ConfirmationModalData> {
    const algo = algorithm ? ` (${escapeHtml(algorithm)})` : '';
    return {
        width: '520px',
        disableClose: true,
        data: {
            title: 'Verification failed - review before upload',
            message: `${problems} of ${listed} file(s) failed ASC MHL verification${algo}, `
                + `${verified} verified. Uploading now sends files that do not match the `
                + 'supplied manifest. Check the files named in the logs first - the source '
                + 'may be corrupt or incomplete. Nothing has been uploaded yet.',
            cancelText: 'Stop',
            cancelType: 'filled',
            cancelClass: 'primary',
            confirmText: 'Upload anyway',
            confirmType: 'stroked',
            confirmClass: 'warn',
            acknowledgeText: 'I understand these files failed ASC MHL verification '
                + 'and want to upload them anyway.',
        },
    };
}
