import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { JobUpdateEvent as ProtoJobUpdateEvent } from '@gen/es/fme/v1/job_pb';

export class JobUpdateEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(public jobId: string, public name: string, public oldName: string) {
    }

    get logMessage(): string {
        return `Renamed job ${this.oldName} to ${this.name}`;
    }

    static fromProtobuf(event: ListEventsResponse): JobUpdateEvent {
        const evt = event.event.value as ProtoJobUpdateEvent;

        return new JobUpdateEvent(
            evt.id,
            evt.name,
            evt.oldName,
        );
    }
}
