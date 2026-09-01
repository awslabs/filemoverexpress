import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobDetailsModalComponent } from './job-details-modal.component';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule } from '@angular/material/paginator';
import { JobDetailsData, TransferDirection } from '@app/interfaces/jobs-table';
import { JobStatus } from '@state/models/job.model';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { WailsService } from '@services/wails/wails.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { of } from 'rxjs';

/** MAT_DIALOG_DATA factory with overridable fields. */
function makeData(over: Partial<JobDetailsData> = {}): JobDetailsData {
    return {
        jobId: 'job-1',
        jobName: 'My Upload',
        direction: TransferDirection.Upload,
        destination: '',
        remoteConfiguration: 'prof',
        started: new Date('2026-08-11T13:39:32Z'),
        completed: new Date('2026-08-11T13:39:42Z'),
        status: JobStatus.Completed,
        statusMessage: '',
        totalBytes: 1000,
        bytesTransferred: 1000,
        progress: 100,
        timestampTransferring: new Date('2026-08-11T13:39:32Z'),
        hasTaskErrors: false,
        hasSuccessfulTasks: true,
        force: false,
        ...over,
    } as JobDetailsData;
}

describe('JobDetailsModalComponent', () => {
    let fmeClient: {
        listTasksForJob: ReturnType<typeof vi.fn>;
        getConfiguration: ReturnType<typeof vi.fn>;
        pauseJob: ReturnType<typeof vi.fn>;
        resumeJob: ReturnType<typeof vi.fn>;
        cancelJob: ReturnType<typeof vi.fn>;
        resubmitJob: ReturnType<typeof vi.fn>;
    };
    let wails: Record<string, ReturnType<typeof vi.fn>>;
    let notifications: Record<string, ReturnType<typeof vi.fn>>;

    function build(data: JobDetailsData): {
        fixture: ComponentFixture<JobDetailsModalComponent>;
        component: JobDetailsModalComponent;
    } {
        TestBed.resetTestingModule();
        fmeClient = {
            listTasksForJob: vi.fn(() => of()),
            getConfiguration: vi.fn(() => of()),
            pauseJob: vi.fn(() => of({success: true})),
            resumeJob: vi.fn(() => of({success: true})),
            cancelJob: vi.fn(() => of({success: true})),
            resubmitJob: vi.fn(() => of({success: true})),
        };
        wails = {
            systemShowItemInFolder: vi.fn(() => of(void 0)),
            setClipboardText: vi.fn(() => of(void 0)),
        };
        notifications = {success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn()};

        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatTabsModule,
                MatTableModule,
                MatIconModule,
                MatProgressBarModule,
                FormsModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatInputModule,
                MatTooltipModule,
                MatSnackBarModule,
                MatPaginatorModule,
            ],
            providers: [
                {provide: MAT_DIALOG_DATA, useValue: data},
                {provide: MatDialogRef, useValue: {}},
                {provide: FmeClientService, useValue: fmeClient},
                {provide: WailsService, useValue: wails},
                {provide: NotificationsService, useValue: notifications},
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        const fixture = TestBed.createComponent(JobDetailsModalComponent);
        return {fixture, component: fixture.componentInstance};
    }

    it('should create', () => {
        const {component} = build(makeData());
        expect(component).toBeTruthy();
    });

    describe('constructor defaults', () => {
        it('normalizes an empty destination to root', () => {
            const {component} = build(makeData({destination: ''}));
            expect(component.jobDetails.destination).toBe('/');
        });

        it('opens on the logs tab for a failed job', () => {
            const {component} = build(makeData({status: JobStatus.Error}));
            expect(component.tab).toBe('logs');
        });

        it('opens on the files tab for a normal job', () => {
            const {component} = build(makeData({status: JobStatus.Completed, hasSuccessfulTasks: true}));
            expect(component.tab).toBe('files');
        });
    });

    describe('direction + status labels', () => {
        it('labels an upload', () => {
            const {component} = build(makeData({direction: TransferDirection.Upload}));
            expect(component.isUpload).toBe(true);
            expect(component.directionLabel).toContain('Upload');
        });

        it('labels a download', () => {
            const {component} = build(makeData({direction: TransferDirection.Download}));
            expect(component.isUpload).toBe(false);
            expect(component.directionLabel).toContain('Download');
        });

        it('reports the overwrite-existing choice', () => {
            const yes = build(makeData({force: true})).component;
            expect(yes.overwriteExistingLabel).toContain('re-uploaded');
            const no = build(makeData({force: false})).component;
            expect(no.overwriteExistingLabel).toContain('skipped');
        });
    });

    describe('derived state getters', () => {
        it('detects a skipped job (completed, nothing transferred)', () => {
            const {component} = build(makeData({
                status: JobStatus.Completed,
                hasSuccessfulTasks: false,
                hasTaskErrors: false,
            }));
            expect(component.isSkipped).toBe(true);
            expect(component.progressFillClass).toBe('skipped');
        });

        it('detects an error job and picks the error fill class', () => {
            const {component} = build(makeData({status: JobStatus.Error}));
            expect(component.isError).toBe(true);
            expect(component.progressFillClass).toBe('error');
        });

        it('treats an in-progress job as active', () => {
            const {component} = build(makeData({status: JobStatus.InProgress}));
            expect(component.isActive).toBe(true);
            expect(component.progressFillClass).toBe('in-progress');
        });

        it('clamps progressPct to 100', () => {
            const {component} = build(makeData({progress: 150}));
            expect(component.progressPct).toBe(100);
        });
    });

    describe('duration + speed labels', () => {
        it('computes a duration from transfer start to completion', () => {
            const {component} = build(makeData({
                timestampTransferring: new Date('2026-08-11T13:39:32Z'),
                completed: new Date('2026-08-11T13:39:42Z'),
            }));
            expect(component.durationLabel).toBe('10 sec');
        });

        it('renders a dash when start time is the Go zero value', () => {
            const {component} = build(makeData({
                timestampTransferring: new Date('0001-01-01T00:00:00Z'),
                started: new Date('0001-01-01T00:00:00Z'),
                completed: new Date('0001-01-01T00:00:00Z'),
            }));
            expect(component.durationLabel).toBe('\u2014');
        });
    });

    describe('action capability getters', () => {
        it('allows pause/cancel only while in progress or paused', () => {
            expect(build(makeData({status: JobStatus.InProgress})).component.canPauseOrCancel).toBe(true);
            expect(build(makeData({status: JobStatus.Paused})).component.canPauseOrCancel).toBe(true);
            expect(build(makeData({status: JobStatus.Completed})).component.canPauseOrCancel).toBe(false);
        });

        it('allows retry only from a resubmittable state', () => {
            expect(build(makeData({status: JobStatus.Completed})).component.canRetry).toBe(true);
            expect(build(makeData({status: JobStatus.InProgress})).component.canRetry).toBe(false);
        });

        it('canCopyS3Uri only for uploads', () => {
            expect(build(makeData({direction: TransferDirection.Upload})).component.canCopyS3Uri).toBe(true);
            expect(build(makeData({direction: TransferDirection.Download})).component.canCopyS3Uri).toBe(false);
        });
    });

    describe('job actions', () => {
        it('pauses a running job', () => {
            const {component} = build(makeData({status: JobStatus.InProgress}));
            component.pauseOrResume();
            expect(fmeClient.pauseJob).toHaveBeenCalledWith('job-1');
        });

        it('resumes a paused job', () => {
            const {component} = build(makeData({status: JobStatus.Paused}));
            component.pauseOrResume();
            expect(fmeClient.resumeJob).toHaveBeenCalledWith('job-1');
        });

        it('cancels a job', () => {
            const {component} = build(makeData({status: JobStatus.InProgress}));
            component.cancel();
            expect(fmeClient.cancelJob).toHaveBeenCalledWith('job-1');
        });

        it('retries a job', () => {
            const {component} = build(makeData({status: JobStatus.Completed}));
            component.retry();
            expect(fmeClient.resubmitJob).toHaveBeenCalledWith('job-1');
        });

        it('copies the error to the clipboard and notifies', () => {
            const {component} = build(makeData({statusMessage: 'boom'}));
            component.copyError();
            expect(wails['setClipboardText']).toHaveBeenCalledWith('boom');
            expect(notifications['success']).toHaveBeenCalled();
        });

        it('does not copy an empty error', () => {
            const {component} = build(makeData({statusMessage: ''}));
            component.copyError();
            expect(wails['setClipboardText']).not.toHaveBeenCalled();
        });
    });

    describe('selectFileFilter', () => {
        it('sets the failed filter and its columns', () => {
            const {component} = build(makeData());
            component.selectFileFilter('failed');
            expect(component.fileFilter).toBe('failed');
            expect(component.filterForm.controls.status.value).toEqual(['ERROR']);
            expect(component.displayedColumns).toContain('progress');
        });

        it('resets to all files with the full column set', () => {
            const {component} = build(makeData());
            component.selectFileFilter('all');
            expect(component.filterForm.controls.status.value).toEqual([]);
            expect(component.displayedColumns).toEqual(['name',
                'size',
                'dateModified',
                'progress',
                'status']);
        });
    });

    describe('loadTasks', () => {
        it('aggregates task counts and committed bytes from the RPC stream', () => {
            const {component} = build(makeData({status: JobStatus.Completed}));
            fmeClient.listTasksForJob.mockReturnValue(of(
                {direction: 'UPLOAD', localFile: {path: 'a.mov', size: 100, lastModified: new Date()}, s3Object: {}, bytesTransferred: 100, status: 'COMPLETED'},
                {direction: 'UPLOAD', localFile: {path: 'b.mov', size: 50, lastModified: new Date()}, s3Object: {}, bytesTransferred: 0, status: 'ERROR'},
            ));
            component.loadTasks();
            expect(component.counts.total).toBe(2);
            expect(component.counts.completed).toBe(1);
            expect(component.counts.failed).toBe(1);
            expect(component.committedBytes).toBe(100);
            expect(component.tasksLoaded).toBe(true);
        });
    });
});
