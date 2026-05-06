import { describe, it, expect } from 'vitest';
import { JobUpdateEvent } from './job-update-event';

const data = {
    id: 'random-id',
    name: 'new-job-name',
    oldName: 'old-job-name',
};

describe('JobUpdateEvent', () => {
    it('should create an instance', () => {
        expect(new JobUpdateEvent(
            data.id,
            data.name,
            data.oldName,
        )).toBeTruthy();
    });
});
