import { inject, Injectable } from '@angular/core';
import { BUCKET_FILE_BROWSER_ID } from '@app/components/layout/bucket-browser/bucket-browser.constants';
import { DAEMON_FILE_BROWSER_ID } from '@app/components/layout/daemon-browser/daemon-browser.constants';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { JobCompleteEvent, JobCreateEvent, JobErrorEvent, JobProgressEvent } from 'src/app/classes/events/job';
import { Store } from '@ngrx/store';
import * as JobActions from '@state/job/actions/job.actions';
import * as TransferStatsActions from '@state/transfer-stats/actions/transfer-stats.actions';
import { BaseEvent } from '@app/interfaces/events';
import { Job, JobStatus } from '@state/models/job.model';
import { JobUpdateEvent } from '@events/job/job-update-event';
import { TaskCompleteEvent } from '@events/job/task-complete-event';
import { FileBrowserService } from '@services/file-browser/file-browser.service';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { Update } from '@ngrx/entity';
import { JobStatusChangeEvent } from '@events/job/job-status-change-event';
import { JobChecksumProgressEvent } from '@events/job/job-checksum-progress-event';
import { TransferStatsEvent } from '@events/core';

@Injectable({
    providedIn: 'root',
})
export class TransferService {
    private readonly fmeClientService = inject(FmeClientService);
    private readonly store = inject(Store);
    private readonly fileBrowser = inject(FileBrowserService);

    constructor() {
        this.fmeClientService.events$.pipe(
            handleStreamError({retryCount: 5}),
        ).subscribe({
            next: (evt) => {
                try {
                    this.handleProgressEvent(evt);
                } catch (e) {
                    console.error(e);
                }
            },
            error: (error) => {
                this.fmeClientService.processStreamError(error);
            },
        });
    }

    init() {
        console.debug('Initializing Transfer service');
    }

    private handleProgressEvent(evt: BaseEvent) {
        switch (true) {
            case evt instanceof JobCreateEvent:
                this.handleJobCreateEvent(evt as JobCreateEvent);
                return;
            case evt instanceof JobStatusChangeEvent:
                this.handleJobStatusChangeEvent(evt as JobStatusChangeEvent);
                return;
            case evt instanceof JobProgressEvent:
                this.handleJobProgress(evt as JobProgressEvent);
                return;
            case evt instanceof JobCompleteEvent:
                this.handleJobComplete(evt as JobCompleteEvent);
                return;
            case evt instanceof JobErrorEvent:
                this.handleJobError(evt as JobErrorEvent);
                return;
            case evt instanceof JobUpdateEvent:
                this.handleJobUpdateEvent(evt as JobUpdateEvent);
                return;
            case evt instanceof JobChecksumProgressEvent:
                this.handleJobChecksumProgressEvent(evt as JobChecksumProgressEvent);
                return;
            case evt instanceof TaskCompleteEvent:
                this.handleTaskCompleteEvent(evt as TaskCompleteEvent);
                return;
            case evt instanceof TransferStatsEvent:
                this.handleTransferStatsEvent(evt as TransferStatsEvent);
                return;
        }
    }

    private handleJobCreateEvent(evt: JobCreateEvent) {
        const job: Job = {
            id: evt.id,
            name: evt.name,
            transferProfile: evt.transferProfile,
            status: JobStatus.Created,
            statusMessage: '',
            totalBytes: 0,
            bytesTransferred: 0,
            hasTaskErrors: false,
            hasSuccessfulTasks: false,
            lastUpdate: evt.created,
            direction: evt.direction,
            destination: evt.destination,
            eta: '',
            progress: 0,
            timestampCreated: evt.created,
            timestampDiscovering: null,
            timestampChecksumming: null,
            timestampTransferring: null,
            timestampCompleted: null,
            checksumProgress: null,
        };

        this.store.dispatch(JobActions.create({job}));
    }

