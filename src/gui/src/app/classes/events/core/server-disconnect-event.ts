import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { DisconnectType, ServerDisconnectEvent as ProtoServerDisconnectEvent } from '@gen/es/fme/v1/events_pb';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

export class ServerDisconnectEvent implements BaseEvent {
    disconnectType: DisconnectType;

    constructor(disconnectType: DisconnectType) {
        if (!Object.values(DisconnectType).includes(disconnectType)) {
            throw new Error(`Invalid disconnect type received: ${disconnectType}`);
        }
        this.disconnectType = disconnectType;
    }

    get logLevel(): EventLogLevel {
        switch (this.disconnectType) {
            case DisconnectType.UNSPECIFIED:
                return EventLogLevel.Error;

            case DisconnectType.CLI_DOWNLOADS_COMPLETE_DISCONNECT_TYPE:
                return EventLogLevel.Info;

            case DisconnectType.CLI_UPLOADS_COMPLETE_DISCONNECT_TYPE:
                return EventLogLevel.Info;

            case DisconnectType.DAEMON_MODE_EXIT_DISCONNECT_TYPE:
                return EventLogLevel.Error;

            default:
                return EventLogLevel.Error;
        }
    }

    get logMessage(): string {
        switch (this.disconnectType) {
            case DisconnectType.UNSPECIFIED:
                return 'Unknown disconnect reason';

            case DisconnectType.CLI_DOWNLOADS_COMPLETE_DISCONNECT_TYPE:
                return 'Download completed';

            case DisconnectType.CLI_UPLOADS_COMPLETE_DISCONNECT_TYPE:
                return 'Upload completed';

            case DisconnectType.DAEMON_MODE_EXIT_DISCONNECT_TYPE:
                return 'User-initiated daemon mode shutdown';
        }
    }

    static fromProtobuf(event: ListEventsResponse): ServerDisconnectEvent {
        const evt = event.event.value as ProtoServerDisconnectEvent;

        return new ServerDisconnectEvent(evt.disconnectType);
    }
}
