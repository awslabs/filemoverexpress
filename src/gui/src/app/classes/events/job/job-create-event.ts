import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { stringToJobStatus } from '@app/utils/job-utils';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { JobCreateEvent as ProtoJobCreateEvent } from '@gen/es/fme/v1/job_pb';
import { JobStatus } from '@state/models/job.model';

export class JobCreateEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(
        public id: string,
        public name: string,
        public created: Date,
        public transferProfile: string,
        public destination: string,
        public direction: TransferDirection,
        public status: JobStatus,
        public force: boolean,
    ) {
    }

    get logMessage(): string {
        return `Created job ${this.name}`;
    }

    static fromProtobuf(event: ListEventsResponse): JobCreateEvent {
        const evt = event.event.value as ProtoJobCreateEvent;

        return new JobCreateEvent(
            evt.id,
            evt.name,
            evt.created ? timestampDate(evt.created) : new Date(),
            evt.transferProfile,
            evt.destination,
            evt.direction == 'upload' ? TransferDirection.Upload : TransferDirection.Download,
            stringToJobStatus(evt.status),
            evt.force,
        );
    }
}
