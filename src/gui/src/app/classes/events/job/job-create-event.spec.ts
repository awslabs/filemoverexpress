import { describe, it, expect } from 'vitest';
import { JobCreateEvent } from './job-create-event';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { JobStatus } from '@state/models/job.model';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { JobCreateEventSchema } from '@gen/es/fme/v1/job_pb';
import { EventType } from '@gen/es/fme/v1/events_pb';

const data = {
    id: 'job-id',
    name: 'custom-job-name',
    created: new Date(),
    transferProfile: 'test-profile',
    destination: '/path/to/dest',
    direction: TransferDirection.Upload,
    status: JobStatus.Created,
};

describe('JobCreateEvent', () => {
    it('should create an instance', () => {
        expect(new JobCreateEvent(
            data.id,
            data.name,
            data.created,
            data.transferProfile,
            data.destination,
            data.direction,
            data.status,
        )).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const evt = create(JobCreateEventSchema);
        evt.id = data.id;
        evt.name = data.name;
        evt.created = timestampFromDate(data.created);
        evt.transferProfile = data.transferProfile;
        evt.destination = data.destination;
        evt.direction = data.direction;
        evt.status = data.status;


        pbEvt.eventType = EventType.MESSAGE_EVENT_TYPE;
        pbEvt.event = {
            case: 'jobCreateEvent',
            value: evt,
        };

        expect(JobCreateEvent.fromProtobuf(pbEvt));
    });
});
