import { MARKETING_PAGE_URL } from '@app/constants/external-links';
import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { NewVersionAvailableEvent as ProtoNewVersionAvailableEvent } from '@gen/es/fme/v1/events_pb';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

export class NewVersionAvailableEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(public newVersion: string, public currentVersion: string, public releaseNotes: string[]) {
    }

    get logMessage(): string {
        return `A new version is available. Current version: ${this.currentVersion}, New version: ${this.newVersion}. Visit ${MARKETING_PAGE_URL} to download`;
    }

    static fromProtobuf(event: ListEventsResponse): NewVersionAvailableEvent {
        const evt = event.event.value as ProtoNewVersionAvailableEvent;

        return new NewVersionAvailableEvent(
            evt.newVersion,
            evt.currentVersion,
            evt.releaseNotes,
        );
    }
}
