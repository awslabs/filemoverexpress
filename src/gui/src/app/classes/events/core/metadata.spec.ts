import { MetadataEvent } from './metadata';
import { create } from '@bufbuild/protobuf';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { MetadataEventSchema } from '@gen/es/fme/v1/metadata_pb';
import { EventType } from '@gen/es/fme/v1/events_pb';

const data = {
    daemonMode: true,
    cpuCoreCount: 6,
    transferProfiles: {
        'transfer-profile-name': {
            local: '/',
            remote: '/',
        },
    },
    version: 'v1.2.3',
    permissions: {
        allowUiConfiguration: true,
        allowLocalRenameDelete: true,
        allowRemoteRenameDelete: false,
    },
    homePath: '/',
    daemonOs: 'darwin',
    connectionEvent: true,
    awsProfiles: ['default', 'test'],
    hotFolderSourceDirectories: [
        '/Users/me/my-hot-folder',
        '/Users/me/my-hot-folder2',
        '/Users/me/my-hot-folder3',
    ],
};

describe('MetadataEvent', () => {
    it('should create an instance', () => {
        const evt = new MetadataEvent(
            data.daemonMode,
            data.transferProfiles,
            data.cpuCoreCount,
            data.version,
            data.permissions,
            data.homePath,
            data.daemonOs,
            data.connectionEvent,
            data.awsProfiles,
            data.hotFolderSourceDirectories,
        );

        expect(evt).toBeTruthy();
        expect(evt.daemonMode).toBeTruthy();
        expect(Object.keys(evt.transferProfiles).length).toEqual(1);
        expect(evt.cpuCoreCount).toBe(6);
        expect(evt.version).toBe('v1.2.3');
        expect(evt.permissions.allowUiConfiguration).toBeTruthy();
        expect(evt.permissions.allowLocalRenameDelete).toBeTruthy();
        expect(evt.permissions.allowRemoteRenameDelete).toBeFalsy();
        expect(evt.homePath).toEqual('/');
        expect(evt.daemonOS).toEqual('darwin');
        expect(evt.connectionEvent).toBeTruthy();
        expect(evt.awsProfiles).toEqual(['default', 'test']);
        expect(evt.hotFolderSourceDirectories).toEqual([
            '/Users/me/my-hot-folder',
            '/Users/me/my-hot-folder2',
            '/Users/me/my-hot-folder3',
        ]);
    });

    it('should create an instance with defaults', () => {
        const evt = new MetadataEvent();
        expect(evt).toBeTruthy();

        expect(evt.daemonMode).toBeFalsy();
        expect(Object.keys(evt.transferProfiles).length).toBe(0);
        expect(evt.cpuCoreCount).toEqual(1);
        expect(evt.version).toBe('0.0.0');
        expect(evt.permissions.allowUiConfiguration).toBeFalsy();
        expect(evt.permissions.allowLocalRenameDelete).toBeFalsy();
        expect(evt.permissions.allowRemoteRenameDelete).toBeFalsy();
        expect(evt.homePath).toEqual('');
        expect(evt.daemonOS).toBe('');
        expect(evt.connectionEvent).toBeFalsy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const me = create(MetadataEventSchema);
        Object.assign(me, data);

        pbEvt.eventType = EventType.METADATA_EVENT_TYPE;
        pbEvt.event = {
            case: 'metadataEvent',
            value: me,
        };

        const evt = MetadataEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
        expect(evt).toBeInstanceOf(MetadataEvent);
    });
});
