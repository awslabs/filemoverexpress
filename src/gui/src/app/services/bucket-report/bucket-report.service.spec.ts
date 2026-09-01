import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { BucketReportService } from './bucket-report.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { BaseEvent } from '@app/interfaces/events';
import { InventoryReportStatus } from '@app/classes/inventory-report';
import {
    InventoryReportStartedEvent,
    InventoryReportCompletedEvent,
    InventoryReportErrorEvent,
} from '@events/inventory';

/**
 * Minimal FmeClientService stub: exposes a controllable events$ Subject the
 * service subscribes to in its constructor, plus a processStreamError spy.
 */
class FmeClientServiceStub {
    readonly eventsSubject = new Subject<BaseEvent>();
    readonly processStreamError = vi.fn();

    get events$() {
        return this.eventsSubject.asObservable();
    }
}

class NotificationsServiceStub {
    readonly info = vi.fn();
    readonly success = vi.fn();
    readonly error = vi.fn();
    readonly warning = vi.fn();
    readonly default = vi.fn();
}

describe('BucketReportService', () => {
    let service: BucketReportService;
    let fmeClient: FmeClientServiceStub;
    let notifications: NotificationsServiceStub;

    beforeEach(() => {
        fmeClient = new FmeClientServiceStub();
        notifications = new NotificationsServiceStub();

        TestBed.configureTestingModule({
            providers: [
                BucketReportService,
                {provide: FmeClientService, useValue: fmeClient},
                {provide: NotificationsService, useValue: notifications},
            ],
        });
        service = TestBed.inject(BucketReportService);
    });

    const startedEvent = (
        reportId: string,
        bucket: string,
        prefix: string,
        startTime = new Date('2026-01-01T00:00:00Z'),
    ): InventoryReportStartedEvent =>
        new InventoryReportStartedEvent(reportId, 'profile-a', bucket, prefix, startTime);

    const completedEvent = (
        reportId: string,
        bucket: string,
        prefix: string,
        outputFile = 's3://out/report.json',
        completeTime = new Date('2026-01-01T01:00:00Z'),
    ): InventoryReportCompletedEvent =>
        new InventoryReportCompletedEvent(reportId, 'profile-a', bucket, prefix, outputFile, completeTime);

    const errorEvent = (
        reportId: string,
        bucket: string,
        prefix: string,
        error = 'boom',
    ): InventoryReportErrorEvent =>
        new InventoryReportErrorEvent(reportId, 'profile-a', bucket, prefix, error);

    const currentData = (): Promise<InventoryReportStatus[]> => firstValueFrom(service.bucketReportData);

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('emits an empty report list initially', async () => {
        await expect(currentData()).resolves.toEqual([]);
    });

    describe('start events', () => {
        it('adds a Started record and emits an info notification with prefix', async () => {
            fmeClient.eventsSubject.next(startedEvent('r1', 'my-bucket', 'photos/'));

            const data = await currentData();
            expect(data).toHaveLength(1);
            expect(data[0].reportId).toBe('r1');
            expect(data[0].bucket).toBe('my-bucket');
            expect(data[0].prefix).toBe('photos/');
            expect(data[0].status).toBe('Started');
            expect(data[0].completed).toBeNull();
            expect(data[0].outputFile).toBeNull();
            expect(notifications.info).toHaveBeenCalledWith(
                'Bucket report for bucket my-bucket/photos/ has been started',
            );
        });

        it('omits the prefix from the message when it is blank', async () => {
            fmeClient.eventsSubject.next(startedEvent('r2', 'no-prefix-bucket', '   '));

            await currentData();
            expect(notifications.info).toHaveBeenCalledWith(
                'Bucket report for bucket no-prefix-bucket has been started',
            );
        });

        it('warns and does not throw when processing the start event fails', () => {
            notifications.info.mockImplementationOnce(() => {
                throw new Error('notification failure');
            });

            expect(() => fmeClient.eventsSubject.next(startedEvent('r3', 'b', 'p'))).not.toThrow();
            expect(notifications.warning).toHaveBeenCalledWith(
                'Cannot save bucket report generation start status.',
            );
        });
    });

    describe('complete events', () => {
        it('updates an existing Started record to Completed', async () => {
            fmeClient.eventsSubject.next(startedEvent('r10', 'bkt', 'p/'));
            const completeTime = new Date('2026-02-02T02:02:00Z');
            fmeClient.eventsSubject.next(completedEvent('r10', 'bkt', 'p/', 's3://out/r10.json', completeTime));

            const data = await currentData();
            expect(data).toHaveLength(1);
            expect(data[0].status).toBe('Completed');
            expect(data[0].completed).toBe(completeTime);
            expect(data[0].outputFile).toBe('s3://out/r10.json');
            expect(notifications.success).toHaveBeenCalledWith('Bucket report for bucket bkt/p/ is ready');
        });

        it('appends a Completed record when no matching Started record exists', async () => {
            fmeClient.eventsSubject.next(completedEvent('orphan', 'bkt2', ''));

            const data = await currentData();
            expect(data).toHaveLength(1);
            expect(data[0].reportId).toBe('orphan');
            expect(data[0].status).toBe('Completed');
            expect(notifications.success).toHaveBeenCalledWith('Bucket report for bucket bkt2 is ready');
        });

        it('warns and does not throw when processing the complete event fails', () => {
            notifications.success.mockImplementationOnce(() => {
                throw new Error('notification failure');
            });

            expect(() => fmeClient.eventsSubject.next(completedEvent('r11', 'b', 'p'))).not.toThrow();
            expect(notifications.warning).toHaveBeenCalledWith(
                'Cannot save bucket report generation complete status.',
            );
        });
    });

    describe('error events', () => {
        it('updates an existing record to Error and sets a completed timestamp', async () => {
            fmeClient.eventsSubject.next(startedEvent('r20', 'errbkt', 'pre/'));
            fmeClient.eventsSubject.next(errorEvent('r20', 'errbkt', 'pre/', 'disk full'));

            const data = await currentData();
            expect(data).toHaveLength(1);
            expect(data[0].status).toBe('Error');
            expect(data[0].completed).toBeInstanceOf(Date);
            expect(notifications.error).toHaveBeenCalledWith(
                'Error generating report for bucket errbkt/pre/: disk full',
            );
        });

        it('appends an Error record when no matching record exists and prefix is blank', async () => {
            fmeClient.eventsSubject.next(errorEvent('orphan-err', 'errbkt2', '', 'nope'));

            const data = await currentData();
            expect(data).toHaveLength(1);
            expect(data[0].reportId).toBe('orphan-err');
            expect(data[0].status).toBe('Error');
            expect(notifications.error).toHaveBeenCalledWith(
                'Error generating report for bucket errbkt2: nope',
            );
        });

        it('warns and does not throw when processing the error event fails', () => {
            notifications.error.mockImplementationOnce(() => {
                throw new Error('notification failure');
            });

            expect(() => fmeClient.eventsSubject.next(errorEvent('r21', 'b', 'p'))).not.toThrow();
            expect(notifications.warning).toHaveBeenCalledWith(
                'Cannot save bucket report error complete status.',
            );
        });
    });

    describe('clearBucketReportData', () => {
        it('resets the report list to empty', async () => {
            fmeClient.eventsSubject.next(startedEvent('r30', 'bkt', 'p/'));
            await expect(currentData()).resolves.toHaveLength(1);

            service.clearBucketReportData();
            await expect(currentData()).resolves.toEqual([]);
        });
    });

    describe('ngOnDestroy', () => {
        it('unsubscribes so later events no longer mutate the report list', async () => {
            service.ngOnDestroy();
            fmeClient.eventsSubject.next(startedEvent('r40', 'bkt', 'p/'));

            await expect(currentData()).resolves.toEqual([]);
            expect(notifications.info).not.toHaveBeenCalled();
        });
    });
});
