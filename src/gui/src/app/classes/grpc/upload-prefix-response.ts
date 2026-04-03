import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { UploadPrefixResponse as ProtoUploadPrefixResponse, UploadPrefixStatusCode } from '@gen/es/s3_shared/v1/s3_pb';

export class UploadPrefixResponse implements BaseEvent {
    constructor(public success: boolean, public response: string, public status: UploadPrefixStatusCode) {
    }

    get logLevel(): EventLogLevel {
        switch (this.status) {
            case UploadPrefixStatusCode.UPLOAD_STATUS_UNSPECIFIED:
                return EventLogLevel.Error;

            case UploadPrefixStatusCode.QUEUED_UPLOAD_SUCCESS:
                return EventLogLevel.Info;

            case UploadPrefixStatusCode.QUEUED_UPLOAD_FAILURE:
                return EventLogLevel.Error;

            case UploadPrefixStatusCode.UPLOAD_AUTH_ERROR:
                return EventLogLevel.Error;
        }
    }

    get logMessage(): string {
        switch (this.status) {
            case UploadPrefixStatusCode.UPLOAD_STATUS_UNSPECIFIED:
                return 'An unknown error occurred while submitting upload request';

            case UploadPrefixStatusCode.QUEUED_UPLOAD_SUCCESS:
                return 'Upload request submitted successfully';

            case UploadPrefixStatusCode.QUEUED_UPLOAD_FAILURE:
                return 'Upload request failed';

            case UploadPrefixStatusCode.UPLOAD_AUTH_ERROR:
                return 'Error authenticating with S3';
        }
    }

    static fromProtobuf(evt: ProtoUploadPrefixResponse): UploadPrefixResponse {
        return new UploadPrefixResponse(evt.success, evt.response, evt.status);
    }
}
