import { describe, it, expect } from 'vitest';
import {
    create,
    isFieldSet,
    ScalarType,
    type DescField,
    type DescMessage,
    type MessageShape,
} from '@bufbuild/protobuf';
import * as ConfigInterfaces from '@app/interfaces/config';
import {
    Checksums,
    FmeConfig,
    General,
    HotFolders,
    HotFoldersTransferConfigurations,
    Logging,
    NotificationDestination,
    Notifications,
    Paths,
    Protocols,
    Reports,
    S3Config,
    TransferProfile,
} from '@classes/config';
import * as proto from '@gen/es/fme/v1/config_pb';
import { NotificationPreset } from '@gen/es/fme/v1/notifications_pb';

const txpData: ConfigInterfaces.ConfigTransferProfile = {
    name: 'name',
    bucket: 'bucket',
    region: 'us-west-2',
    profile: 'profile-name',
    accelerated: false,
    fileOrder: [],
    enableMetadataFilter: false,
    storageClass: 'STANDARD',
    paths: Paths.fromJson({local: '', remote: ''}),
    chunkSize: 25,
    threads: 10,
    maxAge: '',
    filter: '',
    checksums: Checksums.fromJson({algorithm: 'none', enabled: false}),
    autoTuning: true,
    endpoint: '',
};

describe('General', () => {
    const data: ConfigInterfaces.ConfigGeneral = {
        noSleep: true,
        retryCount: 3,
        maxActiveTransfers: 20,
        autoMaxActiveTransfers: true,
        maxActiveChecksums: 8,
        targetBandwidth: 150,
        maxConnectionsPerHost: 64,
        sendBufferBytes: 2 * 1024 * 1024,
        adaptiveConcurrency: true,
    };

    function validate(gen: General) {
        expect(gen).toBeTruthy();
        expect(gen.noSleep).toEqual(data.noSleep);
        expect(gen.retryCount).toEqual(data.retryCount);
        expect(gen.maxActiveTransfers).toEqual(data.maxActiveTransfers);
        expect(gen.autoMaxActiveTransfers).toEqual(data.autoMaxActiveTransfers);
        expect(gen.maxActiveChecksums).toEqual(data.maxActiveChecksums);
        expect(gen.targetBandwidth).toEqual(data.targetBandwidth);
        expect(gen.maxConnectionsPerHost).toEqual(data.maxConnectionsPerHost);
        expect(gen.sendBufferBytes).toEqual(data.sendBufferBytes);
        expect(gen.adaptiveConcurrency).toEqual(data.adaptiveConcurrency);
    }

    it('should create', () => {
        const gen = new General(
            data.noSleep,
            data.retryCount,
            data.maxActiveTransfers,
            data.autoMaxActiveTransfers,
            data.maxActiveChecksums,
            data.targetBandwidth,
            data.maxConnectionsPerHost,
            data.sendBufferBytes,
            data.adaptiveConcurrency,
        );

        validate(gen);
    });

    it('should convert from protobuf', () => {
        const pb = General.jsonToProtobuf(data);
        const gen = General.fromProtobuf(pb);
        validate(gen);
    });

    it('should convert from json', () => {
        const gen = General.fromJson(data);
        validate(gen);
    });
});

describe('HotFolders', () => {
    const data: ConfigInterfaces.ConfigHotFolders = {
        name: 'My HotFolder',
        enabled: true,
        localSourceFolder: '/path/to/hotfolder',
        remoteConfigurations: [
            {
                remoteConfigurationName: 'txp-name',
                s3DestinationFolder: 'prefix/in/bucket',
            },
        ],
        forceInitialUpload: true,
    };

    function validate(hf: HotFolders) {
        expect(hf).toBeTruthy();
        expect(hf.name).toEqual(data.name);
        expect(hf.enabled).toEqual(data.enabled);
        expect(hf.localSourceFolder).toEqual(data.localSourceFolder);
        expect(hf.forceInitialUpload).toEqual(data.forceInitialUpload);
    }

    it('should create', () => {
        const hf = new HotFolders(
            data.name,
            data.enabled,
            data.localSourceFolder,
            data.remoteConfigurations.map((itm) => HotFoldersTransferConfigurations.fromJson(itm)),
            data.forceInitialUpload,
        );

        validate(hf);
    });

    it('should convert from protobuf', () => {
        const pb = HotFolders.jsonToProtobuf(data);
        const hf = HotFolders.fromProtobuf(pb);
        validate(hf);
    });

    it('should convert from json', () => {
        const hf = HotFolders.fromJson(data);
        validate(hf);
    });
});

