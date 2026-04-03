import { DatePipe, KeyValuePipe, NgClass } from '@angular/common';
import { Component, inject, ViewChildren } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatDivider } from '@angular/material/list';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSort } from '@angular/material/sort';
import {
    MatCell,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatTable,
    MatTableDataSource,
} from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { calculateTimeToCompletion } from '@app/classes/time-to-completion';
import { ExportJobModalComponent } from '@app/components/modals/export-job-modal/export-job-modal.component';
import { JobDetailsModalComponent } from '@app/components/modals/job-details-modal/job-details-modal.component';
import { JobRenameModalComponent } from '@app/components/modals/job-rename-modal/job-rename-modal.component';
import { JobRenameModalData } from '@app/components/modals/job-rename-modal/job-rename-modal.interfaces';
import { TypeSafeMatCellDefDirective } from '@app/directives/type-safe-mat-cell-def.directive';
import { JobDetailsData, TransferDirection } from '@app/interfaces/jobs-table';
import { FormatBytesPipe } from '@app/pipes/format-bytes.pipe';
import {
    JobDurationPipe,
    JobSpeedPipe,
    JobsTableChecksumProgressPipe,
    JobStatusClassPipe,
    JobStatusPipe,
} from '@app/pipes/jobs-table-status.pipe';
import { PascalCaseToSpacesPipe } from '@app/pipes/pascal-case-to-spaces.pipe';
import { TextEllipsesPipe } from '@app/pipes/text-ellipses.pipe';
import { buildFilterString, jobsTableFilterPredicate } from '@app/utils/transfer-utils';
import { stringToJobStatus } from '@app/utils/utils';
import { INITIAL_TRANSFER_SUMMARY_STATS, TransferSummaryStats } from '@containers/tables/jobs-table/jobs-table.interfaces';
import { Store } from '@ngrx/store';
import { ExportService } from '@services/export/export.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import * as JobActions from '@state/job/actions/job.actions';
import { clearCompleted as clearCompletedJobsAction } from '@state/job/actions/job.actions';
import { selectAll as jobSelectAll } from '@state/job/job.selectors';
import { ConnectionState } from '@state/models/connection-state-model';
import { Job, JobStatus, PROGRESS_STATES, TERMINAL_STATES } from '@state/models/job.model';
import { debounceTime, Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

const DELAY = 200;
const RETRY_COUNT = 5;

@Component({
    selector: 'fme-jobs-table',
    templateUrl: './jobs-table.component.html',
    styleUrls: ['./jobs-table.component.scss'],
    imports: [
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatSelect,
        KeyValuePipe,
        MatOption,
        PascalCaseToSpacesPipe,
        MatIcon,
        FormatBytesPipe,
        MatTable,
        MatSort,
        MatColumnDef,
        MatHeaderCell,
        MatHeaderCellDef,
        MatCell,
        TypeSafeMatCellDefDirective,
        MatTooltip,
        TextEllipsesPipe,
        JobDurationPipe,
        JobSpeedPipe,
        DatePipe,
        NgClass,
        JobStatusClassPipe,
        MatProgressBar,
        JobsTableChecksumProgressPipe,
        JobStatusPipe,
        MatIconButton,
        MatMenuTrigger,
        MatHeaderRow,
        MatHeaderRowDef,
        MatRow,
        MatRowDef,
        MatMenu,
        MatMenuContent,
        MatMenuItem,
        MatDivider,
    ],
})
export class JobsTableComponent {
    private fmeClientService = inject(FmeClientService);
    private dialog = inject(MatDialog);
    private store = inject(Store);
    private notifications = inject(NotificationsService);
    private exportSvc = inject(ExportService);

    @ViewChildren(MatMenuTrigger) contextMenus: MatMenuTrigger[] = [];
    filterForm = new FormGroup({
        term: new FormControl<string>(''),
        status: new FormControl<string[]>([]),
    });
    jobStates = JobStatus;

    displayedColumns: string[] = [
        'type',
        'name',
        'remoteConfiguration',
        'size',
        'duration',
        'eta',
        // 'speed', // TODO: Disabled this for now, due to inconsistently weird speed data being show (implausibly high speeds)
        'startTime',
        'progress',
        'status',
        'action',
    ];
    protected readonly MAX_TABLE_STRING_LENGTH = 40;
    dataSource: MatTableDataSource<Job>;
    uploadTransferStats: TransferSummaryStats = {...INITIAL_TRANSFER_SUMMARY_STATS};
    downloadTransferStats: TransferSummaryStats = {...INITIAL_TRANSFER_SUMMARY_STATS};
    protected readonly TransferDirection = TransferDirection;
    private menuClosed!: Subscription;

    constructor() {
        this.dataSource = new MatTableDataSource<Job>([]);
        this.dataSource.filterPredicate = jobsTableFilterPredicate;
        this.filterForm.valueChanges.pipe(
            debounceTime(DELAY),
            distinctUntilChanged(),
            handleStreamError({retryCount: RETRY_COUNT}),
        ).subscribe(
            () => {
                this.dataSource.filter = buildFilterString(this.filterForm.getRawValue());
            },
        );

        this.fmeClientService.connectionState.pipe(
            distinctUntilChanged(),
        ).subscribe((connState) => {
            if (connState === ConnectionState.CONNECTED) {
                this.fmeClientService.listJobs().subscribe((jobs) => {
                    const stateJobs: Job[] = [];
                    for (const j of jobs) {
                        const bytesTransferred = j.bytesDownloaded + j.bytesUploaded;
                        let transferProgress: number;
                        let eta: string;
                        let lastUpdateTime: Date;

                        if (j.totalBytes === 0 || bytesTransferred <= 0) {
                            transferProgress = 0;
                            eta = 'Unknown';
                        } else {
                            transferProgress = parseFloat(((bytesTransferred / j.totalBytes) * 100).toFixed(2));
                            eta = calculateTimeToCompletion(
                                j.timestampTransferring || j.timestampCreated,
                                j.totalBytes,
                                bytesTransferred,
                            );
                        }

                        if (transferProgress > 100) {
                            transferProgress = 100;
                        }

                        if (j.status === JobStatus.Completed) {
                            transferProgress = 100;
                            eta = 'Completed';
                        }

                        if (PROGRESS_STATES.includes(stringToJobStatus(j.status))) {
                            lastUpdateTime = new Date();
                        } else {
                            lastUpdateTime = j.timestampCompleted ? j.timestampCompleted : new Date();
                        }

                        stateJobs.push({
                            bytesTransferred: j.bytesDownloaded + j.bytesUploaded,
                            destination: j.destination,
                            direction: j.direction === 'download' ? TransferDirection.Download : TransferDirection.Upload,
                            eta: eta,
                            hasTaskErrors: j.hasTaskErrors,
                            hasSuccessfulTasks: j.hasSuccessfulTasks,
                            id: j.jobId,
                            lastUpdate: lastUpdateTime,
                            name: j.name,
                            progress: transferProgress,
                            status: stringToJobStatus(j.status),
                            statusMessage: j.statusMessage,
                            totalBytes: j.totalBytes,
                            transferProfile: j.transferProfileName,
                            timestampCreated: j.timestampCreated,
                            timestampDiscovering: j.timestampDiscovering,
                            timestampChecksumming: j.timestampChecksumming,
                            timestampTransferring: j.timestampTransferring,
                            timestampCompleted: j.timestampCompleted,
                            checksumProgress: null,
                        });
                    }

                    if (stateJobs.length > 0) {
                        this.store.dispatch(JobActions.updateJobs({jobs: stateJobs}));
                    }
                });
            }
        });

        this.store.select(jobSelectAll).subscribe((jobs) => {
            const openMenus = this.contextMenus.find((item) => item.menuOpen);
            if (openMenus) {
                if (this.menuClosed) {
                    this.menuClosed.unsubscribe();
                }
                this.menuClosed = openMenus.menuClosed.subscribe(
                    () => {
                        this.dataSource.data = jobs;
                        this.updateSummaryStats(jobs);
                    },
                );
                return;
            }

            this.dataSource.data = jobs;
            this.updateSummaryStats(jobs);
        });
    }

    /**
     * Updates the upload and download summary stats based on the jobs in the jobs table
     * @param jobs Jobs to show in jobs table
     * @private
     */
    private updateSummaryStats(jobs: Job[]) {
        const uploadTransferStats = {...INITIAL_TRANSFER_SUMMARY_STATS};
        const downloadTransferStats = {...INITIAL_TRANSFER_SUMMARY_STATS};
        for (const job of jobs) {
            if (job.direction === TransferDirection.Upload) {
                this.calculateJobStats(job, uploadTransferStats);
            } else {
                this.calculateJobStats(job, downloadTransferStats);
            }
        }
        this.uploadTransferStats = uploadTransferStats;
        this.downloadTransferStats = downloadTransferStats;
    }

    /**
     * Uses the given job to directly update the fields of the given summaryStats object
     * @param job Job to update stats with
     * @param summaryStats Object that holds summary stats for a certain transfer direction
     * @private
     */
    private calculateJobStats(job: Job, summaryStats: TransferSummaryStats) {
        // increment job counts and active bytes
        summaryStats.totalJobs++;
        // calculate total bytes transferred
        summaryStats.totalBytesTransferred += job.bytesTransferred;
        // calculate values for active transfers
        if (PROGRESS_STATES.includes(job.status)) {
            summaryStats.activeJobs++;
            summaryStats.totalActiveBytesTransferred += job.bytesTransferred;
            summaryStats.activeBytes += job.totalBytes - job.bytesTransferred; // active bytes is bytes that are still being worked on
            // calculate average speed
            const ts = job.timestampTransferring || job.timestampCreated;
            const jobElapsedTime = (job.lastUpdate.getTime() - ts.getTime()) / 1000;
            if (jobElapsedTime > 0) {
                summaryStats.elapsedTime += jobElapsedTime;
            }
            // if elapsed time is 0, consider it to be 1 second
            summaryStats.averageSpeed = summaryStats.elapsedTime ? summaryStats.totalActiveBytesTransferred / summaryStats.elapsedTime : summaryStats.totalActiveBytesTransferred;
        }
    }

    /**
     * Opens the details modal for the given job
     *
     * @param job {Job} Job to display details modal for
     */
    jobDetails(job: Job) {
        this.dialog.open<JobDetailsModalComponent, JobDetailsData>(
            JobDetailsModalComponent, {
                minWidth: '800px',
                width: '800px',
                height: '70%',
                maxHeight: '1000px',
                autoFocus: false,
                data: {
                    jobId: job.id,
                    jobName: job.name,
                    direction: job.direction,
                    destination: job.destination,
                    remoteConfiguration: job.transferProfile,
                    started: job.timestampCreated,
                    completed: job.timestampCompleted,
                },
            },
        );
    }

    /**
     * Pause the given job. An error will be displayed if the job cannot be paused
     * @param job {Job} Job to pause
     */
    pauseJob(job: Job) {
        if (job.status !== JobStatus.InProgress) {
            this.notifications.error('Unable to pause job that is not in progress');
            return;
        }
        this.fmeClientService.pauseJob(job.id).subscribe((data) => {
            if (!data.success) {
                this.notifications.error('Unable to pause job');
            } else {
                this.store.dispatch(JobActions.pause({
                    job: {
                        id: job.id,
                        changes: {
                            status: JobStatus.Paused,
                            lastUpdate: new Date(),
                        },
                    },
                }));
            }
        });
    }

    /**
     * Resume a paused job. An error will be displayed if the job cannot be resumed
     *
     * @param job {Job} Job to resume
     */
    resumeJob(job: Job) {
        if (job.status !== JobStatus.Paused) {
            this.notifications.error('Unable to resume job that is not paused');
            return;
        }
        this.fmeClientService.resumeJob(job.id).subscribe((data) => {
            if (!data.success) {
                this.notifications.error('Unable to resume job');
            } else {
                this.store.dispatch(JobActions.resume({
                    job: {
                        id: job.id,
                        changes: {
                            status: JobStatus.InProgress,
                            lastUpdate: new Date(),
                        },
                    },
                }));
            }
        });
    }

    /**
     * Cancel a job. Will only issue the cancel request if the job is not finalized
     *
     * @param job {Job} Job to cancel
     */
    cancelJob(job: Job) {
        if (job.status != JobStatus.InProgress && job.status != JobStatus.Paused) {
            this.notifications.error('Unable to cancel job that is not in progress or paused');
            return;
        }
        this.fmeClientService.cancelJob(job.id).subscribe((data) => {
            if (!data.success) {
                this.notifications.error('Unable to cancel job');
            } else {
                this.store.dispatch(
                    JobActions.cancel(
                        {
                            job: {
                                id: job.id,
                                changes: {
                                    status: JobStatus.Cancelled,
                                    lastUpdate: new Date(),
                                },
                            },
                        },
                    ),
                );
            }
        });
    }

    /**
     * Resubmit a job. Will only issue the request if a job has a state that is resubmittable
     *
     * @param job {Job} Job to cancel
     */
    resubmitJob(job: Job) {
        if (!TERMINAL_STATES.includes(job.status)) {
            this.notifications.error('Unable to resubmit, only failed and completed jobs can be resubmitted');
            return;
        }
        this.fmeClientService.resubmitJob(job.id).subscribe((data) => {
            if (!data.success) {
                this.notifications.error('Unable to resubmit job');
            }
        });
    }

    /**
     * Clear all completed jobs
     */
    clearJobs() {
        this.fmeClientService.clearCompletedJobs().subscribe(
            () => {
                this.store.dispatch(clearCompletedJobsAction());
            },
        );
    }

    /**
     * Rename a job
     * @param job {Job} Job to rename
     */
    renameJob(job: Job) {
        const oldName = job.name;
        const renameDialog = this.dialog.open<JobRenameModalComponent, JobRenameModalData>(
            JobRenameModalComponent,
            {
                width: '450px',
                autoFocus: true,
                data: {
                    jobName: job.name,
                },
            },
        );

        renameDialog.afterClosed().subscribe((data) => {
            if (data) {
                this.fmeClientService.renameJob(job.id, data.jobName).subscribe(
                    (res) => {
                        if (!res.success) {
                            this.notifications.error(`Failed setting job name: ${res.errorMessage}`);
                            return;
                        }

                        this.notifications.info(`Renamed job ${oldName} to ${data.jobName}`);
                    },
                );
            }
        });
    }

    /**
     * Export a report for the given job
     * @param job {Job} Job to export
     */
    exportJob(job: Job) {
        const ref = this.dialog.open<ExportJobModalComponent>(
            ExportJobModalComponent,
            {
                width: '30%',
            },
        );

        ref.afterClosed().subscribe((result) => {
            if (result) {
                this.exportSvc.exportJobById(job.id, {format: result});
            }
        });
    }
}
