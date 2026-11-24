import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobsTableComponent } from './jobs-table.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { VerificationGateService } from '@services/verification-gate/verification-gate.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { ExportService } from '@services/export/export.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { Job, JobStatus } from '@state/models/job.model';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { selectAll as jobSelectAll } from '@state/job/job.selectors';
import * as JobActions from '@state/job/actions/job.actions';

/** Build a Job with sane defaults, overridable per field. */
function makeJob(over: Partial<Job> = {}): Job {
    return {
        id: 'job-1',
        name: 'Upload A',
        transferProfile: 'p',
        status: JobStatus.InProgress,
        statusMessage: '',
        totalBytes: 1000,
        bytesTransferred: 500,
        progress: 50,
        eta: 'Unknown',
        hasTaskErrors: false,
        hasSuccessfulTasks: true,
        lastUpdate: new Date('2024-01-01T00:00:10Z'),
        destination: '/dest',
        direction: TransferDirection.Upload,
        timestampCreated: new Date('2024-01-01T00:00:00Z'),
        timestampDiscovering: null,
        timestampChecksumming: null,
        timestampTransferring: new Date('2024-01-01T00:00:00Z'),
        timestampCompleted: null,
        checksumProgress: null,
        force: false,
        ...over,
    };
}

describe('JobsTableComponent', () => {
    let component: JobsTableComponent;
    let fixture: ComponentFixture<JobsTableComponent>;
    let store: MockStore<AppState>;

    let connectionState$: BehaviorSubject<ConnectionState>;
    let fmeClient: {
        connectionState: BehaviorSubject<ConnectionState>;
        listJobs: ReturnType<typeof vi.fn>;
        pauseJob: ReturnType<typeof vi.fn>;
        resumeJob: ReturnType<typeof vi.fn>;
        cancelJob: ReturnType<typeof vi.fn>;
        resubmitJob: ReturnType<typeof vi.fn>;
        clearCompletedJobs: ReturnType<typeof vi.fn>;
        clearCompletedJob: ReturnType<typeof vi.fn>;
        renameJob: ReturnType<typeof vi.fn>;
        resolveVerificationGate: ReturnType<typeof vi.fn>;
    };
    let notifications: Record<string, ReturnType<typeof vi.fn>>;
    let exportSvc: { exportJobById: ReturnType<typeof vi.fn> };
    let dialogOpen: ReturnType<typeof vi.fn>;
    let verificationGate: { openGate: ReturnType<typeof vi.fn>; init: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
        fmeClient = {
            connectionState: connectionState$,
            listJobs: vi.fn(() => of([])),
            pauseJob: vi.fn(() => of({success: true})),
            resumeJob: vi.fn(() => of({success: true})),
            cancelJob: vi.fn(() => of({success: true})),
            resubmitJob: vi.fn(() => of({success: true})),
            clearCompletedJobs: vi.fn(() => of({})),
            clearCompletedJob: vi.fn(() => of(['job-1'])),
            renameJob: vi.fn(() => of({success: true})),
            resolveVerificationGate: vi.fn(() => of({success: true})),
        };
        notifications = {success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn()};
        exportSvc = {exportJobById: vi.fn()};
        dialogOpen = vi.fn(() => ({afterClosed: () => of(undefined)}));
        verificationGate = {openGate: vi.fn(), init: vi.fn()};

        TestBed.configureTestingModule({
            imports: [
                FormsModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatInputModule,
                MatSelectModule,
                MatTableModule,
                MatIconModule,
                MatMenuModule,
                MatProgressBarModule,
                MatDialogModule,
                MatTabsModule,
                MatSnackBarModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
                {provide: FmeClientService, useValue: fmeClient},
                {provide: NotificationsService, useValue: notifications},
                {provide: ExportService, useValue: exportSvc},
                {provide: MatDialog, useValue: {open: dialogOpen}},
                {provide: VerificationGateService, useValue: verificationGate},
            ],
        });
        store = TestBed.inject(MockStore);
        store.overrideSelector(jobSelectAll, []);
        store.dispatch = vi.fn();
        fixture = TestBed.createComponent(JobsTableComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('listJobs on connection', () => {
        it('fetches jobs and dispatches updateJobs when connected', () => {
            fmeClient.listJobs.mockReturnValueOnce(of([{
                jobId: 'j1',
                name: 'A',
                direction: 'upload',
                status: 'IN_PROGRESS',
                totalBytes: 100,
                bytesDownloaded: 0,
                bytesUploaded: 50,
                destination: '/d',
                transferProfileName: 'p',
                hasTaskErrors: false,
                hasSuccessfulTasks: true,
                timestampCreated: new Date(),
                timestampDiscovering: null,
                timestampChecksumming: null,
                timestampTransferring: new Date(),
                timestampCompleted: null,
                force: false,
            }]));
            connectionState$.next(ConnectionState.CONNECTED);
            expect(fmeClient.listJobs).toHaveBeenCalled();
            expect(store.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({type: JobActions.updateJobs.type}),
            );
        });

        it('does not fetch jobs while disconnected', () => {
            expect(fmeClient.listJobs).not.toHaveBeenCalled();
        });
    });

    describe('summary stats from the store', () => {
        it('aggregates upload/download totals from selected jobs', () => {
            store.overrideSelector(jobSelectAll, [
                makeJob({id: 'u1', direction: TransferDirection.Upload, bytesTransferred: 200}), makeJob({id: 'd1', direction: TransferDirection.Download, bytesTransferred: 300, status: JobStatus.Completed}),
            ]);
            store.refreshState();
            expect(component.uploadTransferStats.totalJobs).toBe(1);
            expect(component.uploadTransferStats.totalBytesTransferred).toBe(200);
            expect(component.downloadTransferStats.totalJobs).toBe(1);
            expect(component.downloadTransferStats.totalBytesTransferred).toBe(300);
        });
    });

    describe('pauseJob', () => {
        it('errors when the job is not in progress', () => {
            component.pauseJob(makeJob({status: JobStatus.Completed}));
            expect(notifications.error).toHaveBeenCalledWith('Unable to pause job that is not in progress');
            expect(fmeClient.pauseJob).not.toHaveBeenCalled();
        });

        it('pauses and dispatches when in progress', () => {
            component.pauseJob(makeJob({status: JobStatus.InProgress}));
            expect(fmeClient.pauseJob).toHaveBeenCalledWith('job-1');
            expect(store.dispatch).toHaveBeenCalledWith(expect.objectContaining({type: JobActions.pause.type}));
        });

        it('notifies error when the pause RPC reports failure', () => {
            fmeClient.pauseJob.mockReturnValueOnce(of({success: false}));
            component.pauseJob(makeJob({status: JobStatus.InProgress}));
            expect(notifications.error).toHaveBeenCalledWith('Unable to pause job');
        });
    });

    describe('resumeJob', () => {
        it('errors when the job is not paused', () => {
            component.resumeJob(makeJob({status: JobStatus.InProgress}));
            expect(notifications.error).toHaveBeenCalled();
            expect(fmeClient.resumeJob).not.toHaveBeenCalled();
        });

        it('resumes and dispatches when paused', () => {
            component.resumeJob(makeJob({status: JobStatus.Paused}));
            expect(fmeClient.resumeJob).toHaveBeenCalledWith('job-1');
            expect(store.dispatch).toHaveBeenCalledWith(expect.objectContaining({type: JobActions.resume.type}));
        });
    });

    describe('cancelJob', () => {
        it('errors when not in progress or paused', () => {
            component.cancelJob(makeJob({status: JobStatus.Completed}));
            expect(notifications.error).toHaveBeenCalled();
            expect(fmeClient.cancelJob).not.toHaveBeenCalled();
        });

        it('cancels and dispatches when confirmed', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(true)});
            component.cancelJob(makeJob({status: JobStatus.InProgress}));
            expect(fmeClient.cancelJob).toHaveBeenCalledWith('job-1');
            expect(store.dispatch).toHaveBeenCalledWith(expect.objectContaining({type: JobActions.cancel.type}));
        });

        it('does not cancel when the confirmation is dismissed', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(undefined)});
            component.cancelJob(makeJob({status: JobStatus.InProgress}));
            expect(dialogOpen).toHaveBeenCalled();
            expect(fmeClient.cancelJob).not.toHaveBeenCalled();
        });

        it('escapes a malicious job name in the confirmation message', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(true)});
            component.cancelJob(makeJob({status: JobStatus.InProgress, name: "<script>alert('x')</script>"}));
            const message = dialogOpen.mock.calls[0][1].data.message as string;
            expect(message).not.toContain('<script>');
            expect(message).toContain('&lt;script&gt;');
        });
    });

    describe('resubmitJob', () => {
        it('errors for a non-resubmittable state', () => {
            component.resubmitJob(makeJob({status: JobStatus.InProgress}));
            expect(notifications.error).toHaveBeenCalled();
            expect(fmeClient.resubmitJob).not.toHaveBeenCalled();
        });

        it('resubmits a completed job after the user confirms', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(true)});
            component.resubmitJob(makeJob({status: JobStatus.Completed}));
            expect(fmeClient.resubmitJob).toHaveBeenCalledWith('job-1');
        });

        it('does not resubmit when the confirmation is dismissed', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(false)});
            component.resubmitJob(makeJob({status: JobStatus.Completed}));
            expect(fmeClient.resubmitJob).not.toHaveBeenCalled();
        });

        it('resubmits a completed-with-warnings job after confirm', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(true)});
            component.resubmitJob(makeJob({status: JobStatus.CompletedWithWarnings}));
            expect(fmeClient.resubmitJob).toHaveBeenCalledWith('job-1');
        });
    });

    describe('clearJobs', () => {
        it('clears completed jobs and dispatches the clear action', () => {
            component.clearJobs();
            expect(fmeClient.clearCompletedJobs).toHaveBeenCalled();
            expect(store.dispatch).toHaveBeenCalledWith(JobActions.clearCompleted());
        });
    });

    describe('clearJob', () => {
        it('clears a completed job and dispatches the single-job clear action', () => {
            component.clearJob(makeJob({status: JobStatus.Completed}));
            expect(fmeClient.clearCompletedJob).toHaveBeenCalledWith('job-1');
            expect(store.dispatch).toHaveBeenCalledWith(JobActions.clearJob({jobId: 'job-1'}));
        });

        it('clears a cancelled job', () => {
            component.clearJob(makeJob({status: JobStatus.Cancelled}));
            expect(fmeClient.clearCompletedJob).toHaveBeenCalledWith('job-1');
        });

        it('clears an errored job', () => {
            component.clearJob(makeJob({status: JobStatus.Error}));
            expect(fmeClient.clearCompletedJob).toHaveBeenCalledWith('job-1');
        });

        it('refuses to clear a job that is still in progress', () => {
            component.clearJob(makeJob({status: JobStatus.InProgress}));
            expect(fmeClient.clearCompletedJob).not.toHaveBeenCalled();
            expect(notifications.error).toHaveBeenCalledWith('Only completed, failed, or cancelled jobs can be cleared');
        });

        it('notifies on a service error', () => {
            fmeClient.clearCompletedJob.mockReturnValueOnce(throwError(() => 'boom'));
            component.clearJob(makeJob({status: JobStatus.Completed}));
            expect(notifications.error).toHaveBeenCalledWith('Unable to clear job');
            expect(store.dispatch).not.toHaveBeenCalledWith(JobActions.clearJob({jobId: 'job-1'}));
        });
    });

    describe('exportJob', () => {
        it('exports the job when a format is chosen', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of('csv')});
            component.exportJob(makeJob());
            expect(exportSvc.exportJobById).toHaveBeenCalledWith('job-1', {format: 'csv'});
        });

        it('does not export when the dialog is dismissed', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(undefined)});
            component.exportJob(makeJob());
            expect(exportSvc.exportJobById).not.toHaveBeenCalled();
        });
    });

    describe('renameJob', () => {
        it('renames the job and notifies on success', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of({jobName: 'New Name'})});
            component.renameJob(makeJob({name: 'Old Name'}));
            expect(fmeClient.renameJob).toHaveBeenCalledWith('job-1', 'New Name');
            expect(notifications.info).toHaveBeenCalledWith('Renamed job Old Name to New Name');
        });
    });

    describe('ASC MHL column', () => {
        it('flags a job verified against a manifest with no problems as used and clean', () => {
            const job = makeJob({
                status: JobStatus.Completed,
                ascMhlListed: 3,
                ascMhlVerified: 3,
                ascMhlProblems: 0,
                ascMhlAlgorithm: 'xxhash64',
            });
            expect(component.ascMhlUsed(job)).toBe(true);
            expect(component.ascMhlClean(job)).toBe(true);
            expect(component.ascMhlTooltip(job)).toBe('ASC MHL verified 3 of 3 (xxhash64)');
        });

        it('does not flag a job that shipped no manifest', () => {
            const job = makeJob({status: JobStatus.Completed});
            expect(component.ascMhlUsed(job)).toBe(false);
            expect(component.ascMhlClean(job)).toBe(false);
        });

        it('is used but not clean when there are integrity problems, regardless of status', () => {
            // All-mismatch run still mid-transfer: problems > 0 reads amber even
            // though the status has not yet flipped to CompletedWithWarnings.
            const job = makeJob({
                status: JobStatus.InProgress,
                ascMhlListed: 3,
                ascMhlVerified: 0,
                ascMhlProblems: 3,
                ascMhlAlgorithm: 'xxhash64',
            });
            expect(component.ascMhlUsed(job)).toBe(true);
            expect(component.ascMhlClean(job)).toBe(false);
        });

        it('stays clean for a failed job whose verification had no problems', () => {
            // A clean verify followed by a transfer failure is still a clean verify;
            // the indicator reflects verification, not transfer outcome.
            const job = makeJob({
                status: JobStatus.Error,
                ascMhlListed: 2,
                ascMhlVerified: 2,
                ascMhlProblems: 0,
                ascMhlAlgorithm: 'xxhash64',
            });
            expect(component.ascMhlClean(job)).toBe(true);
        });

        it('is not clean when fewer files verified than listed (unsupported algorithm)', () => {
            // sha1-only manifest: verified 0 of 5, no integrity problems, but nothing
            // was actually verified - must not read green.
            const job = makeJob({
                status: JobStatus.Completed,
                ascMhlListed: 5,
                ascMhlVerified: 0,
                ascMhlProblems: 0,
            });
            expect(component.ascMhlUsed(job)).toBe(true);
            expect(component.ascMhlClean(job)).toBe(false);
        });

        it('is not clean on a partial (cancelled) verify even with no problems', () => {
            const job = makeJob({
                status: JobStatus.Cancelled,
                ascMhlListed: 100,
                ascMhlVerified: 3,
                ascMhlProblems: 0,
            });
            expect(component.ascMhlClean(job)).toBe(false);
        });

        it('omits the algorithm from the tooltip when unknown', () => {
            const job = makeJob({ascMhlListed: 2, ascMhlVerified: 2});
            expect(component.ascMhlTooltip(job)).toBe('ASC MHL verified 2 of 2');
        });

        it('flags a mismatch job as failed (the red X state)', () => {
            const job = makeJob({
                status: JobStatus.CompletedWithWarnings,
                ascMhlListed: 12,
                ascMhlVerified: 10,
                ascMhlProblems: 2,
                ascMhlAlgorithm: 'xxhash64',
            });
            expect(component.ascMhlFailed(job)).toBe(true);
            expect(component.ascMhlClean(job)).toBe(false);
            expect(component.ascMhlTooltip(job)).toContain('failed');
        });

        it('is not failed when there are no integrity problems', () => {
            const job = makeJob({ascMhlListed: 12, ascMhlVerified: 12, ascMhlProblems: 0});
            expect(component.ascMhlFailed(job)).toBe(false);
        });

        it('flags an unreadable manifest (problems, nothing listed) as used and failed', () => {
            // A manifest that failed to load bumps problems but lists nothing; the
            // column must still light red rather than appear as "no manifest".
            const job = makeJob({
                status: JobStatus.CompletedWithWarnings,
                ascMhlListed: 0,
                ascMhlVerified: 0,
                ascMhlProblems: 1,
            });
            expect(component.ascMhlUsed(job)).toBe(true);
            expect(component.ascMhlFailed(job)).toBe(true);
            expect(component.ascMhlClean(job)).toBe(false);
        });
    });

    describe('jobDetails', () => {
        it('opens the job details modal', () => {
            component.jobDetails(makeJob());
            expect(dialogOpen).toHaveBeenCalled();
        });
    });

    describe('verification gate', () => {
        it('delegates the Review row action to the verification gate service', () => {
            const job = makeJob({id: 'gate-1', status: JobStatus.NeedsReview});
            component.openVerificationGate(job);
            expect(verificationGate.openGate).toHaveBeenCalledWith(job);
        });
    });
});
