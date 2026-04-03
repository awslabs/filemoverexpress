import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { UnsupportedVersionEvent as ProtoUnsupportedVersionEvent } from '@gen/es/fme/v1/events_pb';
import { MARKETING_PAGE_URL } from '@app/constants/external-links';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

export class UnsupportedVersionEvent implements BaseEvent {
    logLevel = EventLogLevel.Warning;

    constructor(public newVersion: string, public currentVersion: string, public releaseNotes: string[]) {
    }

    get logMessage(): string {
        return `Your current version is no longer supported. Current version: ${this.currentVersion}, Newest supported version: ${this.newVersion}. Visit ${MARKETING_PAGE_URL} to download`;
    }

    static fromProtobuf(event: ListEventsResponse): UnsupportedVersionEvent {
        const evt = event.event.value as ProtoUnsupportedVersionEvent;

        return new UnsupportedVersionEvent(
            evt.newSupportedVersion,
            evt.currentVersion,
            evt.releaseNotes,
        );
    }
}
