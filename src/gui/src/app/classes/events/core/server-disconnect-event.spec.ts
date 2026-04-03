import { ServerDisconnectEvent } from './server-disconnect-event';
import { create } from '@bufbuild/protobuf';
import { DisconnectType, EventType, ServerDisconnectEventSchema } from '@gen/es/fme/v1/events_pb';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';

describe('ServerDisconnectEvent', () => {
    it('should create an instance', () => {
        expect(new ServerDisconnectEvent(DisconnectType.CLI_DOWNLOADS_COMPLETE_DISCONNECT_TYPE)).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const sde = create(ServerDisconnectEventSchema);
        sde.disconnectType = DisconnectType.CLI_DOWNLOADS_COMPLETE_DISCONNECT_TYPE;

        pbEvt.eventType = EventType.SERVER_DISCONNECT_EVENT_TYPE;
        pbEvt.event = {
            case: 'serverDisconnectEvent',
            value: sde,
        };

        const evt = ServerDisconnectEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
        expect(evt).toBeInstanceOf(ServerDisconnectEvent);
    });
});
