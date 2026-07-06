import { describe, it, expect } from 'vitest';
import { calculateTimeToCompletion } from '@classes/time-to-completion';

describe('calculateTimeToCompletion', () => {
    it('', () => {
        expect(calculateTimeToCompletion('2024-03-07 13:56:32', 1000000, 245000)).toBeTruthy();
        expect(calculateTimeToCompletion(new Date('2024-03-07 13:56:32'), 1000000, 245000)).toBeTruthy();
        expect(
            calculateTimeToCompletion(
                new Date(Date.now() - 1000),
                1000000,
                999999,
            ),
        ).toEqual('Just now');
        expect(calculateTimeToCompletion(new Date(), 10000, 10000)).toBe('Unknown');
    });
});
