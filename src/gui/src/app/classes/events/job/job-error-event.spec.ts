import { JobErrorEvent } from './job-error-event';

describe('JobErrorEvent', () => {
    it('should create an instance', () => {
        expect(new JobErrorEvent(
            'job-id',
            'custom-job-name',
            new Date(),
            'Something bad happened',
        )).toBeTruthy();
    });
});
