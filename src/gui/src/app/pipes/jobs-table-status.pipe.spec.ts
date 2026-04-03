import { JobStatusPipe } from './jobs-table-status.pipe';

describe('JobsTableStatusPipe', () => {
    it('create an instance', () => {
        const pipe = new JobStatusPipe();
        expect(pipe).toBeTruthy();
    });
});
