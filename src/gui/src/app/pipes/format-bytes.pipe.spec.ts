import { describe, it, expect } from 'vitest';
import { FormatBytesPipe } from './format-bytes.pipe';

describe('FormatBytesPipe', () => {
    it('create an instance', () => {
        const pipe = new FormatBytesPipe();
        expect(pipe).toBeTruthy();
    });
});
