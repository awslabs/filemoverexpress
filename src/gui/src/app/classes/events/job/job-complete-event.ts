import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { JobCompleteEvent as ProtoJobCompleteEvent } from '@gen/es/fme/v1/job_pb';

export class JobCompleteEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(
        public id: string,
        public name: string,
        public completed: Date,
        public hasTaskErrors: boolean,
        public hasSuccessfulTasks: boolean,
        public hasAllTasksSkipped: boolean,
    ) {
    }

    get logMessage(): string {
        return `Completed job ${this.name}`;
    }

    static fromProtobuf(event: ListEventsResponse): JobCompleteEvent {
        const evt = event.event.value as ProtoJobCompleteEvent;

        return new JobCompleteEvent(evt.id,
            evt.name,
            evt.completed ? timestampDate(evt.completed) : new Date(),
            evt.hasTaskErrors,
            evt.hasSuccessfulTasks,
            evt.hasAllSkippedTasks);
    }
}
