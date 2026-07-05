import { describe, it, expect } from 'vitest';
import { TimeToCompletionPipe } from './time-to-completion.pipe';

describe('TimetoCompletionPipe', () => {
    it('create an instance', () => {
        const pipe = new TimeToCompletionPipe();
        expect(pipe).toBeTruthy();
    });
});
