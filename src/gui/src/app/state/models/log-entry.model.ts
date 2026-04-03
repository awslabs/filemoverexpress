export interface LogEntry {
    level: string;
    message: string;
    timestamp: Date;
    jobId: string | null;
}