    private handleJobProgress(evt: JobProgressEvent) {
        this.store.dispatch(JobActions.progress({
            job: {
                id: evt.id,
                changes: {
                    status: JobStatus.InProgress,
                    bytesTransferred: evt.bytesTransferred,
                    totalBytes: evt.totalBytes,
                    lastUpdate: new Date(),
                },
            },
        }));
    }

    private handleJobComplete(evt: JobCompleteEvent) {
        this.store.dispatch(JobActions.complete({
            job: {
                id: evt.id,
                changes: {
                    status: JobStatus.Completed,
                    hasTaskErrors: evt.hasTaskErrors,
                    hasSuccessfulTasks: evt.hasSuccessfulTasks,
                    lastUpdate: new Date(),
                },
            },
        }));
    }

    private handleJobError(evt: JobErrorEvent) {
        this.store.dispatch(JobActions.complete({
            job: {
                id: evt.id,
                changes: {
                    status: JobStatus.Error,
                    statusMessage: evt.error,
                    lastUpdate: evt.errorTime,
                },
            },
        }));
    }

    private handleJobUpdateEvent(evt: JobUpdateEvent) {
        this.store.dispatch(JobActions.update({
            job: {
                id: evt.jobId,
                changes: {
                    name: evt.name,
                },
            },
        }));
    }

    /**
     * Handles a task completion event by checking if file browsers need to be refreshed
     *
     * @param {TaskCompleteEvent} evt - TaskCompleteEvent received
     * @private
     */
    private handleTaskCompleteEvent(evt: TaskCompleteEvent) {
        if (evt.destination) {
            if (evt.direction === TransferDirection.Upload) {
                this.fileBrowser.sendAutoRefreshRequest(BUCKET_FILE_BROWSER_ID, evt.destination);
            } else {
                this.fileBrowser.sendAutoRefreshRequest(DAEMON_FILE_BROWSER_ID, evt.destination);
            }
        }
    }

    /**
     * Handles updating the status of a job and setting the proper timestamp as necessary
     * @param evt {JobStatusChangeEvent} Job Status Change Event
     *
     * @private
     */
    private handleJobStatusChangeEvent(evt: JobStatusChangeEvent) {
        const update: Update<Job> = {
            id: evt.id,
            changes: {
                status: evt.status,
            },
        };

        switch (evt.status) {
            case JobStatus.Created:
                update.changes.timestampCreated = evt.timestamp;
                break;

            case JobStatus.Discovering:
                update.changes.timestampDiscovering = evt.timestamp;
                break;

            case JobStatus.Checksumming:
                update.changes.timestampChecksumming = evt.timestamp;
                break;

            case JobStatus.InProgress:
                update.changes.timestampTransferring = evt.timestamp;
                break;

            case JobStatus.Completed:
                update.changes.timestampCompleted = evt.timestamp;
        }

        this.store.dispatch(JobActions.updateStatus({
            job: update,
        }));
    }

    /**
     * Handles Job Checksum Progress events
     * @param evt {JobChecksumProgressEvent} JobChecksumProgressEvent
     * @private
     */
    private handleJobChecksumProgressEvent(evt: JobChecksumProgressEvent) {
        const update: Update<Job> = {
            id: evt.jobId,
            changes: {
                checksumProgress: evt,
            },
        };

        this.store.dispatch(JobActions.updateChecksumProgress({job: update}));
    }

    /**
     * Handles Transfer Stats events
     * @param evt {TransferStatsEvent} TransferStatsEvent
     * @private
     */
    private handleTransferStatsEvent(evt: TransferStatsEvent) {
        this.store.dispatch(
            TransferStatsActions.update(
                {
                    transferStats: {
                        activeDownloads: evt.activeDownloads,
                        activeUploads: evt.activeUploads,
                        downloadBps: evt.downloadBps,
                        uploadBps: evt.uploadBps,
                        totalBytesDownloaded: evt.totalBytesDownloaded,
                        totalBytesUploaded: evt.totalBytesUploaded,
                    },
                },
            ),
        );
    }
}
