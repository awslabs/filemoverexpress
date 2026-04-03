import { inject, Injectable, OnDestroy } from '@angular/core';
import { InventoryReportStatus } from '@app/classes/inventory-report';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { InventoryReportCompletedEvent, InventoryReportErrorEvent, InventoryReportStartedEvent } from '@events/inventory';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { filter } from 'rxjs/operators';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { NotificationsService } from '@services/notifications/notifications.service';

const retry_count = 5;

@Injectable({
    providedIn: 'root',
})
export class BucketReportService implements OnDestroy {
    private readonly inventoryReportData$: BehaviorSubject<InventoryReportStatus[]> = new BehaviorSubject<InventoryReportStatus[]>([]);
    private _inventoryReportData: InventoryReportStatus[] = [];
    private subscriptions: Subscription[] = [];
    private fmeClientService = inject(FmeClientService);
    private notifications = inject(NotificationsService);

    constructor() {
        this.subscriptions.push(this.fmeClientService.events$.pipe(
            filter((evt) => evt instanceof InventoryReportStartedEvent),
            handleStreamError({retryCount: retry_count}),
        ).subscribe({
            next: (evt) => {
                try {
                    this.processStartEvent(evt as InventoryReportStartedEvent);
                } catch (e) {
                    console.error(e);
                    this.notifications.warning('Cannot save bucket report generation start status.');
                }
            },
            error: (error) => {
                this.fmeClientService.processStreamError(error);
            },
        }));

        this.subscriptions.push(this.fmeClientService.events$.pipe(
                filter((evt) => evt instanceof InventoryReportCompletedEvent),
                handleStreamError({retryCount: retry_count}),
            ).subscribe({
                next: (evt) => {
                    try {
                        this.processCompleteEvent(evt as InventoryReportCompletedEvent);
                    } catch (e) {
                        console.error(e);
                        this.notifications.warning('Cannot save bucket report generation complete status.');
                    }
                },
                error: (error) => {
                    this.fmeClientService.processStreamError(error);
                },
            }),
        );

        this.subscriptions.push(this.fmeClientService.events$.pipe(
                filter((evt) => evt instanceof InventoryReportErrorEvent),
                handleStreamError({retryCount: 5}),
            ).subscribe({
                next: (evt) => {
                    try {
                        this.processErrorEvent(evt as InventoryReportErrorEvent);
                    } catch (e) {
                        console.error(e);
                        this.notifications.warning('Cannot save bucket report error complete status.');
                    }
                },
                error: (error) => {
                    this.fmeClientService.processStreamError(error);
                },
            }),
        );
    }

    ngOnDestroy() {
        this.subscriptions.map((sub) => sub.unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Get observable for bucket report data
     */
    get bucketReportData(): Observable<InventoryReportStatus[]> {
        return this.inventoryReportData$ as Observable<InventoryReportStatus[]>;
    }

    /**
     * Use this to clear the bucket report data
     */
    clearBucketReportData() {
        this._inventoryReportData = [];
        this.inventoryReportData$.next(this._inventoryReportData);
    }

    /**
     * Process bucket report start event
     * @param evt InventoryReportStartedEvent
     */
    private processStartEvent(evt: InventoryReportStartedEvent) {
        let message: string;
        if (evt.prefix?.trim()) {
            message = `Bucket report for bucket ${evt.bucket}/${evt.prefix} has been started`;
        } else {
            message = `Bucket report for bucket ${evt.bucket} has been started`;
        }

        const inventoryReportStatus = new InventoryReportStatus(
            evt.reportId,
            evt.transferProfile,
            evt.bucket,
            evt.prefix,
            'Started',
            evt.startTime,
            null,
            null,
        );
        this._inventoryReportData.push(inventoryReportStatus);
        this.notifications.info(message);
        this.inventoryReportData$.next(this._inventoryReportData);
    }

    /**
     * Process the bucket report complete event
     * @param evt InventoryReportCompleteEvent
     */
    private processCompleteEvent(evt: InventoryReportCompletedEvent) {
        let message: string;
        if (evt.prefix && evt.prefix !== '') {
            message = `Bucket report for bucket ${evt.bucket}/${evt.prefix} is ready`;
        } else {
            message = `Bucket report for bucket ${evt.bucket} is ready`;
        }
        this.notifications.success(message);

        const foundRecords = this._inventoryReportData.filter((record: InventoryReportStatus) => {
            return record.reportId === evt.reportId;
        });
        if (foundRecords.length) {
            for (const record of foundRecords) {
                record.status = 'Completed';
                record.completed = evt.completeTime;
                record.outputFile = evt.outputFile;
            }
        } else {
            this._inventoryReportData.push(new InventoryReportStatus(
                evt.reportId,
                evt.transferProfile,
                evt.bucket,
                evt.prefix,
                'Completed',
                new Date(),
                evt.completeTime,
                evt.outputFile,
            ));
        }
        this.inventoryReportData$.next(this._inventoryReportData);
    }

    /**
     * Process the bucket report Error event
     * @param evt InventoryReportErrorEvent
     */
    private processErrorEvent(evt: InventoryReportErrorEvent) {
        let message: string;
        if (evt.prefix && evt.prefix !== '') {
            message = `Error generating report for bucket ${evt.bucket}/${evt.prefix}: ${evt.error}`;
        } else {
            message = `Error generating report for bucket ${evt.bucket}: ${evt.error}`;
        }
        this.notifications.error(message);

        const foundErrorRecords = this._inventoryReportData.filter((record: InventoryReportStatus) => {
            return record.reportId === evt.reportId;
        });
        if (foundErrorRecords.length) {
            for (const record of foundErrorRecords) {
                record.status = 'Error';
                record.completed = new Date();
            }
        } else {
            this._inventoryReportData.push(new InventoryReportStatus(
                evt.reportId,
                evt.transferProfile,
                evt.bucket,
                evt.prefix,
                'Error',
                new Date(),
                new Date(),
                '',
            ));
        }
        this.inventoryReportData$.next(this._inventoryReportData);
    }
}