// The GUI saves the whole config and the daemon persists whatever it receives, so a proto
// field the mappers skip is silently reset to zero on the next save. These tests set every
// field of the schema to a non-default value and require it to survive a fromProtobuf ->
// jsonToProtobuf round trip, so they fail as soon as a new proto field is added without a
// matching mapper change.
describe('config mappers keep every proto field', () => {
    function nonDefaultScalar(scalar: ScalarType, n: number): unknown {
        switch (scalar) {
            case ScalarType.BOOL:
                return true;
            case ScalarType.STRING:
                return `value-${n}`;
            case ScalarType.BYTES:
                return new Uint8Array([n]);
            case ScalarType.INT64:
            case ScalarType.UINT64:
            case ScalarType.FIXED64:
            case ScalarType.SFIXED64:
            case ScalarType.SINT64:
                return BigInt(n);
            default:
                return n; // 32-bit integers, float and double
        }
    }

    function nonDefaultValue(field: DescField, n: number): unknown {
        switch (field.fieldKind) {
            case 'scalar':
                return nonDefaultScalar(field.scalar, n);
            case 'enum':
                return field.enum.values[field.enum.values.length - 1].number;
            case 'message':
                return filled(field.message);
            case 'list':
                if (field.listKind === 'message') {
                    return [filled(field.message)];
                }
                if (field.listKind === 'enum') {
                    return [field.enum.values[field.enum.values.length - 1].number];
                }
                return [nonDefaultScalar(field.scalar, n)];
            default:
                throw new Error(`${field.fieldKind} field ${field.name} is not handled; extend this helper`);
        }
    }

    /** A message of the given schema with every field set to a non-default value. */
    function filled<Desc extends DescMessage>(schema: Desc): MessageShape<Desc> {
        const message = create(schema);
        const fields = message as unknown as Record<string, unknown>;
        schema.fields.forEach((field, i) => {
            if (field.oneof) {
                throw new Error(`oneof field ${field.name} is not handled; extend this helper`);
            }
            fields[field.localName] = nonDefaultValue(field, i + 1);
        });
        return message;
    }

    function unsetFields<Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc>): string[] {
        return schema.fields.filter((field) => !isFieldSet(message, field)).map((field) => field.name);
    }

    it('GeneralSettings', () => {
        const original = filled(proto.GeneralSettingsSchema);
        expect(unsetFields(proto.GeneralSettingsSchema, original)).toEqual([]);
        expect(General.jsonToProtobuf(General.fromProtobuf(original))).toEqual(original);
    });

    it('UploadHotFolderSettings', () => {
        const original = filled(proto.UploadHotFolderSettingsSchema);
        expect(unsetFields(proto.UploadHotFolderSettingsSchema, original)).toEqual([]);
        expect(HotFolders.jsonToProtobuf(HotFolders.fromProtobuf(original))).toEqual(original);
    });

    it('a whole config from the daemon keeps them through FmeConfig', () => {
        const message = create(proto.GRPCFmeConfigSchema, {
            general: filled(proto.GeneralSettingsSchema),
            logging: {},
            reports: {},
            protocols: {s3: {}},
            uploadHotFolders: [filled(proto.UploadHotFolderSettingsSchema)],
        });
        const saved = FmeConfig.fromProtobuf(message).toProtobuf();
        expect(saved.general).toEqual(message.general);
        expect(saved.uploadHotFolders).toEqual(message.uploadHotFolders);
    });
});

