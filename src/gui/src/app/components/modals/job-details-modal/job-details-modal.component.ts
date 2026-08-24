import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { AfterViewInit, Component, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import {
    MatCell,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatNoDataRow,
    MatRow,
    MatRowDef,
    MatTable,
    MatTableDataSource,
} from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { Task } from '@app/classes/grpc/task';
import { TaskCounts } from '@app/components/modals/job-details-modal/job-details-modal.interfaces';
import { TypeSafeMatCellDefDirective } from '@app/directives/type-safe-mat-cell-def.directive';
import { JobDetailsData, ObjectType, TaskElement, TransferDirection } from '@app/interfaces/jobs-table';
import { JobStatusClassPipe, JobStatusPipe, TaskTableStatusClassPipe } from '@app/pipes/jobs-table-status.pipe';
import { TaskStatusPipe } from '@app/pipes/task-status.pipe';
import { TextEllipsesPipe } from '@app/pipes/text-ellipses.pipe';
import { getOSFileBrowserName } from '@app/components/layout/file-browser/file-browser.utils';
import {
    checksumAlgorithms,
    storageClasses,
} from '@containers/forms/transfer-profile-form/transfer-profile-form.constants';
import { buildFilterString, tasksTableFilterPredicate } from '@app/utils/transfer-utils';
import { formatBytes, stringToTaskStatus } from '@app/utils/utils';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { MetadataService } from '@services/metadata/metadata.service';
import { WailsService } from '@services/wails/wails.service';
import { Store } from '@ngrx/store';
import { NotificationsService } from '@services/notifications/notifications.service';
import { selectAll as jobSelectAll } from '@state/job/job.selectors';
import { selectAll as logsSelectAll } from '@state/logs/logs.selectors';
import { LogEntry } from '@state/models/log-entry.model';
import { Job, JobStatus, PROGRESS_STATES, RESUBMITTABLE_STATES, TaskStatus, TERMINAL_STATES } from '@state/models/job.model';
import { debounceTime, finalize, Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

const TASK_RELOAD_INTERVAL = 5000;
const PENDING_STATES = [
    TaskStatus.Queued,
    TaskStatus.Checksumming,
    TaskStatus.InProgress,
    TaskStatus.Paused,
];
const SKIPPED_STATES = [TaskStatus.Skipped, TaskStatus.Cancelled];

@Component({
    selector: 'fme-job-details-modal',
    templateUrl: './job-details-modal.component.html',
    styleUrls: ['./job-details-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatIconButton,
        MatDialogClose,
        MatIcon,
        MatDialogContent,
        MatTooltip,
        TextEllipsesPipe,
        MatPaginator,
        ReactiveFormsModule,
        MatFormField,
        MatInput,
        MatTable,
        MatColumnDef,
        MatHeaderCell,
        MatCell,
        MatHeaderCellDef,
        TaskTableStatusClassPipe,
        MatProgressBar,
        NgClass,
        TypeSafeMatCellDefDirective,
        TaskStatusPipe,
        MatNoDataRow,
        MatHeaderRow,
        MatRow,
        MatHeaderRowDef,
        MatRowDef,
        NgTemplateOutlet,
        DatePipe,
    ],
})
export class JobDetailsModalComponent implements AfterViewInit, OnDestroy {
    private fmeClientService = inject(FmeClientService);
    private wails = inject(WailsService);
    private metadata = inject(MetadataService);
    private store = inject(Store);
    private notifications = inject(NotificationsService);
    protected readonly TransferDirection = TransferDirection;

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    protected readonly MAX_INFO_STRING_LENGTH = 32;
    protected readonly MAX_TABLE_STRING_LENGTH = 56;
    private refreshTimer: number | null = null;
    private subscriptions: Subscription[] = [];

    // Left-nav view: the file-status filters (replacing the old tab bar) plus a Logs view.
    view: 'all' | 'pending' | 'completed' | 'skipped' | 'failed' | 'logs' = 'all';
    // Advanced details section is collapsed by default (status/progress/errors come first).
    advancedOpen = false;
    // Job-scoped log entries, sourced from the logs store (filtered by this job's id).
    jobLogs: LogEntry[] = [];
    filterForm = new FormGroup({
        term: new FormControl<string>(''),
        status: new FormControl<string[]>([]),
    });

    tasksLoaded = false;
    displayedColumns: string[] = [
        'name',
        'progress',
        'status',
    ];
    dataSource: MatTableDataSource<TaskElement>;
    jobDetails: JobDetailsData = {
        jobId: '',
        jobName: '',
        direction: TransferDirection.Upload,
        destination: '',
        remoteConfiguration: '',
        started: new Date(),
        completed: null,
        status: JobStatus.Created,
        statusMessage: '',
        totalBytes: 0,
        bytesTransferred: 0,
        progress: 0,
        timestampTransferring: null,
        hasTaskErrors: false,
        hasSuccessfulTasks: false,
    };
    counts: TaskCounts = {
        total: 0,
        pending: 0,
        completed: 0,
        skipped: 0,
        failed: 0,
    };

    // Remote Configuration details (fetched from the daemon config for this job's profile).
    s3Bucket = '';
    storageClassLabel = '';
    checksumLabel = '';
    private profileAutoTuning: boolean | null = null;
    private profileThreads = 0;
    private profileChunkMB = 0;
    private maxTaskBytes = 0;
    private localSourcePath = '';
    private remotePrefix = '';

    constructor() {
        const data = inject<JobDetailsData>(MAT_DIALOG_DATA);

        this.dataSource = new MatTableDataSource<TaskElement>();
        this.dataSource.filterPredicate = tasksTableFilterPredicate;
        this.jobDetails = data;

        if (this.jobDetails.destination === '') {
            this.jobDetails.destination = '/';
        }

        this.loadTasks();
        this.loadProfileDetails();
        // Open on Logs for a failed job (users look there first to see why it failed),
        // otherwise show all files.
        this.view = this.isError ? 'logs' : 'all';
        // Keep the summary live while the modal is open (progress/speed/status for active jobs).
        this.subscriptions.push(this.store.select(jobSelectAll).subscribe((jobs) => {
            const job = jobs.find((j) => j.id === this.jobDetails.jobId);
            if (job) {
                this.jobDetails = {
                    ...this.jobDetails,
                    status: job.status,
                    statusMessage: job.statusMessage,
                    totalBytes: job.totalBytes,
                    bytesTransferred: job.bytesTransferred,
                    progress: job.progress,
                    completed: job.timestampCompleted,
                    timestampTransferring: job.timestampTransferring,
                    hasTaskErrors: job.hasTaskErrors,
                    hasSuccessfulTasks: job.hasSuccessfulTasks,
                };
            }
        }));
        // Job-scoped logs (the logs store already carries a jobId on each entry).
        this.subscriptions.push(this.store.select(logsSelectAll).subscribe((logs) => {
            this.jobLogs = logs.filter((log) => log.jobId === this.jobDetails.jobId);
        }));
        this.filterForm.valueChanges.pipe(
            debounceTime(200),
            distinctUntilChanged(),
        ).subscribe(
            () => {
                this.dataSource.filter = buildFilterString(this.filterForm.getRawValue());
            },
        );
        this.dataSource.filter = buildFilterString(this.filterForm.getRawValue());
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
    }

    ngOnDestroy() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.subscriptions.forEach((sub) => sub.unsubscribe());
    }

    /**
     * Fetch and process all tasks for the job
     */
    loadTasks() {
        const taskData: TaskElement[] = [];

        this.fmeClientService.listTasksForJob(this.jobDetails.jobId).pipe(
            finalize(
                () => {
                    this.dataSource.data = [...taskData].sort(
                        (a, b) => a.name < b.name ? -1 : 1,
                    );
                    this.dataSource.filter = buildFilterString(this.filterForm.getRawValue());
                    const newCounts: TaskCounts = {
                        total: 0,
                        pending: 0,
                        completed: 0,
                        skipped: 0,
                        failed: 0,
                    };

                    for (const task of this.dataSource.data) {
                        if (PENDING_STATES.includes(task.status)) {
                            newCounts.pending++;
                        } else if (SKIPPED_STATES.includes(task.status)) {
                            newCounts.skipped++;
                        } else {
                            switch (task.status) {
                                case TaskStatus.Completed:
                                    newCounts.completed++;
                                    break;

                                case TaskStatus.Error:
                                    newCounts.failed++;
                                    break;

                                default:
                                    console.debug(`Got a task with an unexpected status: ${task.status}`);
                            }
                        }
                        newCounts.total++;
                    }
                    this.counts = {...newCounts};
                    if (!TERMINAL_STATES.includes(this.jobDetails.status)) {
                        this.refreshTimer = window.setTimeout(this.loadTasks.bind(this), TASK_RELOAD_INTERVAL);
                    }
                    this.tasksLoaded = true;
                },
            ),
        ).subscribe(
            (task) => {
                taskData.push(this.processTask(task));
            },
        );
    }

    /**
     * Converts a Task objects into a TaskElement for display
     *
     * @param task {Task} Task to convert
     * @returns {TaskElement} Returns a TaskElement
     * @private
     */
    private processTask(task: Task): TaskElement {
        let source: string;
        let totalBytes: number;

        if (task.direction === 'DOWNLOAD') {
            source = task.s3Object.key;
            totalBytes = task.s3Object.size;
        } else {
            source = task.localFile.path;
            totalBytes = task.localFile.size;
        }

        // Track the largest file — the Parallelism row derives auto-tune's picks from it.
        if (totalBytes > this.maxTaskBytes) {
            this.maxTaskBytes = totalBytes;
        }

        let taskProgress = totalBytes ? Number(((task.bytesTransferred / totalBytes) * 100).toFixed(2)) : 100;
        if (isNaN(taskProgress)) {
            taskProgress = 0;
        }

        if (task.status === 'COMPLETED') {
            taskProgress = 100;
        }

        return {
            name: source,
            progress: taskProgress,
            status: stringToTaskStatus(task.status),
            type: ObjectType.File,
        };
    }

    selectView(view: 'all' | 'pending' | 'completed' | 'skipped' | 'failed' | 'logs') {
        this.view = view;
        switch (view) {
            case 'all':
                this.filterForm.controls.status.setValue([]);
                this.displayedColumns = ['name',
                    'progress',
                    'status'];
                break;
            case 'pending':
                this.filterForm.controls.status.setValue([...PENDING_STATES]);
                this.displayedColumns = ['name'];
                break;
            case 'completed':
                this.filterForm.controls.status.setValue(['COMPLETED']);
                this.displayedColumns = ['name'];
                break;
            case 'skipped':
                this.filterForm.controls.status.setValue([...SKIPPED_STATES]);
                this.displayedColumns = ['name'];
                break;
            case 'failed':
                this.filterForm.controls.status.setValue(['ERROR']);
                this.displayedColumns = ['name', 'progress'];
                break;
            case 'logs':
                // Logs view renders its own list; the file filter is irrelevant.
                break;
        }
    }

    // ----- Summary (mockup Job Details) -----

    private readonly jobStatusPipe = new JobStatusPipe();
    private readonly jobStatusClassPipe = new JobStatusClassPipe();

    get isActive(): boolean {
        return PROGRESS_STATES.includes(this.jobDetails.status);
    }

    get isError(): boolean {
        const d = this.jobDetails;
        return d.status === JobStatus.Error || (d.status === JobStatus.Completed && d.hasTaskErrors && !d.hasSuccessfulTasks);
    }

    get isUpload(): boolean {
        return this.jobDetails.direction === TransferDirection.Upload;
    }

    get directionLabel(): string {
        return this.isUpload ? 'Upload — local → S3' : 'Download — S3 → local';
    }

    get statusLabel(): string {
        return this.jobStatusPipe.transform(this.jobDetails as unknown as Job);
    }

    get statusClass(): string {
        return this.jobStatusClassPipe.transform(this.jobDetails as unknown as Job);
    }

    get progressPct(): number {
        return Math.min(Math.round(this.jobDetails.progress), 100);
    }

    get progressFillClass(): string {
        if (this.isError) {
            return 'error';
        }
        if (this.isSkipped) {
            return 'skipped';
        }
        if (this.jobDetails.status === JobStatus.Completed) {
            return 'complete';
        }
        return 'in-progress';
    }

    /**
     * A "skipped" job is a COMPLETED job where nothing actually transferred (no successful
     * and no errored tasks) — e.g. a hot-folder sweep where every file already existed in S3.
     * There is no dedicated JobStatus.Skipped; it is derived the same way the status pill is.
     */
    get isSkipped(): boolean {
        const d = this.jobDetails;
        return d.status === JobStatus.Completed && !d.hasSuccessfulTasks && !d.hasTaskErrors;
    }

    get bytesLabel(): string {
        const d = this.jobDetails;
        return `${formatBytes(d.bytesTransferred, 1, 1000)} of ${formatBytes(d.totalBytes, 1, 1000)} · ${this.progressPct}%`;
    }

    get sizeLabel(): string {
        return formatBytes(this.jobDetails.totalBytes, 2, 1000);
    }

    private get durationMs(): number {
        // Reject null/undefined AND invalid/epoch/Go-zero-time ("0001-01-01T00:00:00Z") values.
        // A skipped job never enters the transfer phase, so the daemon sends timestampTransferring
        // as Go's zero time — non-null, so a plain ?? fallback would compute a ~2025-year duration.
        const valid = (d: unknown): number | null => {
            const t = d ? new Date(d as string).getTime() : NaN;
            return Number.isFinite(t) && t > 0 ? t : null;
        };
        const start = valid(this.jobDetails.timestampTransferring) ?? valid(this.jobDetails.started);
        const end = valid(this.jobDetails.completed) ?? Date.now();
        return start ? Math.max(end - start, 0) : 0;
    }

    get durationLabel(): string {
        const secs = Math.round(this.durationMs / 1000);
        if (secs < 1) {
            return '—';
        }
        if (secs < 60) {
            return `${secs} sec`;
        }
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        if (mins < 60) {
            return remSecs ? `${mins} min ${remSecs} sec` : `${mins} min`;
        }
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return remMins ? `${hrs} hr ${remMins} min` : `${hrs} hr`;
    }

    get speedLabel(): string {
        const secs = this.durationMs / 1000;
        if (secs <= 0) {
            return '—';
        }
        return formatBytes(this.jobDetails.totalBytes / secs, 1, 1000) + '/s';
    }

    /** OS-aware "Reveal in Finder / File Explorer / File Manager" using the daemon's OS. */
    get revealLabel(): string {
        let os = 'darwin';
        try {
            os = this.metadata.daemonOS;
        } catch {
            // metadata not loaded yet — fall back to a generic browser name
        }
        return `Reveal in ${getOSFileBrowserName(os as Parameters<typeof getOSFileBrowserName>[0])}`;
    }

    /**
     * Pull the extra Remote Configuration details (bucket, storage class, checksum, parallelism,
     * local source path) from the daemon config for this job's profile. Fails silently when the
     * config is unavailable (e.g. disconnected) — the extra rows simply stay hidden.
     */
    private loadProfileDetails(): void {
        this.fmeClientService.getConfiguration().subscribe({
            next: (config) => {
                const profile = config.protocols?.s3?.transferProfiles?.[this.jobDetails.remoteConfiguration];
                if (!profile) {
                    return;
                }
                this.s3Bucket = profile.bucket ?? '';
                this.localSourcePath = profile.paths?.local ?? '';
                this.remotePrefix = profile.paths?.remote ?? '';
                this.storageClassLabel =
                    storageClasses.find((sc) => sc.key === profile.storageClass)?.value ?? profile.storageClass ?? '';
                if (profile.checksums?.enabled && profile.checksums.algorithm && profile.checksums.algorithm !== 'none') {
                    const alg = checksumAlgorithms.find((a) => a.value === profile.checksums.algorithm)?.viewValue
                        ?? profile.checksums.algorithm;
                    this.checksumLabel = `${alg} · verify after transfer`;
                } else {
                    this.checksumLabel = 'Off';
                }
                this.profileAutoTuning = profile.autoTuning;
                this.profileThreads = profile.threads;
                this.profileChunkMB = profile.chunkSize;
            },
            error: () => {
                // Config unavailable — leave the extra rows hidden.
            },
        });
    }

    /** s3://bucket for the S3 Bucket detail row. */
    get s3BucketUri(): string {
        return this.s3Bucket ? `s3://${this.s3Bucket}` : '';
    }

    /** Full s3://bucket/prefix for Copy S3 URI. */
    get s3Uri(): string {
        if (!this.s3Bucket) {
            return '';
        }
        const prefix = this.isUpload ? this.jobDetails.destination : this.remotePrefix;
        const clean = (prefix ?? '').replace(/^\/+/, '');
        return `s3://${this.s3Bucket}/${clean}`;
    }

    /** Local path to reveal: the download destination, or the upload's local source folder. */
    get revealPath(): string {
        return this.isUpload ? this.localSourcePath : this.jobDetails.destination;
    }

    /**
     * Mirror of the daemon's auto-tune lookup table (cli/core/transfer-api/auto_tuning.go):
     * per-file settings chosen by file size. Kept in sync manually — shows the DIT what
     * auto-tune picked so the values are actionable for manual tuning.
     */
    private static readonly AUTO_TUNE_TABLE: { limitMB: number, threads: number, chunkMB: number }[] = [
        {limitMB: 15, threads: 1, chunkMB: 15},
        {limitMB: 50, threads: 10, chunkMB: 5},
        {limitMB: 100, threads: 10, chunkMB: 10},
        {limitMB: 250, threads: 25, chunkMB: 10},
        {limitMB: 500, threads: 50, chunkMB: 10},
        {limitMB: 750, threads: 75, chunkMB: 10},
        {limitMB: 1000, threads: 100, chunkMB: 10},
        {limitMB: 2000, threads: 50, chunkMB: 40},
        {limitMB: 2500, threads: 50, chunkMB: 50},
        {limitMB: 3000, threads: 50, chunkMB: 60},
        {limitMB: 4000, threads: 50, chunkMB: 80},
        {limitMB: 5000, threads: 50, chunkMB: 100},
        {limitMB: Infinity, threads: 100, chunkMB: 150},
    ];

    /**
     * Parallelism row: manual settings verbatim; for auto-tuning, the settings the daemon's
     * lookup table picks for the job's largest file (auto-tune is per-file by size).
     */
    get parallelismLabel(): string {
        if (this.profileAutoTuning === null) {
            return '';
        }
        if (!this.profileAutoTuning) {
            return `${this.profileThreads} threads · ${this.profileChunkMB} MB chunks`;
        }
        if (this.maxTaskBytes <= 0) {
            return 'Auto-tuned';
        }
        const sizeMB = this.maxTaskBytes / (1024 * 1024);
        const pick = JobDetailsModalComponent.AUTO_TUNE_TABLE.find((t) => sizeMB <= t.limitMB)
            ?? JobDetailsModalComponent.AUTO_TUNE_TABLE[JobDetailsModalComponent.AUTO_TUNE_TABLE.length - 1];
        return `${pick.threads} threads · ${pick.chunkMB} MB chunks (auto-tuned, largest file)`;
    }

    /** True when running inside the Wails desktop app (the browser dev server has no runtime). */
    private get isDesktop(): boolean {
        return typeof (window as unknown as { _wails?: unknown })._wails !== 'undefined';
    }

    /**
     * Reveal in Finder/Explorer is shown only for downloads — the destination is a local
     * path — and only in the desktop app: the reveal is a Wails binding with no browser
     * equivalent, so in a browser tab the button would silently do nothing.
     */
    get canReveal(): boolean {
        return !this.isUpload && !!this.revealPath && this.isDesktop;
    }

    /** Copy S3 URI is shown only for uploads — the destination is the S3 side. */
    get canCopyS3Uri(): boolean {
        return this.isUpload;
    }

    get canPauseOrCancel(): boolean {
        return this.jobDetails.status === JobStatus.InProgress || this.jobDetails.status === JobStatus.Paused;
    }

    get isPaused(): boolean {
        return this.jobDetails.status === JobStatus.Paused;
    }

    get canRetry(): boolean {
        return RESUBMITTABLE_STATES.includes(this.jobDetails.status);
    }

    reveal(): void {
        this.wails.systemShowItemInFolder(this.revealPath).subscribe();
    }

    copyS3Uri(): void {
        const uri = this.s3Uri || this.jobDetails.destination;
        if (!uri) {
            return;
        }
        this.wails.setClipboardText(uri).subscribe(() => this.notifications.success('Copied S3 URI to clipboard'));
    }

    copyError(): void {
        if (!this.jobDetails.statusMessage) {
            return;
        }
        this.wails.setClipboardText(this.jobDetails.statusMessage)
            .subscribe(() => this.notifications.success('Copied error to clipboard'));
    }

    pauseOrResume(): void {
        if (this.isPaused) {
            this.fmeClientService.resumeJob(this.jobDetails.jobId).subscribe();
        } else {
            this.fmeClientService.pauseJob(this.jobDetails.jobId).subscribe();
        }
    }

    cancel(): void {
        this.fmeClientService.cancelJob(this.jobDetails.jobId).subscribe();
    }

    retry(): void {
        this.fmeClientService.resubmitJob(this.jobDetails.jobId).subscribe();
    }
}
