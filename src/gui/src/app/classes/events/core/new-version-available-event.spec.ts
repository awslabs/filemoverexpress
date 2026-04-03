import { NewVersionAvailableEvent } from './new-version-available-event';
import { create } from '@bufbuild/protobuf';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { EventType, NewVersionAvailableEventSchema } from '@gen/es/fme/v1/events_pb';

const data = {
    newVersion: 'v1.6.0',
    currentVersion: 'v1.5.0',
    releaseNotes: ['release notes'],
};

describe('NewVersionAvailableEvent', () => {
    it('should create an instance', () => {
        expect(new NewVersionAvailableEvent(data.newVersion, data.currentVersion, data.releaseNotes)).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const nvae = create(NewVersionAvailableEventSchema);

        pbEvt.eventType = EventType.NEW_VERSION_AVAILABLE_EVENT_TYPE;
        pbEvt.event = {
            case: 'newVersionAvailableEvent',
            value: nvae,
        };

        const evt = NewVersionAvailableEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
        expect(evt).toBeInstanceOf(NewVersionAvailableEvent);
    });
});
