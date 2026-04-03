import { InventoryReportErrorEvent } from './inventory-error-event';
import { create } from '@bufbuild/protobuf';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { InventoryReportErrorEventSchema } from '@gen/es/fme/v1/inventory_pb';
import { EventType } from '@gen/es/fme/v1/events_pb';

describe('InventoryReportErrorEvent', () => {
    const data = {
        reportId: 'report-id',
        transferProfile: 'tx-profile',
        bucket: 'my-bucket',
        prefix: '',
        error: 'Something went wrong',
    };

    it('should create an instance', () => {
        const evt = new InventoryReportErrorEvent(
            data.reportId,
            data.transferProfile,
            data.bucket,
            data.prefix,
            data.error,
        );

        expect(evt).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const iree = create(InventoryReportErrorEventSchema);
        Object.assign(iree, data);
        pbEvt.eventType = EventType.INVENTORY_REPORT_COMPLETED_EVENT_TYPE;
        pbEvt.event = {
            case: 'inventoryReportErrorEvent',
            value: iree,
        };

        const evt = InventoryReportErrorEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
    });
});
