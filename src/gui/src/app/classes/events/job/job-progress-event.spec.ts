import { describe, it, expect } from 'vitest';
import { JobProgressEvent } from './job-progress-event';

describe('JobProgressEvent', () => {
    it('should create an instance', () => {
        expect(new JobProgressEvent(
            'job-id',
            'custom-job-name',
            1234,
            2468,
        )).toBeTruthy();
    });
});
