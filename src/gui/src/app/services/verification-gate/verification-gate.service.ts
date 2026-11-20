import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { ConfirmationModalComponent } from '@app/components/modals/confirmation-modal/confirmation-modal.component';
import { ConfirmationModalData } from '@app/components/modals/confirmation-modal/confirmation-modal.interfaces';
import { verificationGateDialog } from '@app/components/modals/confirmation-modal/confirmation-modal.constants';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { selectAll as jobSelectAll } from '@state/job/job.selectors';
import { Job, JobStatus } from '@state/models/job.model';

/**
 * Raises the pre-upload ASC MHL verification gate when a job enters NEEDS_REVIEW.
 *
 * This lives in an always-on service (initialized at app startup) rather than the
 * jobs-table component, because the jobs table is only mounted while the Jobs tray
 * is expanded - so a component-bound gate would never fire when the tray is
 * collapsed. Watching the store here means the dialog appears as soon as a job
 * pauses for review, regardless of what the user has open.
 *
 * Multiple jobs are handled with a queue: one dialog at a time, in arrival order.
 * Each job carries its own verification result and its own Stop / Upload-anyway
 * decision, so resolving one opens the next rather than batching them together.
 */
@Injectable({
    providedIn: 'root',
})
export class VerificationGateService {
    private readonly store = inject(Store);
    private readonly dialog = inject(MatDialog);
    private readonly fmeClientService = inject(FmeClientService);
    private readonly notifications = inject(NotificationsService);
    private readonly destroyRef = inject(DestroyRef);

    // Freshest job snapshot by id, so the dialog always reads the latest counts.
    private readonly latest = new Map<string, Job>();
    // Job ids queued for (or currently in) review, so a job is prompted once.
    private readonly pending = new Set<string>();
    private queue: string[] = [];
    private dialogOpen = false;

    init() {
        this.store.select(jobSelectAll).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe((jobs) => this.onJobs(jobs));
    }

    /**
     * Re-open the gate for a specific job (the "Review" row action), e.g. if the
     * user wants to revisit a job still parked in NEEDS_REVIEW.
     *
     * @param job {Job} Job awaiting review.
     */
    openGate(job: Job) {
        this.latest.set(job.id, job);
        if (!this.pending.has(job.id)) {
            this.pending.add(job.id);
            this.queue.push(job.id);
        }
        this.pump();
    }

    private onJobs(jobs: Job[]) {
        const needsReview = new Set<string>();
        for (const job of jobs) {
            this.latest.set(job.id, job);
            if (job.status !== JobStatus.NeedsReview) {
                continue;
            }
            needsReview.add(job.id);
            if (!this.pending.has(job.id)) {
                this.pending.add(job.id);
                this.queue.push(job.id);
            }
        }
        // Drop jobs that left NEEDS_REVIEW out-of-band (cancelled/resolved elsewhere).
        for (const id of [...this.pending]) {
            if (!needsReview.has(id)) {
                this.pending.delete(id);
                this.queue = this.queue.filter((queued) => queued !== id);
            }
        }
        this.pump();
    }

    /**
     * Open the next queued gate if none is currently showing. Re-entrant-safe: a
     * second call while a dialog is open is a no-op; the dialog's close handler
     * calls pump() again to drain the queue.
     *
     * @private
     */
    private pump() {
        if (this.dialogOpen || this.queue.length === 0) {
            return;
        }
        const jobId = this.queue[0];
        const job = this.latest.get(jobId);
        if (!job) {
            // Stale id with no snapshot; drop it and continue.
            this.queue.shift();
            this.pending.delete(jobId);
            this.pump();
            return;
        }

        this.dialogOpen = true;
        this.dialog.open<ConfirmationModalComponent, Partial<ConfirmationModalData>, boolean>(
            ConfirmationModalComponent,
            verificationGateDialog(
                job.ascMhlProblems ?? 0,
                job.ascMhlVerified ?? 0,
                job.ascMhlListed ?? 0,
                job.ascMhlAlgorithm,
            ),
        ).afterClosed().subscribe((proceed) => {
            this.dialogOpen = false;
            this.queue.shift();
            this.pending.delete(jobId);
            this.resolve(jobId, proceed === true);
            this.pump();
        });
    }

    /**
     * Send the operator's decision to the daemon.
     *
     * @param jobId {string} Job awaiting review.
     * @param proceed {boolean} true to upload anyway, false to stop.
     * @private
     */
    private resolve(jobId: string, proceed: boolean) {
        this.fmeClientService.resolveVerificationGate(jobId, proceed).subscribe({
            error: () => {
                this.notifications.error('Unable to resolve verification review');
            },
        });
    }
}
