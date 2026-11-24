import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { MessageEvent as ProtoMessageEvent } from '@gen/es/fme/v1/events_pb';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';

export class MessageEvent implements BaseEvent {
    logLevel: EventLogLevel;

    // jobId scopes this message to a job (empty for global daemon messages), so
    // the GUI can file it under that job's Logs tab.
    constructor(public msg: string, logLevelStr: string, public jobId = '') {
        this.logLevel = logLevelStr as EventLogLevel;
    }

    get logMessage(): string {
        return this.msg;
    }

    static fromProtobuf(event: ListEventsResponse): MessageEvent {
        const evt = event.event.value as ProtoMessageEvent;
        return new MessageEvent(evt.msg, evt.logLevel, evt.jobId);
    }
}

