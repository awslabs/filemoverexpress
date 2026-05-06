import * as ConfigInterfaces from '../interfaces/config';
import { FmeConfigSection } from '../interfaces/config';
import * as proto from '@gen/es/fme/v1/config_pb';
import {
    DEFAULT_CHECKSUMS,
    DEFAULT_GENERAL_SETTINGS,
    DEFAULT_LOGGING_SETTINGS,
    DEFAULT_PATHS,
    DEFAULT_PROTOCOLS_SETTINGS,
    DEFAULT_REPORTS_SETTINGS,
    DEFAULT_S3_CONFIG,
} from '../constants/config';
import { create } from '@bufbuild/protobuf';

export class FmeConfig implements ConfigInterfaces.FmeConfig {
    constructor(
        public general: General,
        public logging: Logging,
        public reports: Reports,
        public protocols: Protocols,
        public uploadHotFolders: HotFolders[],
    ) {
    }

    static fromJson(input: ConfigInterfaces.FmeConfig): FmeConfig {
        const hotFolders: HotFolders[] = [];
        for (const hotFolder of Object.values(input.uploadHotFolders)) {
            hotFolders.push(HotFolders.fromJson(hotFolder));
        }
        return new FmeConfig(
            General.fromJson(input.general),
            Logging.fromJson(input.logging),
            Reports.fromJson(input.reports),
            Protocols.fromJson(input.protocols),
            hotFolders,
        );
    }

    public static fromProtobuf(input: proto.GRPCFmeConfig): FmeConfig {
        const fieldsToCheck: Record<string, FmeConfigSection> = {
            'general': input.general,
            'logging': input.logging,
            'reports': input.reports,
            'protocols': input.protocols,
            'hotFolders': input.uploadHotFolders,
        };

        for (const fieldName in fieldsToCheck) {
            if (!fieldsToCheck[fieldName]) {
                console.debug(`Got an FmeConfig message without a ${fieldName} property`);
            }
        }
        const hotFolders: HotFolders[] = [];
        for (const hotFolder of Object.values(input.uploadHotFolders)) {
            hotFolders.push(HotFolders.fromProtobuf(hotFolder));
        }

        return new FmeConfig(
            input.general ? General.fromProtobuf(input.general) : General.fromJson(DEFAULT_GENERAL_SETTINGS),
            input.logging ? Logging.fromProtobuf(input.logging) : Logging.fromJson(DEFAULT_LOGGING_SETTINGS),
            input.reports ? Reports.fromProtobuf(input.reports) : Reports.fromJson(DEFAULT_REPORTS_SETTINGS),
            input.protocols ? Protocols.fromProtobuf(input.protocols) : Protocols.fromJson(DEFAULT_PROTOCOLS_SETTINGS),
            hotFolders,
        );
    }

    public toProtobuf(): proto.GRPCFmeConfig {
        const grpcConfig = create(proto.GRPCFmeConfigSchema);
        grpcConfig.general = General.jsonToProtobuf(this.general);
        grpcConfig.logging = Logging.jsonToProtobuf(this.logging);
        grpcConfig.reports = Reports.jsonToProtobuf(this.reports);
        grpcConfig.protocols = Protocols.jsonToProtobuf(this.protocols);
        grpcConfig.uploadHotFolders = this.uploadHotFolders.map(
            (itm) => HotFolders.jsonToProtobuf(itm),
        );
        return grpcConfig;
    }
}

export class General implements ConfigInterfaces.ConfigGeneral {
    constructor(
        public noSleep: boolean,
        public retryCount: number,
        public maxActiveTransfers: number,
        public maxActiveChecksums: number,
        public targetBandwidth: number,
    ) {
    }

    public static fromProtobuf(input: proto.GeneralSettings): General {
        return new General(
            input.noSleep,
            input.retryCount,
            input.maxActiveTransfers,
            input.maxActiveChecksums,
            input.targetBandwidth,
        );
    }

