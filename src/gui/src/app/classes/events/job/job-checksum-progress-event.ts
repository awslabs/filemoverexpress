import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { JobChecksumProgressEvent as ProtoJobChecksumProgressEvent } from '@gen/es/fme/v1/job_pb';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

export class JobChecksumProgressEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(public jobId: string, public total: number, public completed: number) {
    }

    get logMessage(): string {
        return `Job checksum progress for ${this.jobId}. Total: ${this.total}, Completed: ${this.completed}`;
    }

    static fromProtobuf(event: ListEventsResponse): JobChecksumProgressEvent {
        const evt = event.event.value as ProtoJobChecksumProgressEvent;

        return new JobChecksumProgressEvent(
            evt.jobId,
            evt.total,
            evt.completed,
        );
    }
}
