import { CreateLocalFolderResponse as ProtoCreateLocalFolderResponse } from '@gen/es/fme/v1/remote_daemon_pb';

export class CreateLocalFolderResponse {
    constructor(public success: boolean, public message: string) {
    }

    static fromProtobuf(pbEvt: ProtoCreateLocalFolderResponse): CreateLocalFolderResponse {
        return new CreateLocalFolderResponse(
            pbEvt.success,
            pbEvt.message,
        );
    }
}
