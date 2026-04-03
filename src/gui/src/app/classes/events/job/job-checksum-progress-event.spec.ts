import { JobChecksumProgressEvent } from '@events/job/job-checksum-progress-event';
import { create } from '@bufbuild/protobuf';
import { JobChecksumProgressEventSchema } from '@gen/es/fme/v1/job_pb';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { EventType } from '@gen/es/fme/v1/events_pb';

const data = {
    jobId: 'test-job-id',
    total: 163,
    completed: 78,
};

describe('JobChecksumProgressEvent', () => {
    it('should create an instance', () => {
        const evt = new JobChecksumProgressEvent(
            data.jobId,
            data.total,
            data.completed,
        );

        expect(evt).toBeInstanceOf(JobChecksumProgressEvent);
        expect(evt.jobId).toEqual(data.jobId);
        expect(evt.total).toEqual(data.total);
        expect(evt.completed).toEqual(data.completed);
    });

    it('should convert from protobuf', () => {
        const jcpe = create(JobChecksumProgressEventSchema);
        jcpe.jobId = data.jobId;
        jcpe.total = data.total;
        jcpe.completed = data.completed;

        const ler = create(ListEventsResponseSchema);
        ler.eventType = EventType.JOB_CHECKSUM_PROGRESS_EVENT;
        ler.event = {
            case: 'jobChecksumProgressEvent',
            value: jcpe,
        };

        const evt = JobChecksumProgressEvent.fromProtobuf(ler);

        expect(evt).toBeInstanceOf(JobChecksumProgressEvent);
        expect(evt.jobId).toEqual(data.jobId);
        expect(evt.total).toEqual(data.total);
        expect(evt.completed).toEqual(data.completed);
    });
});
