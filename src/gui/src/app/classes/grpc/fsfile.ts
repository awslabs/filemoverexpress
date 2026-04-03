import { File } from '@app/interfaces/file';
import { FsFile as ProtoFSFile } from '@gen/es/fme/v1/remote_daemon_pb';
import { basename, dirname } from '@app/utils/utils';
import { timestampDate } from '@bufbuild/protobuf/wkt';

export class FSFile implements File {
    constructor(public path: string, public size: bigint, public lastModified: Date | null) {
    }

    get name(): string {
        return basename(this.path);
    }

    get parent(): string {
        return dirname(this.path);
    }

    static fromProtobuf(evt: ProtoFSFile | File): FSFile {
        let lastModified = evt.lastModified ? evt.lastModified : null;
        if (lastModified && !(lastModified instanceof Date)) {
            lastModified = timestampDate(lastModified);
        }

        return new FSFile(
            evt.path,
            evt.size,
            lastModified,
        );
    }
}
