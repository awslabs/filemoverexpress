import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { TaskCompleteEvent as ProtoTaskCompleteEvent } from '@gen/es/fme/v1/job_pb';

export class TaskCompleteEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(public id: string, public direction: TransferDirection, public destination: string) {
    }

    get logMessage(): string {
        return `Completed transfer ${this.destination}`;
    }

    static fromProtobuf(event: ListEventsResponse): TaskCompleteEvent {
        const evt = event.event.value as ProtoTaskCompleteEvent;

        return new TaskCompleteEvent(
            evt.id,
            evt.direction === 'upload' ? TransferDirection.Upload : TransferDirection.Download,
            evt.destination,
        );
    }
}
