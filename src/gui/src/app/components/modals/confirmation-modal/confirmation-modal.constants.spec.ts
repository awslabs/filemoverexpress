import { describe, it, expect } from 'vitest';
import { cancelTransferDialog, verificationGateDialog } from './confirmation-modal.constants';

describe('[confirmation-modal.constants] cancelTransferDialog', () => {
    it('sets the Cancel Transfer title and Keep Running / Cancel Job buttons', () => {
        const cfg = cancelTransferDialog('Nightly backup').data!;
        expect(cfg.title).toBe('Cancel Transfer');
        expect(cfg.cancelText).toBe('Keep Running');
        expect(cfg.confirmText).toBe('Cancel Job');
        expect(cfg.confirmClass).toBe('warn');
    });

    it('embeds a plain job name in bold', () => {
        const cfg = cancelTransferDialog('Nightly backup').data!;
        expect(cfg.message).toContain('<b>Nightly backup</b>');
    });

    it('escapes a malicious job name so it cannot inject markup', () => {
        const cfg = cancelTransferDialog("<script>alert('x')</script>").data!;
        expect(cfg.message).not.toContain('<script>');
        expect(cfg.message).toContain('&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
    });

    it('falls back to "this job" when no name is given', () => {
        expect(cancelTransferDialog().data!.message).toContain('cancel this job?');
        expect(cancelTransferDialog('').data!.message).toContain('cancel this job?');
    });
});

describe('[confirmation-modal.constants] verificationGateDialog', () => {
    it('summarizes the counts, algorithm, and acknowledgement gate', () => {
        const cfg = verificationGateDialog(2, 1, 3, 'xxhash64').data!;
        expect(cfg.title).toBe('Verification failed - review before upload');
        expect(cfg.message).toContain('2 of 3 file(s) failed ASC MHL verification (xxhash64), 1 verified');
        expect(cfg.cancelText).toBe('Stop');
        expect(cfg.confirmText).toBe('Upload anyway');
        expect(cfg.acknowledgeText).toBeTruthy();
    });

    it('lists the failing files when provided', () => {
        const cfg = verificationGateDialog(2, 1, 3, 'xxhash64',
            ['F003MN99_AVID.ale (hash mismatch)', 'F003MN99_BIN.bin (missing on disk)']).data!;
        expect(cfg.message).toContain('Files that failed:');
        expect(cfg.message).toContain('<li>F003MN99_AVID.ale (hash mismatch)</li>');
        expect(cfg.message).toContain('<li>F003MN99_BIN.bin (missing on disk)</li>');
    });

    it('omits the list when there are no named failures', () => {
        expect(verificationGateDialog(0, 0, 0).data!.message).not.toContain('Files that failed:');
    });

    it('escapes a malicious file name in the list', () => {
        const cfg = verificationGateDialog(1, 0, 1, 'xxhash64', ['<img src=x onerror=alert(1)> (hash mismatch)']).data!;
        expect(cfg.message).not.toContain('<img src=x');
        expect(cfg.message).toContain('&lt;img src=x');
    });

    it('caps a long list and shows a remainder count', () => {
        const failures = Array.from({length: 20}, (_, i) => `file-${i}.mov (hash mismatch)`);
        const cfg = verificationGateDialog(20, 0, 20, 'xxhash64', failures).data!;
        expect(cfg.message).toContain('and 5 more');
    });
});
