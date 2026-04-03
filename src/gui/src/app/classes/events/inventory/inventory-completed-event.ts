import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { InventoryReportCompletedEvent as ProtoCompleteEvent } from '@gen/es/fme/v1/inventory_pb';
import { timestampDate } from '@bufbuild/protobuf/wkt';

export class InventoryReportCompletedEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(
        public reportId: string,
        public transferProfile: string,
        public bucket: string,
        public prefix: string,
        public outputFile: string,
        public completeTime: Date,
    ) {
    }

    get logMessage(): string {
        return `Bucket report for ${this.bucket} (Prefix: ${this.prefix}) has completed and is available at ${this.outputFile}`;
    }

    public static fromProtobuf(event: ListEventsResponse): InventoryReportCompletedEvent {
        const evt = event.event.value as ProtoCompleteEvent;

        if (!evt.completeTime) {
            console.debug('Got a InventoryReportCompletedEvent without a completeTime timestamp');
        }

        return new InventoryReportCompletedEvent(
            evt.reportId,
            evt.transferProfile,
            evt.bucket,
            evt.prefix,
            evt.outputFile,
            evt.completeTime ? timestampDate(evt.completeTime) : new Date(),
        );
    }
}
