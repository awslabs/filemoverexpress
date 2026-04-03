export enum CreatePrefixFolderType {
    Local = 'local',
    S3 = 's3'
}

export interface CreatePrefixFolderData {
    parent: string;
    type: CreatePrefixFolderType;
    transferProfile?: string;
}
