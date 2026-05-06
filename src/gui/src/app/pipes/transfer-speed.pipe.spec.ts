import { describe, it, expect } from 'vitest';
import { TransferSpeedPipe } from './transfer-speed.pipe';

describe('TransferSpeedPipe', () => {
    it('create an instance', () => {
        const pipe = new TransferSpeedPipe();
        expect(pipe).toBeTruthy();
    });
});