describe('HotFolderTransferConfigurations', () => {
    const data: ConfigInterfaces.HotFolderTransferConfigurations = {
        remoteConfigurationName: 'txp-name',
        s3DestinationFolder: 'prefix/in/bucket',
    };

    it('should create', () => {
        const hf = new HotFoldersTransferConfigurations(
            data.remoteConfigurationName,
            data.s3DestinationFolder,
        );

        expect(hf).toBeTruthy();
        expect(hf.remoteConfigurationName).toEqual(data.remoteConfigurationName);
        expect(hf.s3DestinationFolder).toEqual(data.s3DestinationFolder);
    });

    it('should convert from protobuf', () => {
        const pb = HotFoldersTransferConfigurations.jsonToProtobuf(data);
        const hf = HotFoldersTransferConfigurations.fromProtobuf(pb);

        expect(hf).toBeTruthy();
        expect(hf.remoteConfigurationName).toEqual(data.remoteConfigurationName);
        expect(hf.s3DestinationFolder).toEqual(data.s3DestinationFolder);
    });

    it('should convert from json', () => {
        const hf = HotFoldersTransferConfigurations.fromJson(data);

        expect(hf).toBeTruthy();
        expect(hf.remoteConfigurationName).toEqual(data.remoteConfigurationName);
        expect(hf.s3DestinationFolder).toEqual(data.s3DestinationFolder);
    });
});

describe('Logging', () => {
    const data: ConfigInterfaces.ConfigLogging = {
        directory: '/path/to/log/dir',
        severity: 'INFO',
        maxSize: 10,
        maxAge: 7,
        compress: true,
    };

    function validate(log: Logging) {
        expect(log).toBeTruthy();
        expect(log.directory).toEqual(data.directory);
        expect(log.severity).toEqual(data.severity);
        expect(log.maxSize).toEqual(data.maxSize);
        expect(log.maxAge).toEqual(data.maxAge);
        expect(log.compress).toEqual(data.compress);
    }

    it('should create', () => {
        const log = new Logging(
            data.compress,
            data.directory,
            data.maxAge,
            data.maxSize,
            data.severity,
        );

        validate(log);
    });

    it('should convert from protobuf', () => {
        const pb = Logging.jsonToProtobuf(data);
        const log = Logging.fromProtobuf(pb);
        validate(log);
    });

    it('should convert from json', () => {
        const log = Logging.fromJson(data);
        validate(log);
    });
});

describe('Reports', () => {
    const reportDir = '/path/to/reports';
    it('should create', () => {
        const report = new Reports(reportDir);

        expect(report).toBeTruthy();
        expect(report.directory).toEqual(reportDir);
    });

    it('should convert from protobuf', () => {
        const pb = Reports.jsonToProtobuf({directory: reportDir});
        const report = Reports.fromProtobuf(pb);

        expect(report).toBeTruthy();
        expect(report.directory).toEqual(reportDir);
    });

    it('should convert from json', () => {
        const report = Reports.fromJson({directory: reportDir});

        expect(report).toBeTruthy();
        expect(report.directory).toEqual(reportDir);
    });
});

describe('Protocols', () => {
    const s3 = new S3Config({name: txpData});

    it('should create', () => {
        const p = new Protocols(s3);
        expect(p).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const s3Data = {
            transferProfiles: {name: txpData},
        };
        const pb = Protocols.jsonToProtobuf({s3: s3Data});

        const p = Protocols.fromProtobuf(pb);
        expect(p).toBeTruthy();
    });
});


describe('S3Config', () => {
    function validateS3(s3: S3Config) {
        for (const [name, txp] of Object.entries(s3['transferProfiles'])) {
            expect(txp).toBeTruthy();
            expect(txp.name).toEqual('name');
            expect(txp.name).toEqual(name);
            expect(txp.bucket).toEqual('bucket');
            expect(txp.region).toEqual('us-west-2');
            expect(txp.profile).toEqual('profile-name');
            expect(txp.accelerated).toEqual(false);
            expect(txp.fileOrder).toEqual([]);
            expect(txp.enableMetadataFilter).toEqual(false);
            expect(txp.storageClass).toEqual('STANDARD');
            expect(txp.paths).toEqual(txpData.paths);
            expect(txp.chunkSize).toEqual(25);
            expect(txp.threads).toEqual(10);
            expect(txp.maxAge).toEqual('');
            expect(txp.filter).toEqual('');
            expect(txp.checksums).toEqual(txpData.checksums);
            expect(txp.autoTuning).toEqual(true);
            expect(txp.endpoint).toEqual('');
        }
    }

    it('should create', () => {
        const s3 = new S3Config({name: txpData});
        validateS3(s3);
    });

    it('should convert from protobuf', () => {
        const s3Data = {
            transferProfiles: {name: txpData},
        };
        const pb = S3Config.jsonToProtobuf(s3Data);

        const s3 = S3Config.fromProtobuf(pb);
        validateS3(s3);
    });

    it('should convert from json', () => {
        const s3 = S3Config.fromJson({transferProfiles: {name: txpData}});
        validateS3(s3);
    });
});

