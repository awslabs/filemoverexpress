import { describe, it, expect } from 'vitest';
import { TextEllipsesPipe } from './text-ellipses.pipe';

describe('TextEllipsesPipe', () => {
    it('create an instance', () => {
        const pipe = new TextEllipsesPipe();
        expect(pipe).toBeTruthy();
    });
});
