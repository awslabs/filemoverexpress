import * as proto from '@gen/es/fme/v1/config_pb';

export type FmeConfigSection =
    proto.GeneralSettings
    | proto.LoggingSettings
    | proto.ReportsSettings
    | proto.Protocols
    | proto.UploadHotFolderSettings[]
    | undefined;

export interface FmeConfig {
    general: ConfigGeneral;
    logging: ConfigLogging;
    reports: ConfigReports;
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
    authMethod?: string;
    oidcIssuerUrl?: string;
    oidcClientId?: string;
    oidcRoleArn?: string;
    oidcScopes?: string;
    oidcSessionDurationSeconds?: number;
    oidcPersistSession?: boolean;
    oidcCustomCaBundle?: string;
}

export interface Paths {
    local: string;
    remote: string;
}

export interface Checksums {
    enabled: boolean;
    algorithm: string;
}
