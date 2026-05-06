import { describe, it, expect } from 'vitest';
import { BarmodePipe } from './barmode.pipe';

describe('BarmodePipe', () => {
    it('create an instance', () => {
        const pipe = new BarmodePipe();
        expect(pipe).toBeTruthy();
    });
});