    static fromJson(input: ConfigInterfaces.ConfigGeneral): General {
        return new General(
            input.noSleep,
            input.retryCount,
            input.maxActiveTransfers,
            input.maxActiveChecksums,
            input.targetBandwidth,
        );
    }

    static jsonToProtobuf(input: ConfigInterfaces.ConfigGeneral): proto.GeneralSettings {
        const generateSettings = create(proto.GeneralSettingsSchema);
        generateSettings.noSleep = input.noSleep;
        generateSettings.retryCount = input.retryCount;
        generateSettings.maxActiveTransfers = input.maxActiveTransfers;
        generateSettings.maxActiveChecksums = input.maxActiveChecksums;
        generateSettings.targetBandwidth = input.targetBandwidth;
        return generateSettings;
    }
}

export class HotFolders implements ConfigInterfaces.ConfigHotFolders {
    constructor(
        public name: string,
        public enabled: boolean,
        public localSourceFolder: string,
        public remoteConfigurations: HotFoldersTransferConfigurations[],
    ) {
    }

    static fromProtobuf(input: proto.UploadHotFolderSettings): HotFolders {
        const transferConfigurations: HotFoldersTransferConfigurations[] = [];
        for (const txConfig of Object.values(input.remoteConfigurations)) {
            transferConfigurations.push(HotFoldersTransferConfigurations.fromProtobuf(txConfig));
        }
        return new HotFolders(
            input.name,
            input.enabled,
            input.localSourceFolder,
            transferConfigurations,
        );
    }

    static fromJson(input: ConfigInterfaces.ConfigHotFolders): HotFolders {
        const transferConfigurations: HotFoldersTransferConfigurations[] = [];
        for (const txConfig of Object.values(input.remoteConfigurations)) {
            transferConfigurations.push(HotFoldersTransferConfigurations.fromJson(txConfig));
        }
        return new HotFolders(
            input.name,
            input.enabled,
            input.localSourceFolder,
            transferConfigurations,
        );
    }

    static jsonToProtobuf(input: ConfigInterfaces.ConfigHotFolders): proto.UploadHotFolderSettings {
        const uploadHotFolderSettings = create(proto.UploadHotFolderSettingsSchema);
        uploadHotFolderSettings.name = input.name;
        uploadHotFolderSettings.enabled = input.enabled;
        uploadHotFolderSettings.localSourceFolder = input.localSourceFolder;
        uploadHotFolderSettings.remoteConfigurations = input.remoteConfigurations.map(
            (itm) => HotFoldersTransferConfigurations.jsonToProtobuf(itm),
        );
        return uploadHotFolderSettings;
    }
}

export class HotFoldersTransferConfigurations implements HotFoldersTransferConfigurations {
    constructor(
        public remoteConfigurationName: string,
        public s3DestinationFolder: string,
    ) {
    }

    static fromProtobuf(input: proto.HotFolderTransferConfigurations): HotFoldersTransferConfigurations {
        return new HotFoldersTransferConfigurations(
            input.remoteConfigurationName,
            input.s3DestinationFolder,
        );
    }

    static fromJson(input: ConfigInterfaces.HotFolderTransferConfigurations): HotFoldersTransferConfigurations {
        return new HotFoldersTransferConfigurations(
            input.remoteConfigurationName,
            input.s3DestinationFolder,
        );
    }

    static jsonToProtobuf(input: ConfigInterfaces.HotFolderTransferConfigurations): proto.HotFolderTransferConfigurations {
        const hotFolderTransferConfigurations = create(proto.HotFolderTransferConfigurationsSchema);
        hotFolderTransferConfigurations.remoteConfigurationName = input.remoteConfigurationName;
        hotFolderTransferConfigurations.s3DestinationFolder = input.s3DestinationFolder;
        return hotFolderTransferConfigurations;
    }
}

export class Logging implements ConfigInterfaces.ConfigLogging {
    constructor(
        public compress: boolean,
        public directory: string,
        public maxAge: number,
        public maxSize: number,
        public severity: string,
    ) {
    }

