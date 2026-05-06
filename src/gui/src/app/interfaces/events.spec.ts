import { describe, it, expect } from 'vitest';
import { EventLogLevel, normalizeLogLevel } from './events';

describe('normalizeLogLevel', () => {
    it('maps daemon "warn" to the canonical Warning level (issue #25)', () => {
        expect(normalizeLogLevel('warn')).toBe(EventLogLevel.Warning);
        expect(normalizeLogLevel('warning')).toBe(EventLogLevel.Warning);
    });

    it('maps "panic" and "fatal" to Fatal', () => {
        expect(normalizeLogLevel('panic')).toBe(EventLogLevel.Fatal);
        expect(normalizeLogLevel('fatal')).toBe(EventLogLevel.Fatal);
    });

    it('maps the straightforward levels', () => {
        expect(normalizeLogLevel('trace')).toBe(EventLogLevel.Trace);
        expect(normalizeLogLevel('debug')).toBe(EventLogLevel.Debug);
        expect(normalizeLogLevel('info')).toBe(EventLogLevel.Info);
        expect(normalizeLogLevel('error')).toBe(EventLogLevel.Error);
    });

    it('is case-insensitive', () => {
        expect(normalizeLogLevel('WARN')).toBe(EventLogLevel.Warning);
        expect(normalizeLogLevel('Error')).toBe(EventLogLevel.Error);
    });

    it('treats success/default/unknown/empty as Info', () => {
        expect(normalizeLogLevel('success')).toBe(EventLogLevel.Info);
        expect(normalizeLogLevel('default')).toBe(EventLogLevel.Info);
        expect(normalizeLogLevel('something-else')).toBe(EventLogLevel.Info);
        expect(normalizeLogLevel('')).toBe(EventLogLevel.Info);
    });
});
