export enum StorageServiceErrorType {
    NoSuchKey,
    JsonError,
    InvalidType
}

export class StorageServiceError extends Error {
    errorType: StorageServiceErrorType;

    constructor(message: string, type: StorageServiceErrorType) {
        super(message);
        this.errorType = type;
    }
}

export enum StreamingClientErrorType {
    StreamingClientNull
}

const StreamingClientErrorMessages = {
    [StreamingClientErrorType.StreamingClientNull]: 'Streaming client is not ready',
};

export class StreamingClientError extends Error {
    errorType: StreamingClientErrorType;

    constructor(type: StreamingClientErrorType, message?: string) {
        if (!message) {
            message = StreamingClientErrorMessages[type];
        }
        super(message);
        this.errorType = type;
    }
}

export class NullBookmarkError extends Error {
    constructor() {
        super('Current bookmark selection is null');
    }
}
