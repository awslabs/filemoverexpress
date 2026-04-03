import { JobCompleteEvent } from './job-complete-event';

describe('JobCompleteEvent', () => {
    it('should create an instance', () => {
        expect(new JobCompleteEvent('job-id', 'custom-job-name', new Date(), false, true, false)).toBeTruthy();
    });
});
