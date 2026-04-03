import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { InventoryReportErrorEvent as ProtoErrorEvent } from '@gen/es/fme/v1/inventory_pb';

export class InventoryReportErrorEvent implements BaseEvent {
    logLevel = EventLogLevel.Error;

    constructor(
        public reportId: string,
        public transferProfile: string,
        public bucket: string,
        public prefix: string,
        public error: string,
    ) {
    }

    get logMessage(): string {
        return `Bucket report for ${this.bucket} (Prefix: ${this.prefix}) encountered an error: ${this.error}`;
    }

    public static fromProtobuf(event: ListEventsResponse): InventoryReportErrorEvent {
        const evt = event.event.value as ProtoErrorEvent;

        return new InventoryReportErrorEvent(
            evt.reportId,
            evt.transferProfile,
            evt.bucket,
            evt.prefix,
            evt.error,
        );
    }
}
