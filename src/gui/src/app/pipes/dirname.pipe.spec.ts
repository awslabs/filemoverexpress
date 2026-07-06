import { describe, it, expect } from 'vitest';
import { DirnamePipe } from './dirname.pipe';

describe('DirnamePipe', () => {
    it('create an instance', () => {
        const pipe = new DirnamePipe();
        expect(pipe).toBeTruthy();
    });
});
