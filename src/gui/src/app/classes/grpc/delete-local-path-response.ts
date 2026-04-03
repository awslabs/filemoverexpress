import { DeleteLocalPathResponse as ProtoDeleteLocalPathResponse } from '@gen/es/fme/v1/remote_daemon_pb';

export class DeleteLocalPathResponse {
    constructor(public success: boolean, public message: string) {
    }

    static fromProtobuf(pbEvt: ProtoDeleteLocalPathResponse): DeleteLocalPathResponse {
        return new DeleteLocalPathResponse(
            pbEvt.success,
            pbEvt.message,
        );
    }
}
