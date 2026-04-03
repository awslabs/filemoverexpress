export interface Transfer {
    id: string;
    jobId: string;
    status: string;
    transferProfile: string;
    bucket: string;
    destination: string;
    prefix: string;
    source: string;
    totalBytes: number;
    bytesTransferred: number;
    queued: Date;
    started: Date | null;
    completed: Date | null;
    message: string | null;
    error: string | null;
}
