export enum EventLogLevel {
    Trace = 'trace',
    Debug = 'debug',
    Info = 'info',
    Warning = 'warning',
    Error = 'error',
    Fatal = 'fatal'
}

/**
 * Normalizes a raw log-level string (as emitted by the daemon, e.g. "warn",
 * "panic", "success") to the canonical EventLogLevel value used by the GUI.
 * The daemon's logrus levels ("warn", "panic", "trace", ...) don't all match
 * the GUI enum values ("warning", "fatal", ...), which previously made the
 * Logs level filter and row highlighting miss rows (e.g. "warn" != "warning").
 * See issue #25.
 */
export function normalizeLogLevel(level: string): EventLogLevel {
    switch (level?.toLowerCase()) {
        case 'trace':
            return EventLogLevel.Trace;
        case 'debug':
            return EventLogLevel.Debug;
        case 'warn':
        case 'warning':
            return EventLogLevel.Warning;
        case 'error':
            return EventLogLevel.Error;
        case 'fatal':
        case 'panic':
            return EventLogLevel.Fatal;
        case 'info':
        case 'success':
        case 'default':
        default:
            return EventLogLevel.Info;
    }
}

export interface BaseEvent {
    logLevel: EventLogLevel;
    logMessage: string;
}