describe('TransferProfile', () => {
    function validateTxp(t: TransferProfile) {
        expect(t).toBeTruthy();
        expect(t.name).toEqual(txpData.name);
        expect(t.bucket).toEqual(txpData.bucket);
        expect(t.region).toEqual(txpData.region);
        expect(t.profile).toEqual(txpData.profile);
        expect(t.accelerated).toEqual(txpData.accelerated);
        expect(t.fileOrder).toEqual(txpData.fileOrder);
        expect(t.enableMetadataFilter).toEqual(txpData.enableMetadataFilter);
        expect(t.storageClass).toEqual(txpData.storageClass);
        expect(t.paths).toEqual(txpData.paths);
        expect(t.chunkSize).toEqual(txpData.chunkSize);
        expect(t.threads).toEqual(txpData.threads);
        expect(t.maxAge).toEqual(txpData.maxAge);
        expect(t.filter).toEqual(txpData.filter);
        expect(t.checksums).toEqual(txpData.checksums);
        expect(t.autoTuning).toEqual(txpData.autoTuning);
        expect(t.endpoint).toEqual(txpData.endpoint);
    }

    it('should create', () => {
        const t = new TransferProfile(
            txpData.name,
            txpData.bucket,
            txpData.region,
            txpData.profile,
            txpData.accelerated,
            txpData.fileOrder,
            txpData.enableMetadataFilter,
            txpData.storageClass,
            txpData.paths,
            txpData.chunkSize,
            txpData.threads,
            txpData.maxAge,
            txpData.filter,
            txpData.checksums,
            txpData.autoTuning,
            txpData.endpoint,
        );

        validateTxp(t);
    });

    it('should convert from protobuf', () => {
        const pb = TransferProfile.jsonToProtobuf(txpData);

        const t = TransferProfile.fromProtobuf(pb);
        validateTxp(t);
    });

    it('should convert from protobuf without paths', () => {
        const pb = TransferProfile.jsonToProtobuf(txpData);
        pb.paths = undefined;

        setCommonPbTxpData(pb, txpData);

        const t = TransferProfile.fromProtobuf(pb);
        validateTxp(t);
    });

    it('should convert from json', () => {
        const t = TransferProfile.fromJson(txpData);
        validateTxp(t);
    });
});

describe('Paths', () => {
    it('should create', () => {
        const p = new Paths('/tmp', 'prefixA/');
        expect(p).toBeTruthy();
        expect(p.local).toEqual('/tmp');
        expect(p.remote).toEqual('prefixA/');
    });

    it('should convert from protobuf', () => {
        const pb = Paths.jsonToProtobuf({
            local: '/tmp',
            remote: 'prefixA/',
        });

        const p = Paths.fromProtobuf(pb);
        expect(p).toBeTruthy();
        expect(p.local).toEqual('/tmp');
        expect(p.remote).toEqual('prefixA/');
    });

    it('should convert from json', () => {
        const p = Paths.fromJson({
            local: '/tmp',
            remote: 'prefixA/',
        });

        expect(p).toBeTruthy();
        expect(p.local).toEqual('/tmp');
        expect(p.remote).toEqual('prefixA/');
    });
});

