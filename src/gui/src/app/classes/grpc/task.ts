import { cleanPath } from '@app/components/layout/file-browser/file-browser.utils';
import { Task as ProtoTask, TaskLocalFile as ProtoLocalFile, TaskS3Object as ProtoS3Object } from '@gen/es/fme/v1/job_pb';
import { timestampDate } from '@bufbuild/protobuf/wkt';

export interface FlattenedTask {
    taskId: string,
    destination: string,
    source: string,
    size: number,
    lastModified: Date | null,
    direction: string,
    status: string,
    statusMessage: string,
    jobId: string,
    checksum: string,
    priority: number,
    error: string,
    bytesTransferred: number,
}

export class Task {
    constructor(
        public taskId: string,
        public destination: string,
        public localFile: LocalFile,
        public s3Object: S3Object,
        public direction: string,
        public status: string,
        public statusMessage: string,
        public jobId: string,
        public checksum: string,
        public priority: number,
        public error: string,
        public bytesTransferred: number,
    ) {
    }

    static fromProtobuf(task: ProtoTask): Task {
        if (!task.localFile || !task.s3Object) {
            throw new Error('Missing required data in message');
        }

        return new Task(
            task.taskId,
            task.destination,
            LocalFile.fromProtobuf(task.localFile),
            S3Object.fromProtobuf(task.s3Object),
            task.taskDirection,
            task.status,
            task.statusMessage,
            task.jobId,
            task.checksum,
            task.priority,
            task.err,
            Number(task.bytesTransferred),
        );
    }

    static toFlattenedTask(task: Task, bucket: string): FlattenedTask {
        let destination = task.destination;
        let source = '';
        let size = 0;
        let lastModified = null;

        switch (task.direction.toLowerCase()) {
            case 'upload':
                destination = bucket ? `s3://${bucket}/${cleanPath(task.destination)}` : task.destination;
                source = task.localFile.path;
                size = task.localFile.size;
                lastModified = task.localFile.lastModified;
                break;
            case 'download':
                destination = task.destination;
                source = bucket ? `s3://${bucket}/${cleanPath(task.s3Object.key)}` : task.s3Object.key;
                size = task.s3Object.size;
                lastModified = task.s3Object.lastModified;
        }

        return {
            taskId: task.taskId,
            destination: destination,
            source: source,
            size: size,
            lastModified: lastModified,
            direction: task.direction,
            status: task.status,
            statusMessage: task.statusMessage,
            jobId: task.jobId,
            checksum: task.checksum,
            priority: task.priority,
            error: task.error,
            bytesTransferred: task.bytesTransferred,
        };
    }
}

class LocalFile {
    constructor(public path: string, public size: number, public lastModified: Date) {
    }

    static fromProtobuf(lf: ProtoLocalFile) {
        return new LocalFile(
            lf.path,
            Number(lf.size),
            lf.lastModified ? timestampDate(lf.lastModified) : new Date(),
        );
    }
}

class S3Object {
    constructor(public key: string, public size: number, public lastModified: Date) {
    }

    static fromProtobuf(s3o: ProtoS3Object): S3Object {
        return new S3Object(
            s3o.key,
            Number(s3o.size),
            s3o.lastModified ? timestampDate(s3o.lastModified) : new Date(),
        );
    }
}