    public static fromProtobuf(input: proto.LoggingSettings): Logging {
        return new Logging(
            input.compress,
            input.directory,
            input.maxAge,
            input.maxSize,
            input.severity,
        );
    }

    static fromJson(input: ConfigInterfaces.ConfigLogging): Logging {
        return new Logging(
            input.compress,
            input.directory,
            input.maxAge,
            input.maxSize,
            input.severity,
        );
    }

    static jsonToProtobuf(input: ConfigInterfaces.ConfigLogging): proto.LoggingSettings {
        const loggingSettings = create(proto.LoggingSettingsSchema);
        loggingSettings.maxAge = input.maxAge;
        loggingSettings.maxSize = input.maxSize;
        loggingSettings.severity = input.severity;
        loggingSettings.compress = input.compress;
        loggingSettings.directory = input.directory;
        return loggingSettings;
    }
}

export class Reports implements ConfigInterfaces.ConfigReports {
    constructor(public directory: string) {
    }

    static fromProtobuf(input: proto.ReportsSettings): Reports {
        return new Reports(input.directory);
    }

    static fromJson(input: ConfigInterfaces.ConfigReports): Reports {
        return new Reports(input.directory);
    }

    static jsonToProtobuf(input: ConfigInterfaces.ConfigReports): proto.ReportsSettings {
        const reportsSettings = create(proto.ReportsSettingsSchema);
        reportsSettings.directory = input.directory;
        return reportsSettings;
    }
}

export class Protocols implements ConfigInterfaces.ConfigProtocols {
    constructor(public s3: S3Config) {
    }

    static fromProtobuf(input: proto.Protocols): Protocols {
        if (!input.s3) {
            console.debug('Got a Protocols message without an s3 property');
        }
        return new Protocols(input.s3 ? S3Config.fromProtobuf(input.s3) : S3Config.fromJson(DEFAULT_S3_CONFIG));
    }

    static fromJson(input: ConfigInterfaces.ConfigProtocols): Protocols {
        return new Protocols(input.s3);
    }

    static jsonToProtobuf(input: ConfigInterfaces.ConfigProtocols): proto.Protocols {
        const protocols = create(proto.ProtocolsSchema);
        protocols.s3 = S3Config.jsonToProtobuf(input.s3);
        return protocols;
    }
}

export class S3Config implements ConfigInterfaces.ConfigS3 {
    constructor(
        public transferProfiles: Record<string, TransferProfile>,
    ) {
    }

    static fromProtobuf(input: proto.S3Settings): S3Config {
        const txProfiles: Record<string, TransferProfile> = {};
        for (const txProfile of Object.values(input.transferProfiles)) {
            txProfiles[txProfile.name] = TransferProfile.fromProtobuf(txProfile);
        }
        return new S3Config(
            txProfiles,
        );
    }

    static fromJson(input: ConfigInterfaces.ConfigS3): S3Config {
        const txProfiles: Record<string, TransferProfile> = {};
        for (const txProfile of Object.values(input.transferProfiles)) {
            txProfiles[txProfile.name] = TransferProfile.fromJson(txProfile);
        }
        return new S3Config(
            txProfiles,
        );
    }

    static jsonToProtobuf(input: ConfigInterfaces.ConfigS3): proto.S3Settings {
        const s3Settings = create(proto.S3SettingsSchema);
        const txProfiles: Record<string, proto.TransferProfile> = {};
        for (const txProfile of Object.values(input.transferProfiles)) {
            txProfiles[txProfile.name] = TransferProfile.jsonToProtobuf(txProfile);
        }
        s3Settings.transferProfiles = txProfiles;
        return s3Settings;
    }
}

export class TransferProfile implements ConfigInterfaces.ConfigTransferProfile {
    constructor(
        public name: string,
        public bucket: string,
        public region: string,
        public profile: string,
        public accelerated: boolean,
        public fileOrder: string[],
        public enableMetadataFilter: boolean,
        public storageClass: string,
        public paths: Paths,
        public chunkSize: number,
        public threads: number,
        public maxAge: string,
        public filter: string,
        public checksums: Checksums,
        public autoTuning: boolean,
        public endpoint: string,
    ) {
    }