describe('Checksums', () => {
    it('should create', () => {
        const c = new Checksums(false, 'none');
        expect(c).toBeTruthy();
        expect(c.enabled).toBeFalsy();
        expect(c.algorithm).toEqual('none');
    });

    it('should convert from protobuf', () => {
        const pb = Checksums.jsonToProtobuf({
            enabled: true,
            algorithm: 'md5',
        });
        const c = Checksums.fromProtobuf(pb);

        expect(c).toBeTruthy();
        expect(c.enabled).toBeTruthy();
        expect(c.algorithm).toEqual('md5');
    });

    it('should convert from json', () => {
        const c = Checksums.fromJson({enabled: true, algorithm: 'xxhash'});
        expect(c).toBeTruthy();
        expect(c.enabled).toBeTruthy();
        expect(c.algorithm).toEqual('xxhash');
    });
});

function setCommonPbTxpData(pb: proto.TransferProfile, inputConfig: ConfigInterfaces.ConfigTransferProfile) {
    pb.name = inputConfig.name;
    pb.bucket = inputConfig.bucket;
    pb.region = inputConfig.region;
    pb.profile = inputConfig.profile;
    pb.accelerated = inputConfig.accelerated;
    pb.fileOrder = inputConfig.fileOrder;
    pb.enableMetadataFilter = inputConfig.enableMetadataFilter;
    pb.storageClass = inputConfig.storageClass;
    pb.chunkSize = inputConfig.chunkSize;
    pb.threads = inputConfig.threads;
    pb.maxAge = inputConfig.maxAge;
    pb.filter = inputConfig.filter;
    pb.autoTuning = inputConfig.autoTuning;
    pb.endpoint = inputConfig.endpoint;
}


describe('NotificationDestination', () => {
    const data: ConfigInterfaces.NotificationDestination = {
        name: 'studio-slack',
        preset: NotificationPreset.SLACK,
        notifyOnFinish: true,
        notifyOnFailure: false,
        isDefault: true,
        hasUrl: true,
        urlHint: '...9f2a',
    };

    it('should create', () => {
        const d = new NotificationDestination(
            data.name, data.preset, data.notifyOnFinish, data.notifyOnFailure,
            data.isDefault, data.hasUrl, data.urlHint,
        );
        expect(d).toBeTruthy();
        expect(d.name).toEqual('studio-slack');
        expect(d.preset).toEqual(NotificationPreset.SLACK);
    });

    it('should round-trip every field through protobuf', () => {
        const pb = NotificationDestination.jsonToProtobuf(data);
        const d = NotificationDestination.fromProtobuf(pb);
        expect(d).toEqual(data);
    });

    it('should convert from json', () => {
        const d = NotificationDestination.fromJson(data);
        expect(d.notifyOnFinish).toBeTruthy();
        expect(d.notifyOnFailure).toBeFalsy();
        expect(d.isDefault).toBeTruthy();
        expect(d.hasUrl).toBeTruthy();
        expect(d.urlHint).toEqual('...9f2a');
    });
});

describe('Notifications', () => {
    const data: ConfigInterfaces.Notifications = {
        notifyAllTransfers: true,
        destinations: [
            {
                name: 'studio-teams',
                preset: NotificationPreset.TEAMS,
                notifyOnFinish: false,
                notifyOnFailure: true,
                isDefault: false,
                hasUrl: true,
                urlHint: '...abcd',
            },
        ],
    };

    it('should round-trip destinations and the global toggle through protobuf', () => {
        const pb = Notifications.jsonToProtobuf(data);
        const n = Notifications.fromProtobuf(pb);
        expect(n.notifyAllTransfers).toBeTruthy();
        expect(n.destinations).toHaveLength(1);
        expect(n.destinations[0]).toEqual(data.destinations[0]);
    });

    it('should convert from json', () => {
        const n = Notifications.fromJson(data);
        expect(n.destinations).toHaveLength(1);
        expect(n.destinations[0].preset).toEqual(NotificationPreset.TEAMS);
    });

    it('should handle an empty destination list', () => {
        const n = Notifications.fromJson({destinations: [], notifyAllTransfers: false});
        expect(n.destinations).toHaveLength(0);
        expect(Notifications.jsonToProtobuf(n).destinations).toHaveLength(0);
    });
});