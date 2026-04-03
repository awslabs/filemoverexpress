import { BaseEvent, EventLogLevel } from '@app/interfaces/events';
import { ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { MetadataEvent as ProtoMetadataEvent } from '@gen/es/fme/v1/metadata_pb';
import { MetadataTransferProfile, MetadataTransferProfiles, Permissions } from '@services/metadata/metadata.interfaces';

export const permissionKeys = {
    ALLOW_UI_CONFIGURATION: 'allow_ui_configuration',
    ALLOW_LOCAL_RENAME_DELETE: 'allow_local_rename_delete',
    ALLOW_REMOTE_RENAME_DELETE: 'allow_remote_rename_delete',
};

export class MetadataEvent implements BaseEvent {
    logLevel = EventLogLevel.Info;

    constructor(
        public daemonMode = false,
        public transferProfiles: MetadataTransferProfiles = {},
        public cpuCoreCount = 1,
        public version = '0.0.0',
        public permissions: Permissions = {
            allowUiConfiguration: false,
            allowLocalRenameDelete: false,
            allowRemoteRenameDelete: false,
        },
        public homePath = '',
        public daemonOS = '',
        public connectionEvent = false,
        public awsProfiles: string[] = [],
        public hotFolderSourceDirectories: string[] = [],
    ) {
    }

    get logMessage(): string {
        const txpNames = Object.keys(this.transferProfiles).join(', ');
        return `Metadata event received; Is connection event: ${this.connectionEvent ? 'yes' : 'no'}, ` +
            `Version: ${this.version}, ` +
            `Daemon mode: ${this.daemonMode ? 'yes' : 'false'}, ` +
            `CPU Cores: ${this.cpuCoreCount}, ` +
            `Allow UI Config: ${this.permissions.allowUiConfiguration ? 'yes' : 'no'}, ` +
            `Allow Local Rename and Delete: ${this.permissions.allowLocalRenameDelete ? 'yes' : 'no'}, ` +
            `Allow Remote Rename and Delete: ${this.permissions.allowRemoteRenameDelete ? 'yes' : 'no'}, ` +
            `Remote Configurations: ${txpNames}, ` +
            `Daemon OS: ${this.daemonOS}, ` +
            `AWS Profiles: ${this.awsProfiles.join(', ')}, ` +
            `Hot Folder Source Directories: ${this.hotFolderSourceDirectories.join(', ')}`;
    }

    public static fromProtobuf(event: ListEventsResponse): MetadataEvent {
        const evt = event.event.value as ProtoMetadataEvent;
        const txProfiles: Record<string, MetadataTransferProfile> = {};

        for (const [name, profile] of Object.entries(evt.transferProfiles)) {
            txProfiles[name] = {
                local: profile.local,
                remote: profile.remote,
            };
        }

        const permissions: Permissions = {
            allowUiConfiguration: evt.permissions[permissionKeys.ALLOW_UI_CONFIGURATION],
            allowLocalRenameDelete: evt.permissions[permissionKeys.ALLOW_LOCAL_RENAME_DELETE],
            allowRemoteRenameDelete: evt.permissions[permissionKeys.ALLOW_REMOTE_RENAME_DELETE],
        };

        return new MetadataEvent(
            evt.daemonMode,
            txProfiles,
            evt.cpuCoreCount,
            evt.version,
            permissions,
            evt.homePath,
            evt.daemonOs,
            evt.connectionEvent,
            evt.awsProfiles,
            evt.hotFolderSourceDirectories,
        );
    }
}
