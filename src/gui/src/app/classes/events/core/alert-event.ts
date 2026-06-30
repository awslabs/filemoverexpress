import { BaseEvent, EventLogLevel, normalizeLogLevel } from '@app/interfaces/events';
import { AlertEvent as ProtoAlertEvent } from '@gen/es/fme/v1/events_pb';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

export class AlertEvent implements BaseEvent {
    logLevel: EventLogLevel;

    constructor(public message: string, public level: string) {
        this.logLevel = normalizeLogLevel(level);
    }

    get logMessage(): string {
        return this.message;
    }

    static fromProtobuf(event: ListEventsResponse): AlertEvent {
        const evt = event.event.value as ProtoAlertEvent;

        return new AlertEvent(evt.msg, evt.level);
    }
}