    static fromProtobuf(input: proto.TransferProfile): TransferProfile {
        if (!input.paths) {
            console.debug('Got a TransferProfile message without an paths property');
        }

        return new TransferProfile(
            input.name,
            input.bucket,
            input.region,
            input.profile,
            input.accelerated,
            input.fileOrder,
            input.enableMetadataFilter,
            input.storageClass,
            input.paths ? Paths.fromProtobuf(input.paths) : Paths.fromJson(DEFAULT_PATHS),
            input.chunkSize,
            input.threads,
            input.maxAge,
            input.filter,
            input.checksums ? Checksums.fromProtobuf(input.checksums) : Checksums.fromJson(DEFAULT_CHECKSUMS),
            input.autoTuning,
            input.endpoint,
        );
    }

    static fromJson(input: ConfigInterfaces.ConfigTransferProfile): TransferProfile {
        return new TransferProfile(
            input.name,
            input.bucket,
            input.region,
            input.profile,
            input.accelerated,
            input.fileOrder,
            input.enableMetadataFilter,
            input.storageClass,
            Paths.fromJson(input.paths),
            input.chunkSize,
            input.threads,
            input.maxAge,
            input.filter,
            Checksums.fromJson(input.checksums),
            input.autoTuning,
            input.endpoint,
        );
    }

    static jsonToProtobuf(input: ConfigInterfaces.ConfigTransferProfile): proto.TransferProfile {
        const transferProfile = create(proto.TransferProfileSchema);
        transferProfile.name = input.name;
        transferProfile.bucket = input.bucket;
        transferProfile.region = input.region;
        transferProfile.profile = input.profile;
        transferProfile.accelerated = input.accelerated;
        transferProfile.fileOrder = input.fileOrder;
        transferProfile.enableMetadataFilter = input.enableMetadataFilter;
        transferProfile.storageClass = input.storageClass;
        transferProfile.paths = Paths.jsonToProtobuf(input.paths);
        transferProfile.chunkSize = input.chunkSize;
        transferProfile.threads = input.threads;
        transferProfile.maxAge = input.maxAge;
        transferProfile.filter = input.filter;
        transferProfile.checksums = Checksums.jsonToProtobuf(input.checksums);
        transferProfile.autoTuning = input.autoTuning;
        transferProfile.endpoint = input.endpoint;
        return transferProfile;
    }
}

export class Paths implements ConfigInterfaces.Paths {
    constructor(
        public local: string,
        public remote: string,
    ) {
    }

    static fromProtobuf(input: proto.PathsSettings): Paths {
        return new Paths(
            input.local,
            input.remote,
        );
    }

    static fromJson(input: ConfigInterfaces.Paths): Paths {
        return new Paths(
            input.local,
            input.remote,
        );
    }

    static jsonToProtobuf(input: ConfigInterfaces.Paths): proto.PathsSettings {
        const pathsSettings = create(proto.PathsSettingsSchema);
        pathsSettings.remote = input.remote;
        pathsSettings.local = input.local;
        return pathsSettings;
    }
}

export class Checksums implements ConfigInterfaces.Checksums {
    constructor(
        public enabled: boolean,
        public algorithm: string,
    ) {
    }

    static fromProtobuf(input: proto.ChecksumSettings): Checksums {
        return new Checksums(
            input.enabled,
            input.algorithm,
        );
    }

    static fromJson(input: ConfigInterfaces.Checksums): Checksums {
        return new Checksums(
            input.enabled,
            input.algorithm,
        );
    }

    static jsonToProtobuf(input: ConfigInterfaces.Checksums): proto.ChecksumSettings {
        const checksumSettings = create(proto.ChecksumSettingsSchema);
        checksumSettings.enabled = input.enabled;
        checksumSettings.algorithm = input.algorithm;
        return checksumSettings;
    }
}
