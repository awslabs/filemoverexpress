export interface MetadataTransferProfile {
    local: string;
    remote: string;
}

export interface Permissions {
    allowUiConfiguration: boolean,
    allowLocalRenameDelete: boolean,
    allowRemoteRenameDelete: boolean,
}

export type MetadataTransferProfiles = Record<string, MetadataTransferProfile>;

export class MetadataNotLoadedError extends Error {
}
