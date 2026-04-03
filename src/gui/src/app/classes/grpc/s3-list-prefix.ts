import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import * as ProtoS3 from '@gen/es/s3_shared/v1/s3_pb';
import { basename, dirname } from '@app/utils/utils';
import { File } from '@app/interfaces/file';
import { Directory } from '@app/interfaces/directory';
import { timestampDate } from '@bufbuild/protobuf/wkt';

export class S3Object implements BaseEvent, File {
    logLevel = EventLogLevel.Trace;

    constructor(public path: string, public size: bigint, public lastModified: Date | null, public storageClass: string) {
    }

    get name(): string {
        return basename(this.path);
    }

    get parent(): string {
        return dirname(this.path);
    }

    get logMessage(): string {
        return `S3 Object discovered. Key: ${this.path}, Size: ${this.size}`;
    }

    static fromProtobuf(evt: ProtoS3.S3Object): S3Object {
        return new S3Object(
            evt.key,
            evt.size,
            evt.lastModified ? timestampDate(evt.lastModified) : null,
            evt.storageClass,
        );
    }
}

export class S3ListPrefix implements BaseEvent, Directory {
    logLevel = EventLogLevel.Trace;

    constructor(public path: string, public folders: string[], public files: File[]) {
    }

    get name(): string {
        return basename(this.path);
    }

    get parent(): string {
        return dirname(this.path);
    }

    get logMessage(): string {
        return `S3 Prefix Listing for ${this.path} contains ${this.folders.length} folders and ${this.files.length} files`;
    }

    static fromProtobuf(evt: ProtoS3.S3ListPrefixResponse): S3ListPrefix {
        return new S3ListPrefix(
            evt.prefix,
            evt.prefixes,
            evt.objects.map((item) => S3Object.fromProtobuf(item)),
        );
    }
}
