import { InventoryReportStartedEvent } from '../inventory';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { InventoryReportStartedEventSchema } from '@gen/es/fme/v1/inventory_pb';
import { EventType } from '@gen/es/fme/v1/events_pb';

describe('InventoryReportStartedEvent', () => {
    const data = {
        reportId: 'testReportId',
        transferProfile: 'test-transfer-profile',
        bucket: 'my-bucket',
        prefix: '',
        startTime: new Date(),
    };

    it('should create an instance', () => {
        const evt = new InventoryReportStartedEvent(
            data.reportId,
            data.transferProfile,
            data.bucket,
            data.prefix,
            data.startTime,
        );

        expect(evt).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const irse = create(InventoryReportStartedEventSchema);
        Object.assign(
            irse,
            {
                ...data,
                startTime: timestampFromDate(data.startTime),
            },
        );
        pbEvt.eventType = EventType.INVENTORY_REPORT_STARTED_EVENT_TYPE;
        pbEvt.event = {
            case: 'inventoryReportStartedEvent',
            value: irse,
        };

        const evt = InventoryReportStartedEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
    });
});
