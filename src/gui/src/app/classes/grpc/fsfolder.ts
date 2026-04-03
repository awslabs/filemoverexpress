import { Directory } from '@app/interfaces/directory';
import { File } from '@app/interfaces/file';
import { FSFile } from './fsfile';
import { basename, dirname } from '@app/utils/utils';
import { FsFolder as ProtoFSFolder } from '@gen/es/fme/v1/remote_daemon_pb';

export class FSFolder implements Directory {
    constructor(public path: string, public folders: string[], public files: File[]) {
    }

    get name(): string {
        return basename(this.path);
    }

    get parent(): string {
        return dirname(this.path);
    }

    static fromProtobuf(evt: ProtoFSFolder | Directory): FSFolder {
        return new FSFolder(
            evt.path,
            evt.folders,
            evt.files.map((item) => FSFile.fromProtobuf(item)),
        );
    }
}
