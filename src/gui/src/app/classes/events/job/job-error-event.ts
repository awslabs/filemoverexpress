import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { JobErrorEvent as ProtoJobErrorEvent } from '@gen/es/fme/v1/job_pb';

export class JobErrorEvent implements BaseEvent {
    logLevel = EventLogLevel.Error;

    constructor(public id: string, public name: string, public errorTime: Date, public error: string) {
    }

    get logMessage(): string {
        return `Error for job ${this.name} - ${this.error}`;
    }

    static fromProtobuf(event: ListEventsResponse): JobErrorEvent {
        const evt = event.event.value as ProtoJobErrorEvent;

        return new JobErrorEvent(
            evt.id,
            evt.name,
            evt.errorTime ? timestampDate(evt.errorTime) : new Date(),
            evt.error,
        );
    }
}
