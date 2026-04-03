import { RenameLocalPathResponse as ProtoRenameLocalPathResponse } from '@gen/es/fme/v1/remote_daemon_pb';

export class RenameLocalPathResponse {
    constructor(public success: boolean, public message: string) {
    }

    static fromProtobuf(pbEvt: ProtoRenameLocalPathResponse): RenameLocalPathResponse {
        return new RenameLocalPathResponse(
            pbEvt.success,
            pbEvt.message,
        );
    }
}
