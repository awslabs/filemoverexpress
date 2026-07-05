import { describe, it, expect } from 'vitest';
import { MessageEvent } from './message-event';
import { create } from '@bufbuild/protobuf';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { EventType, MessageEventSchema } from '@gen/es/fme/v1/events_pb';

describe('MessageEvent', () => {
    it('should create an instance', () => {
        expect(new MessageEvent('', '')).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const me = create(MessageEventSchema);
        me.msg = 'Test';

        pbEvt.eventType = EventType.MESSAGE_EVENT_TYPE;
        pbEvt.event = {
            case: 'messageEvent',
            value: me,
        };

        const evt = MessageEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
        expect(evt).toBeInstanceOf(MessageEvent);
    });
});
