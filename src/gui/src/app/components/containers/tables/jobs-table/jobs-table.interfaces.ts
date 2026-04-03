export interface TransferSummaryStats {
    activeJobs: number,
    totalJobs: number,
    activeBytes: number,
    totalBytesTransferred: number,
    totalActiveBytesTransferred: number,
    elapsedTime: number,
    averageSpeed: number,
}

export const INITIAL_TRANSFER_SUMMARY_STATS: TransferSummaryStats = {
    activeJobs: 0,
    totalJobs: 0,
    activeBytes: 0,
    totalBytesTransferred: 0,
    totalActiveBytesTransferred: 0,
    elapsedTime: 0,
    averageSpeed: 0,
};
