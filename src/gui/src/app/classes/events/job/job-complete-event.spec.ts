import { describe, it, expect } from 'vitest';
import { JobCompleteEvent } from './job-complete-event';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

describe('JobCompleteEvent', () => {
    it('should create an instance', () => {
        expect(new JobCompleteEvent('job-id', 'custom-job-name', new Date(), false, true, false)).toBeTruthy();
    });

    it('maps the terminal status from protobuf', () => {
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
                },
            },
        } as unknown as ListEventsResponse);

        expect(evt.status).toBe('COMPLETED_WITH_WARNINGS');
        expect(evt.hasSuccessfulTasks).toBe(true);
    });
});
