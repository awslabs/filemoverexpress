import { EventLogLevel } from '@app/interfaces/events';
import { formatBytes } from '@app/utils/utils';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { JobProgressEvent as ProtoJobProgressEvent } from '@gen/es/fme/v1/job_pb';

export class JobProgressEvent {
    logLevel = EventLogLevel.Info;

    constructor(public id: string, public name: string, public bytesTransferred: number, public totalBytes: number) {
    }

    get logMessage(): string {
        return `Job progress for ${this.name}: ${formatBytes(this.bytesTransferred)}/${formatBytes(this.totalBytes)} transferred`;
    }

    static fromProtobuf(event: ListEventsResponse): JobProgressEvent {
        const evt = event.event.value as ProtoJobProgressEvent;

        return new JobProgressEvent(
            evt.id,
            evt.name,
            Number(evt.bytesTransferred),
            Number(evt.totalBytes),
        );
    }
}
