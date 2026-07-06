import { describe, it, expect } from 'vitest';
import { UnsupportedVersionEvent } from './unsupported-version-event';
import { create } from '@bufbuild/protobuf';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { EventType, UnsupportedVersionEventSchema } from '@gen/es/fme/v1/events_pb';

const data = {
    newSupportedVersion: 'v1.5.0',
    currentVersion: 'v1.6.0',
    releaseNotes: ['release notes'],
};

describe('UnsupportedVersionEvent', () => {
    it('should create an instance', () => {
        expect(new UnsupportedVersionEvent(data.newSupportedVersion, data.currentVersion, data.releaseNotes)).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const uve = create(UnsupportedVersionEventSchema);
        Object.assign(uve, data);

        pbEvt.eventType = EventType.UNSUPPORTED_VERSION_EVENT_TYPE;
        pbEvt.event = {
            case: 'unsupportedVersionEvent',
            value: uve,
        };

        const evt = UnsupportedVersionEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
        expect(evt).toBeInstanceOf(UnsupportedVersionEvent);
    });
});
