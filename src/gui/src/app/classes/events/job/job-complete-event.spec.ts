import { describe, it, expect } from 'vitest';
import { JobCompleteEvent } from './job-complete-event';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

describe('JobCompleteEvent', () => {
    it('should create an instance', () => {
        expect(new JobCompleteEvent('job-id', 'custom-job-name', new Date(), false, true, false)).toBeTruthy();
    });

    it('maps the terminal status and ASC MHL result from protobuf', () => {
        const evt = JobCompleteEvent.fromProtobuf({
            event: {
                value: {
                    id: 'job-id',
                    name: 'custom-job-name',
                    completed: undefined,
                    hasTaskErrors: false,
                    hasSuccessfulTasks: true,
                    hasAllSkippedTasks: false,
                    status: 'COMPLETED_WITH_WARNINGS',
                    ascMhlVerified: 1,
                    ascMhlListed: 3,
                    ascMhlProblems: 2,
                    ascMhlAlgorithm: 'xxhash64',
                },
            },
        } as unknown as ListEventsResponse);

        expect(evt.status).toBe('COMPLETED_WITH_WARNINGS');
        expect(evt.hasSuccessfulTasks).toBe(true);
        expect(evt.ascMhlProblems).toBe(2);
        expect(evt.ascMhlVerified).toBe(1);
        expect(evt.ascMhlListed).toBe(3);
        expect(evt.ascMhlAlgorithm).toBe('xxhash64');
    });
});
