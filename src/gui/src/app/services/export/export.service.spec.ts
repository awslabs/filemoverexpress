import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RendererFactory2 } from '@angular/core';
import { of, throwError, Observable, Subscriber } from 'rxjs';
import { Code, ConnectError } from '@connectrpc/connect';
import { ExportService } from './export.service';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { initialTestState } from '@state/test.state';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { WailsService } from '@services/wails/wails.service';
import { Job } from '@classes/grpc';
import { Task } from '@classes/grpc/task';
import { TransferDirection } from '@app/interfaces/jobs-table';

// ---------------------------------------------------------------------------
// ExportService orchestrates FmeClientService (listJobs / listTasksForJob),
// the export.utils report converters (which call WailsService.generateXReport),
// and the download path (WailsService.saveFile in packaged mode, an anchor
// data: URL in dev mode). Every collaborator is stubbed with useValue so the
// tests observe the service's own branching behaviour.
//
// listTasksForJob is callback/stream shaped in production: the service pushes
// each emission into an array on `next`, and only writes exportData + kicks off
// report generation on `complete`. A synchronous `of(...)` reproduces that
// (next-per-item then complete) fine for the happy path; the empty-job and
// error branches use tailored Observables.
// ---------------------------------------------------------------------------

/** Minimal Task stand-in; the report converters serialize these fields. */
function makeTask(id: string): Task {
    return {
        taskId: id,
        destination: 'dest',
        localFile: {path: '/f', size: 0n, lastModified: undefined},
        s3Object: {key: 'k', size: 0n, lastModified: undefined},
        direction: 'upload',
        status: 'complete',
        statusMessage: '',
        jobId: 'job1',
        checksum: '',
        priority: 0,
        error: '',
        bytesTransferred: 0n,
    } as unknown as Task;
}

/** Minimal Job stand-in with the fields ExportService reads. */
function makeJob(jobId: string, name = 'Job', direction = 'upload'): Job {
    return {
        jobId,
        name,
        transferProfileName: 'profile',
        destination: '/dest',
        direction,
        bucket: 'bucket',
    } as unknown as Job;
}

