import { InventoryReportCompletedEvent } from '../inventory';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { ListEventsResponseSchema } from '@gen/es/fme/v1/fme_service_pb';
import { InventoryReportCompletedEventSchema } from '@gen/es/fme/v1/inventory_pb';
import { EventType } from '@gen/es/fme/v1/events_pb';

describe('InventoryReportCompletedEvent', () => {
    const data = {
        reportId: 'testReportId',
        transferProfile: 'test-transfer-profile',
        bucket: 'my-bucket',
        prefix: '',
        outputFile: '/tmp/report.txt',
        completeTime: new Date(),
    };

    it('should create an instance', () => {
        const evt = new InventoryReportCompletedEvent(
            data.reportId,
            data.transferProfile,
            data.bucket,
            data.prefix,
            data.outputFile,
            data.completeTime,
        );

        expect(evt).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(ListEventsResponseSchema);
        const irce = create(InventoryReportCompletedEventSchema);
        Object.assign(
            irce,
            {
                ...data,
                completeTime: timestampFromDate(data.completeTime),
            },
        );
        pbEvt.eventType = EventType.INVENTORY_REPORT_COMPLETED_EVENT_TYPE;
        pbEvt.event = {
            case: 'inventoryReportCompletedEvent',
            value: irce,
        };

        const evt = InventoryReportCompletedEvent.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
    });
});
