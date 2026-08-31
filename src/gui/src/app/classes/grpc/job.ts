import { Job as ProtoJob } from '@gen/es/fme/v1/job_pb';
import { timestampDate } from '@bufbuild/protobuf/wkt';

export class Job {
    constructor(
        public jobId: string,
        public name: string,
        public transferProfileName: string,
        public status: string,
        public statusMessage: string,
        public direction: string,
        public totalBytes: number,
        public bytesUploaded: number,
        public bytesDownloaded: number,
        public hasTaskErrors: boolean,
        public hasSuccessfulTasks: boolean,
        public destination: string,
        public timestampCreated: Date,
        public timestampDiscovering: Date | null,
        public timestampChecksumming: Date | null,
        public timestampTransferring: Date | null,
        public timestampCompleted: Date | null,
        public bucket: string,
        public force: boolean,
    ) {
    }

    static fromProtobuf(job: ProtoJob) {
        return new Job(
            job.jobId,
            job.name,
            job.transferProfileName,
            job.status,
            job.statusMessage,
            job.direction,
            Number(job.totalBytes),
            Number(job.bytesUploaded),
            Number(job.bytesDownloaded),
            job.hasTaskErrors,
            job.hasSuccessfulTasks,
            job.destination,
            job.created ? timestampDate(job.created) : new Date(),
            job.discovering ? timestampDate(job.discovering) : null,
            job.checksumming ? timestampDate(job.checksumming) : null,
            job.transferring ? timestampDate(job.transferring) : null,
            job.completed ? timestampDate(job.completed) : null,
            job.bucket,
            job.force,
        );
    }
}
