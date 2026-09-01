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
import { BehaviorSubject, of } from 'rxjs';
import { FmeClientService } from '@services/fme-client/fme-client.service';
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
        renameJob: ReturnType<typeof vi.fn>;
    };
    let notifications: Record<string, ReturnType<typeof vi.fn>>;
    let exportSvc: { exportJobById: ReturnType<typeof vi.fn> };
    let dialogOpen: ReturnType<typeof vi.fn>;

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
            renameJob: vi.fn(() => of({success: true})),
        };
        notifications = {success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn()};
        exportSvc = {exportJobById: vi.fn()};
        dialogOpen = vi.fn(() => ({afterClosed: () => of(undefined)}));

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

        it('cancels and dispatches when in progress', () => {
            component.cancelJob(makeJob({status: JobStatus.InProgress}));
            expect(fmeClient.cancelJob).toHaveBeenCalledWith('job-1');
            expect(store.dispatch).toHaveBeenCalledWith(expect.objectContaining({type: JobActions.cancel.type}));
        });
    });

    describe('resubmitJob', () => {
        it('errors for a non-resubmittable state', () => {
            component.resubmitJob(makeJob({status: JobStatus.InProgress}));
            expect(notifications.error).toHaveBeenCalled();
            expect(fmeClient.resubmitJob).not.toHaveBeenCalled();
        });

        it('resubmits a completed job', () => {
            component.resubmitJob(makeJob({status: JobStatus.Completed}));
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

    describe('jobDetails', () => {
        it('opens the job details modal', () => {
            component.jobDetails(makeJob());
            expect(dialogOpen).toHaveBeenCalled();
        });
    });
});
