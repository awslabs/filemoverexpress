import { RenameS3PathResponse as ProtoRenameS3PathResponse } from '@gen/es/s3_shared/v1/s3_pb';

export class RenameS3PathResponse {
    constructor(public success: boolean, public message: string) {
    }

    static fromProtobuf(pbEvt: ProtoRenameS3PathResponse): RenameS3PathResponse {
        return new RenameS3PathResponse(
            pbEvt.success,
            pbEvt.message,
        );
    }
}
