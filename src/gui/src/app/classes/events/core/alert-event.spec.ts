import { AlertEvent } from './alert-event';
import { create } from '@bufbuild/protobuf';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { AlertEventSchema, EventType } from '@gen/es/fme/v1/events_pb';

describe('AlertEvent', () => {
    it('should create an instance', () => {
        expect(new AlertEvent('', '')).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const ae = create(AlertEventSchema);
        ae.msg = 'Test';
        ae.level = 'info';

        pbEvt.eventType = EventType.ALERT_EVENT_TYPE;
        pbEvt.event = {
            case: 'alertEvent',
            value: ae,
        };

        const evt = AlertEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
        expect(evt).toBeInstanceOf(AlertEvent);
    });
});
