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
                    ascMhl: {verified: 1, listed: 3, problems: 2, algorithm: 'xxhash64', failures: []},
                },
            },
        } as unknown as ListEventsResponse);

        expect(evt.status).toBe('COMPLETED_WITH_WARNINGS');
        expect(evt.hasSuccessfulTasks).toBe(true);
        expect(evt.ascMhl?.problems).toBe(2);
        expect(evt.ascMhl?.verified).toBe(1);
        expect(evt.ascMhl?.listed).toBe(3);
        expect(evt.ascMhl?.algorithm).toBe('xxhash64');
    });

    it('leaves ascMhl undefined when the event carried no manifest payload', () => {
        const evt = JobCompleteEvent.fromProtobuf({
            event: {
                value: {
                    id: 'job-id', name: 'n', completed: undefined,
                    hasTaskErrors: false, hasSuccessfulTasks: true, hasAllSkippedTasks: false,
                    status: 'COMPLETED', ascMhl: undefined,
                },
            },
        } as unknown as ListEventsResponse);

        expect(evt.ascMhl).toBeUndefined();
    });
});
