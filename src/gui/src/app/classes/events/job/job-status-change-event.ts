import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { stringToJobStatus } from '@app/utils/job-utils';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { JobStatusChangeEvent as ProtoJobStatusChangeEvent } from '@gen/es/fme/v1/job_pb';
import { JobStatus } from '@state/models/job.model';

export class JobStatusChangeEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(
        public id: string,
        public status: JobStatus,
        public timestamp: Date,
    ) {
    }

    get logMessage(): string {
        return `Job changed status to ${this.status}`;
    }

    static fromProtobuf(event: ListEventsResponse): JobStatusChangeEvent {
        const evt = event.event.value as ProtoJobStatusChangeEvent;

        return new JobStatusChangeEvent(
            evt.jobId,
            stringToJobStatus(evt.status),
            evt.timestamp ? timestampDate(evt.timestamp) : new Date(),
        );
    }
}
