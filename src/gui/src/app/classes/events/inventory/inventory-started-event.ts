import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { InventoryReportStartedEvent as ProtoInventoryReportStartEvent } from '@gen/es/fme/v1/inventory_pb';

export class InventoryReportStartedEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(
        public reportId: string,
        public transferProfile: string,
        public bucket: string,
        public prefix: string,
        public startTime: Date,
    ) {
    }

    get logMessage(): string {
        return `Bucket report is being generated for ${this.bucket} (Prefix: ${this.prefix})`;
    }

    public static fromProtobuf(event: ListEventsResponse): InventoryReportStartedEvent {
        const evt = event.event.value as ProtoInventoryReportStartEvent;

        if (!evt.startTime) {
            console.debug('Got a InventoryReportStartedEvent without a startTime timestamp');
        }

        return new InventoryReportStartedEvent(
            evt.reportId,
            evt.transferProfile,
            evt.bucket,
            evt.prefix,
            evt.startTime ? timestampDate(evt.startTime) : new Date(),
        );
    }
}