describe('ExportService', () => {
    let service: ExportService;

    let listJobs: ReturnType<typeof vi.fn>;
    let listTasksForJob: ReturnType<typeof vi.fn>;
    let generateCsvReport: ReturnType<typeof vi.fn>;
    let generateJsonReport: ReturnType<typeof vi.fn>;
    let generateExcelReport: ReturnType<typeof vi.fn>;
    let saveFile: ReturnType<typeof vi.fn>;

    let notify: {
        info: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        success: ReturnType<typeof vi.fn>;
        warning: ReturnType<typeof vi.fn>;
    };

    // Captured anchor element for the dev-mode download path.
    let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
    let rendererFactoryStub: Partial<RendererFactory2>;

    beforeEach(() => {
        listJobs = vi.fn().mockReturnValue(of([]));
        listTasksForJob = vi.fn().mockReturnValue(of());
        generateCsvReport = vi.fn().mockReturnValue(of('csv-base64'));
        generateJsonReport = vi.fn().mockReturnValue(of('json-base64'));
        generateExcelReport = vi.fn().mockReturnValue(of('xlsx-base64'));
        saveFile = vi.fn().mockReturnValue(of('/saved/path'));

        notify = {
            info: vi.fn(),
            error: vi.fn(),
            success: vi.fn(),
            warning: vi.fn(),
        };

        anchor = {href: '', download: '', click: vi.fn(), remove: vi.fn()};
        const renderer = {
            createElement: vi.fn(() => anchor),
        };
        rendererFactoryStub = {
            createRenderer: vi.fn(() => renderer as never),
        };

        const fmeClientStub = {
            listJobs,
            listTasksForJob,
        } as unknown as FmeClientService;
        const wailsStub = {
            generateCsvReport,
            generateJsonReport,
            generateExcelReport,
            saveFile,
        } as unknown as WailsService;

        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
            ],
            providers: [
                ExportService,
                provideMockStore<AppState>({initialState: initialTestState}),
                {provide: FmeClientService, useValue: fmeClientStub},
                {provide: NotificationsService, useValue: notify},
                {provide: WailsService, useValue: wailsStub},
                {provide: RendererFactory2, useValue: rendererFactoryStub},
            ],
        });
        service = TestBed.inject(ExportService);

        // Default to dev/browser mode; individual tests opt into packaged mode.
        deletePackagedMarker();
    });

    afterEach(() => {
        vi.clearAllMocks();
        deletePackagedMarker();
    });

    // isPackagedApp() checks window.chrome?.webview?.postMessage.
    function setPackagedMode() {
        (window as unknown as {chrome?: unknown}).chrome = {webview: {postMessage: () => undefined}};
    }
    function deletePackagedMarker() {
        delete (window as unknown as {chrome?: unknown}).chrome;
    }

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // exportJobs: iterates every job, gathers tasks, and generates one report.
    // -----------------------------------------------------------------------
    describe('exportJobs', () => {
        it('gathers tasks for each job and generates a report (xlsx default)', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1'), makeTask('t2')));

            service.exportJobs();

            expect(listJobs).toHaveBeenCalledTimes(1);
            expect(listTasksForJob).toHaveBeenCalledWith('j1');
            // Default format is xlsx -> generateExcelReport, then dev-mode anchor click.
            expect(generateExcelReport).toHaveBeenCalledTimes(1);
            expect(anchor.click).toHaveBeenCalledTimes(1);
        });

        it('routes csv format to generateCsvReport with the right filename + mimetype', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1')));

            service.exportJobs({format: 'csv', filename: 'my-jobs'});

            expect(generateCsvReport).toHaveBeenCalledTimes(1);
            expect(generateExcelReport).not.toHaveBeenCalled();
            expect(anchor.download).toMatch(/^my-jobs-\d{8}-\d{6}\.csv$/);
            expect(anchor.href).toContain('data:text/csv;base64,csv-base64');
        });

        it('routes json format to generateJsonReport', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1')));

            service.exportJobs({format: 'json'});

            expect(generateJsonReport).toHaveBeenCalledTimes(1);
            expect(anchor.href).toContain('data:application/json;base64,json-base64');
        });

        it('generates no report when there are no jobs', () => {
            listJobs.mockReturnValue(of([]));

            service.exportJobs();

            expect(listTasksForJob).not.toHaveBeenCalled();
            expect(generateExcelReport).not.toHaveBeenCalled();
            expect(anchor.click).not.toHaveBeenCalled();
        });

        it('maps download-direction jobs to TransferDirection.Download in the report data', () => {
            listJobs.mockReturnValue(of([makeJob('j1', 'DL job', 'download')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1')));

            service.exportJobs({format: 'json'});

            const data = generateJsonReport.mock.calls[0][0];
            expect(data.j1.direction).toBe(TransferDirection.Download);
        });

        it('logs and does not throw when listJobs errors', () => {
            const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            listJobs.mockReturnValue(throwError(() => new Error('list boom')));

            expect(() => service.exportJobs()).not.toThrow();
            expect(consoleErr).toHaveBeenCalled();
            expect(generateExcelReport).not.toHaveBeenCalled();
        });

        it('records a zero-task job without notifying (notifyEmpty is false for bulk export)', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            // Empty task stream -> complete with zero tasks.
            listTasksForJob.mockReturnValue(of());

            service.exportJobs();

            // Bulk export does not notify on empty jobs (notifyEmpty defaults to false).
            expect(notify.info).not.toHaveBeenCalled();
            // The job is still recorded (empty transfers) and a report is generated.
            expect(generateExcelReport).toHaveBeenCalledTimes(1);
            expect(generateExcelReport.mock.calls[0][0].j1.transfers).toEqual([]);
        });

        it('suppresses XLSX download when the generated report is empty', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1')));
            generateExcelReport.mockReturnValue(of(''));

            service.exportJobs({format: 'xlsx'});

            expect(notify.info).toHaveBeenCalledWith('There are no jobs to export. Not downloading XLSX file.');
            expect(anchor.click).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // exportJobById: finds a single job, and notifies on empty / missing jobs.
    // -----------------------------------------------------------------------
    describe('exportJobById', () => {
        it('exports the matching job only', () => {
            listJobs.mockReturnValue(of([makeJob('j1'), makeJob('j2')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1')));

            service.exportJobById('j2', {format: 'json'});

            expect(listTasksForJob).toHaveBeenCalledTimes(1);
            expect(listTasksForJob).toHaveBeenCalledWith('j2');
            expect(generateJsonReport).toHaveBeenCalledTimes(1);
        });

        it('notifies an error when the job id is not found', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));

            service.exportJobById('missing');

            expect(notify.error).toHaveBeenCalledWith('Couldn\'t export job report: job not found.');
            expect(listTasksForJob).not.toHaveBeenCalled();
        });

        it('notifies info when a found job has no transfers (complete with zero tasks)', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(of());

            service.exportJobById('j1');

            expect(notify.info).toHaveBeenCalledWith('This job has no transfers to export.');
            expect(generateExcelReport).not.toHaveBeenCalled();
        });

        it('notifies info on a ConnectError Internal with no tasks (missing-trailer empty stream)', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            const connErr = new ConnectError('missing trailer', Code.Internal);
            listTasksForJob.mockReturnValue(errorAfterNoEmit(connErr));

            service.exportJobById('j1');

            expect(notify.info).toHaveBeenCalledWith('This job has no transfers to export.');
            expect(notify.error).not.toHaveBeenCalled();
        });

        it('notifies an error on a non-Internal task-stream failure', () => {
            vi.spyOn(console, 'error').mockImplementation(() => undefined);
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(errorAfterNoEmit(new Error('stream boom')));

            service.exportJobById('j1');

            expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Couldn\'t export job report'));
            expect(notify.info).not.toHaveBeenCalled();
        });

        it('notifies an error when listJobs itself errors', () => {
            vi.spyOn(console, 'error').mockImplementation(() => undefined);
            listJobs.mockReturnValue(throwError(() => new Error('list boom')));

            service.exportJobById('j1');

            expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Couldn\'t export job report'));
        });
    });

    // -----------------------------------------------------------------------
    // Download path: packaged mode uses the native Save dialog via saveFile.
    // -----------------------------------------------------------------------
    describe('download path (packaged mode)', () => {
        beforeEach(() => setPackagedMode());

        it('calls saveFile and reports success with the saved path', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1')));
            saveFile.mockReturnValue(of('/chosen/report.json'));

            service.exportJobs({format: 'json'});

            expect(saveFile).toHaveBeenCalledTimes(1);
            expect(saveFile.mock.calls[0][1]).toBe('json-base64');
            expect(notify.success).toHaveBeenCalledWith('Exported to /chosen/report.json');
            // The dev-mode anchor path must not run in packaged mode.
            expect(anchor.click).not.toHaveBeenCalled();
        });

        it('stays silent when the user cancels the Save dialog (empty path)', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1')));
            saveFile.mockReturnValue(of(''));

            service.exportJobs({format: 'json'});

            expect(saveFile).toHaveBeenCalledTimes(1);
            expect(notify.success).not.toHaveBeenCalled();
        });

        it('notifies an error when saveFile fails', () => {
            listJobs.mockReturnValue(of([makeJob('j1')]));
            listTasksForJob.mockReturnValue(of(makeTask('t1')));
            saveFile.mockReturnValue(throwError(() => new Error('disk full')));

            service.exportJobs({format: 'json'});

            expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Export failed'));
        });
    });

    // -----------------------------------------------------------------------
    // Helper: an Observable that errors without emitting any task, mirroring an
    // empty task stream that terminates with an error (no next, then error).
    // -----------------------------------------------------------------------
    function errorAfterNoEmit(err: unknown): Observable<Task> {
        return new Observable<Task>((sub: Subscriber<Task>) => {
            sub.error(err);
        });
    }
});
