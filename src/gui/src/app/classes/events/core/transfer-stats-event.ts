import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { formatBytes } from '@app/utils/utils';
import { TransferStatsEvent as ProtoTransferStatsEvent } from '@gen/es/fme/v1/events_pb';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

export class TransferStatsEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(
        public activeDownloads: number,
        public activeUploads: number,
        public downloadBps: number,
        public uploadBps: number,
        public totalBytesDownloaded: number,
        public totalBytesUploaded: number,
    ) {
    }

    get logMessage(): string {
        return `Active Downloads: ${this.activeDownloads}, ` +
            `Avg. Download Speed: ${formatBytes(this.downloadBps)}/s, ` +
            `Total Transferred: ${formatBytes(this.totalBytesDownloaded)} | ` +
            `Active Uploads: ${this.activeUploads}, ` +
            `Avg. Upload Speed: ${formatBytes(this.uploadBps)}/s, ` +
            `Total Transferred: ${formatBytes(this.totalBytesUploaded)}`;
    };

    static fromProtobuf(event: ListEventsResponse): TransferStatsEvent {
        const evt = event.event.value as ProtoTransferStatsEvent;

        return new TransferStatsEvent(
            evt.activeDownloads,
            evt.activeUploads,
            Number(evt.downloadBps),
            Number(evt.uploadBps),
            Number(evt.totalBytesDownloaded),
            Number(evt.totalBytesUploaded),
        );
    }
}
