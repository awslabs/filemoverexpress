import { CreateS3PrefixResponse as ProtoCreateS3PrefixResponse } from '@app/classes/grpc/create-s3-prefix-response';

export class CreateS3PrefixResponse {
    constructor(public success: boolean, public message: string) {
    }

    static fromProtobuf(pbEvt: ProtoCreateS3PrefixResponse): CreateS3PrefixResponse {
        return new CreateS3PrefixResponse(pbEvt.success, pbEvt.message);
    }
}
