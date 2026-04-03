export enum EventLogLevel {
    Trace = 'trace',
    Debug = 'debug',
    Info = 'info',
    Warning = 'warning',
    Error = 'error',
    Fatal = 'fatal'
}

export interface BaseEvent {
    logLevel: EventLogLevel;
    logMessage: string;
}

