import { Component, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { Store } from '@ngrx/store';
import { JobsTableComponent } from '@containers/tables/jobs-table/jobs-table.component';
import { LogsTableComponent } from '@containers/tables/logs-table/logs-table.component';
import { ReportsTableComponent } from '@containers/tables/reports-table/reports-table.component';
import { TrayStateService } from '@services/tray-state/tray-state.service';
import { BucketReportService } from '@services/bucket-report/bucket-report.service';
import { selectAll as jobSelectAll } from '@state/job/job.selectors';
import { PROGRESS_STATES } from '@state/models/job.model';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { formatBytes } from '@app/utils/utils';

@Component({
    selector: 'fme-table-group',
    templateUrl: './table-group.component.html',
    styleUrls: ['./table-group.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatTabGroup,
        MatTab,
        JobsTableComponent,
        LogsTableComponent,
        ReportsTableComponent,
    ],
})
export class TableGroupComponent {
    protected tray = inject(TrayStateService);
    private store = inject(Store);
    private bucketReport = inject(BucketReportService);
    private destroyRef = inject(DestroyRef);

    /** Number of in-progress transfers, for the collapsed summary bar. */
    activeJobs = signal(0);
    /** In-progress transfers split by direction, for the collapsed ↓/↑ summary. */
    downloadActive = signal(0);
    uploadActive = signal(0);
    /** Number of bucket reports still generating, for the collapsed summary bar indicator. */
    generatingReports = signal(0);
    /** Aggregate summary for the collapsed active bar (mockup: "3 jobs · 342 MB/s · X of Y · ETA"). */
    downloadSpeed = signal('');
    uploadSpeed = signal('');
    summaryTransferred = signal('');
    summaryTotal = signal('');
    summaryEta = signal('');

    constructor() {
        // A report is "generating" while its status is Started (Completed/Error are terminal).
        this.bucketReport.bucketReportData.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe((reports) => {
            this.generatingReports.set(reports.filter((report) => report.status === 'Started').length);
        });

        this.store.select(jobSelectAll).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe((jobs) => {
            const active = jobs.filter((job) => PROGRESS_STATES.includes(job.status));
            this.activeJobs.set(active.length);
            this.downloadActive.set(active.filter((job) => job.direction === TransferDirection.Download).length);
            this.uploadActive.set(active.filter((job) => job.direction === TransferDirection.Upload).length);

            // Aggregate throughput/bytes/ETA across the active transfers for the collapsed bar.
            // Speed is tracked per direction so the bar can show both ↓ and ↑ when uploads and
            // downloads run at once (a case the mockup didn't cover).
            let totalBytes = 0;
            let transferred = 0;
            let downloadBps = 0;
            let uploadBps = 0;
            const now = Date.now();
            for (const job of active) {
                totalBytes += job.totalBytes || 0;
                const done = job.bytesTransferred || 0;
                transferred += done;
                const start = job.timestampTransferring ?? job.timestampCreated;
                const elapsed = start ? (now - new Date(start).getTime()) / 1000 : 0;
                if (elapsed > 0) {
                    if (job.direction === TransferDirection.Download) {
                        downloadBps += done / elapsed;
                    } else {
                        uploadBps += done / elapsed;
                    }
                }
            }
            const remaining = Math.max(totalBytes - transferred, 0);
            const combinedBps = downloadBps + uploadBps;
            this.downloadSpeed.set(formatBytes(downloadBps, 1, 1000) + '/s');
            this.uploadSpeed.set(formatBytes(uploadBps, 1, 1000) + '/s');
            this.summaryTransferred.set(formatBytes(transferred, 1, 1000));
            this.summaryTotal.set(formatBytes(totalBytes, 1, 1000));
            this.summaryEta.set(this.formatEta(combinedBps > 0 ? remaining / combinedBps : Number.POSITIVE_INFINITY));
        });
    }

    /**
     * Summary-bar click. Toggles the tray; when opening with reports generating but no active
     * transfers, focuses the Bucket Reports tab so the click lands on the relevant content.
     */
    protected onSummaryClick(): void {
        if (!this.tray.collapsed()) {
            this.tray.collapse();
            return;
        }
        if (this.generatingReports() > 0 && this.activeJobs() === 0) {
            this.tray.showReports();
        } else {
            this.tray.expand();
        }
    }

    /**
     * Drag-resize the tray from its top edge. Updates the shared height signal live while
     * dragging (the parent grid reads it via --tray-height), then persists on release.
     */
    protected onResizeStart(event: PointerEvent): void {
        event.preventDefault();
        const startY = event.clientY;
        const startHeight = this.tray.expandedHeight();
        const onMove = (e: PointerEvent) => {
            // Dragging up (smaller clientY) grows the tray.
            this.tray.setExpandedHeight(startHeight + (startY - e.clientY));
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            this.tray.commitExpandedHeight();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
    }

    /** Human ETA for the collapsed summary bar (mockup "~2 min"). */
    private formatEta(seconds: number): string {
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return '—';
        }
        if (seconds < 60) {
            return `~${Math.round(seconds)} sec`;
        }
        if (seconds < 3600) {
            return `~${Math.round(seconds / 60)} min`;
        }
        return `~${Math.round(seconds / 3600)} hr`;
    }
}
