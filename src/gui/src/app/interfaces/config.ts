import * as proto from '@gen/es/fme/v1/config_pb';

export type FmeConfigSection =
    proto.GeneralSettings
    | proto.LoggingSettings
    | proto.ReportsSettings
    | proto.ApiServerSettings
    | proto.Protocols
    | proto.UploadHotFolderSettings[]
    | undefined;

export interface FmeConfig {
    general: ConfigGeneral;
    logging: ConfigLogging;
    reports: ConfigReports;
    apiServer: ConfigAPIServer;
    protocols: ConfigProtocols;
    uploadHotFolders: ConfigHotFolders[];
}

export interface ConfigGeneral {
    noSleep: boolean;
    retryCount: number;
    maxActiveTransfers: number;
    maxActiveChecksums: number;
    targetBandwidth: number;
}

export interface ConfigHotFolders {
    name: string;
    enabled: boolean;
    localSourceFolder: string;
    remoteConfigurations: HotFolderTransferConfigurations[];
}

export interface HotFolderTransferConfigurations {
    remoteConfigurationName: string;
    s3DestinationFolder: string;
}

export interface ConfigLogging {
    directory: string;
    severity: string;
    maxSize: number;
    maxAge: number;
    compress: boolean;
}

export interface ConfigReports {
    directory: string;
}

export interface ConfigAPIServer {
    enabled: boolean;
    permissions: APIServerPermissions;
    blockedPaths: string[];
    tls: APIServerTLS;
    remote: APIServerRemote;
    allowedOrigins: string[];
}

export interface APIServerPermissions {
    allowUiConfiguration: boolean;
    allowLocalRenameDelete: boolean;
    allowRemoteRenameDelete: boolean;
}

export interface APIServerTLS {
    enabled: boolean;
    certificateFile: string;
    keyFile: string;
}

export interface APIServerPermissions {
    allowUiConfiguration: boolean;
    allowLocalRenameDelete: boolean;
    allowRemoteRenameDelete: boolean;
}

export interface APIServerRemote {
    enabled: boolean;
    preSharedKey: string;
    address: string;
    ports: number[];
}

export interface ConfigProtocols {
    s3: ConfigS3;
}

export interface ConfigS3 {
    transferProfiles: Record<string, ConfigTransferProfile>;
}

export interface ConfigTransferProfile {
    name: string;
    bucket: string;
    region: string;
    profile: string;
    accelerated: boolean;
    fileOrder: string[];
    enableMetadataFilter: boolean;
    storageClass: string;
    paths: Paths;
    chunkSize: number;
    threads: number;
    maxAge: string;
    filter: string;
    checksums: Checksums;
    autoTuning: boolean;
    endpoint: string;
}

// export interface ConfigUploadHotFolder {
//     enabled: boolean;
//     basePath: string;
//     s3Prefix: string;
// }

export interface Paths {
    local: string;
    remote: string;
}

export interface Checksums {
    enabled: boolean;
    algorithm: string;
}


