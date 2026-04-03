import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { AlertEvent as ProtoAlertEvent } from '@gen/es/fme/v1/events_pb';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

export class AlertEvent implements BaseEvent {
    logLevel: EventLogLevel;

    constructor(public message: string, public level: string) {
        switch (level.toLowerCase()) {
            case 'trace':
                this.logLevel = EventLogLevel.Trace;
                break;

            case 'debug':
                this.logLevel = EventLogLevel.Debug;
                break;

            case 'warning':
            case 'warn':
                this.logLevel = EventLogLevel.Warning;
                break;

            case 'error':
                this.logLevel = EventLogLevel.Error;
                break;

            case 'fatal':
                this.logLevel = EventLogLevel.Fatal;
                break;

            case 'default':
            case 'info':
            case 'success':
            default:
                this.logLevel = EventLogLevel.Info;
        }
    }

    get logMessage(): string {
        return this.message;
    }

    static fromProtobuf(event: ListEventsResponse): AlertEvent {
        const evt = event.event.value as ProtoAlertEvent;

        return new AlertEvent(evt.msg, evt.level);
    }
}
