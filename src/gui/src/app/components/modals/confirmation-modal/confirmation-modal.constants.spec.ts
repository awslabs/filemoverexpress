import { describe, it, expect } from 'vitest';
import { cancelTransferDialog } from './confirmation-modal.constants';

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
