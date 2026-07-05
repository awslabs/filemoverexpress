import { describe, it, expect } from 'vitest';
import { TaskCompleteEvent } from './task-complete-event';
import { TransferDirection } from '@app/interfaces/jobs-table';

const data = {
    id: 'random-id',
    direction: TransferDirection.Download,
    destination: 'destination/path',
};

describe('TaskCompleteEvent', () => {
    it('should create an instance', () => {
        expect(new TaskCompleteEvent(
            data.id,
            data.direction,
            data.destination,
        )).toBeTruthy();
    });
});
