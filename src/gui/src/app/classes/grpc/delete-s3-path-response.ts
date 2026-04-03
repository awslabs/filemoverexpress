import { DeleteS3PathResponse as ProtoDeleteS3PathResponse } from '@gen/es/s3_shared/v1/s3_pb';

export class DeleteS3PathResponse {
    constructor(public success: boolean, public message: string) {
    }

    static fromProtobuf(pbEvt: ProtoDeleteS3PathResponse): DeleteS3PathResponse {
        return new DeleteS3PathResponse(
            pbEvt.success,
            pbEvt.message,
        );
    }
}
