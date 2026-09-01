import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { TransferService } from './transfer.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { FileBrowserService } from '@services/file-browser/file-browser.service';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { BUCKET_FILE_BROWSER_ID } from '@app/components/layout/bucket-browser/bucket-browser.constants';
import { DAEMON_FILE_BROWSER_ID } from '@app/components/layout/daemon-browser/daemon-browser.constants';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { JobStatus } from '@state/models/job.model';
import {
    JobCompleteEvent,
    JobCreateEvent,
    JobErrorEvent,
    JobProgressEvent,
} from '@app/classes/events/job';
import { JobUpdateEvent } from '@events/job/job-update-event';
import { JobStatusChangeEvent } from '@events/job/job-status-change-event';
import { JobChecksumProgressEvent } from '@events/job/job-checksum-progress-event';
import { TaskCompleteEvent } from '@events/job/task-complete-event';
import { TransferStatsEvent } from '@events/core';
import { BaseEvent } from '@app/interfaces/events';

// ---------------------------------------------------------------------------
// TransferService subscribes to FmeClientService.events$ in its constructor
// and translates each event into NgRx store dispatches (and, for task
// completion, a FileBrowserService auto-refresh request). The behavioral
// surface is therefore: push an event onto events$ and assert the resulting
// dispatch / refresh call.
//
// events$ is driven through a plain Subject we own. The service subscribes
// synchronously in its constructor, so events pushed after TestBed.inject are
// delivered to the live subscription; no queueMicrotask deferral is needed
// here because nothing bridges an RPC callback into firstValueFrom (the
// EmptyError hazard from the fme-client spec does not apply to this service).
// ---------------------------------------------------------------------------

describe('TransferService', () => {
    let service: TransferService;
    let store: MockStore<AppState>;
    let events$: Subject<BaseEvent>;
    let dispatchSpy: ReturnType<typeof vi.spyOn>;
    let sendAutoRefreshRequest: ReturnType<typeof vi.fn>;
    let processStreamError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        events$ = new Subject<BaseEvent>();
        processStreamError = vi.fn();
        sendAutoRefreshRequest = vi.fn();

        const fmeClientStub = {
            events$: events$.asObservable(),
            processStreamError,
        } as unknown as FmeClientService;
        const fileBrowserStub = {
            sendAutoRefreshRequest,
        } as unknown as FileBrowserService;

        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
            ],
            providers: [
                TransferService,
                provideMockStore<AppState>({initialState: initialTestState}),
                {provide: FmeClientService, useValue: fmeClientStub},
                {provide: FileBrowserService, useValue: fileBrowserStub},
            ],
        });

        store = TestBed.inject(MockStore);
        dispatchSpy = vi.spyOn(store, 'dispatch');
        service = TestBed.inject(TransferService);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('init logs without throwing', () => {
        expect(() => service.init()).not.toThrow();
    });

    // -----------------------------------------------------------------------
    // JobCreateEvent -> JobActions.create with a fully-populated Job.
    // -----------------------------------------------------------------------
    describe('JobCreateEvent', () => {
        it('dispatches create with a Created job built from the event', () => {
            const created = new Date('2026-01-01T00:00:00Z');
            events$.next(new JobCreateEvent(
                'job-1',
                'My Job',
                created,
                'prof',
                'dest/',
                TransferDirection.Upload,
                JobStatus.Created,
                true,
            ));

            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            const action = dispatchSpy.mock.calls[0][0] as { type: string, job: Record<string, unknown> };
            expect(action.type).toBe('[Job Service] Create Job');
            expect(action.job).toMatchObject({
                id: 'job-1',
                name: 'My Job',
                transferProfile: 'prof',
                status: JobStatus.Created,
                destination: 'dest/',
                direction: TransferDirection.Upload,
                timestampCreated: created,
                lastUpdate: created,
                force: true,
                bytesTransferred: 0,
                totalBytes: 0,
            });
        });
    });

    // -----------------------------------------------------------------------
    // JobProgressEvent -> JobActions.progress (Update<Job>).
    // -----------------------------------------------------------------------
    describe('JobProgressEvent', () => {
        it('dispatches progress with InProgress status and byte counts', () => {
            events$.next(new JobProgressEvent('job-2', 'Prog', 512, 1024));

            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            const action = dispatchSpy.mock.calls[0][0] as {
                type: string,
                job: { id: string, changes: Record<string, unknown> },
            };
            expect(action.type).toBe('[Job Service] Job Progress');
            expect(action.job.id).toBe('job-2');
            expect(action.job.changes).toMatchObject({
                status: JobStatus.InProgress,
                bytesTransferred: 512,
                totalBytes: 1024,
            });
            expect(action.job.changes['lastUpdate']).toBeInstanceOf(Date);
        });
    });

    // -----------------------------------------------------------------------
    // JobCompleteEvent -> JobActions.complete with Completed status.
    // -----------------------------------------------------------------------
    describe('JobCompleteEvent', () => {
        it('dispatches complete with Completed status and task flags', () => {
            const completed = new Date('2026-02-02T02:02:02Z');
            events$.next(new JobCompleteEvent('job-3', 'Done', completed, false, true, false));

            const action = dispatchSpy.mock.calls[0][0] as {
                type: string,
                job: { id: string, changes: Record<string, unknown> },
            };
            expect(action.type).toBe('[Job Service] Complete Job');
            expect(action.job.id).toBe('job-3');
            expect(action.job.changes).toMatchObject({
                status: JobStatus.Completed,
                hasTaskErrors: false,
                hasSuccessfulTasks: true,
                timestampCompleted: completed,
                lastUpdate: completed,
            });
        });
    });

    // -----------------------------------------------------------------------
    // JobErrorEvent -> JobActions.complete with Error status + message.
    // -----------------------------------------------------------------------
    describe('JobErrorEvent', () => {
        it('dispatches complete with Error status and the error message', () => {
            const errorTime = new Date('2026-03-03T03:03:03Z');
            events$.next(new JobErrorEvent('job-4', 'Broke', errorTime, 'disk full'));

            const action = dispatchSpy.mock.calls[0][0] as {
                type: string,
                job: { id: string, changes: Record<string, unknown> },
            };
            expect(action.type).toBe('[Job Service] Complete Job');
            expect(action.job.id).toBe('job-4');
            expect(action.job.changes).toMatchObject({
                status: JobStatus.Error,
                statusMessage: 'disk full',
                lastUpdate: errorTime,
            });
        });
    });

    // -----------------------------------------------------------------------
    // JobUpdateEvent -> JobActions.update (rename).
    // -----------------------------------------------------------------------
    describe('JobUpdateEvent', () => {
        it('dispatches update with the new name keyed by job id', () => {
            events$.next(new JobUpdateEvent('job-5', 'New Name', 'Old Name'));

            const action = dispatchSpy.mock.calls[0][0] as {
                type: string,
                job: { id: string, changes: Record<string, unknown> },
            };
            expect(action.type).toBe('[Job Service] Update Job Details');
            expect(action.job.id).toBe('job-5');
            expect(action.job.changes).toEqual({name: 'New Name'});
        });
    });

    // -----------------------------------------------------------------------
    // JobStatusChangeEvent -> JobActions.updateStatus, with the matching
    // timestamp field set per status.
    // -----------------------------------------------------------------------
    describe('JobStatusChangeEvent', () => {
        const ts = new Date('2026-04-04T04:04:04Z');

        const cases: [JobStatus, string][] = [
            [JobStatus.Created, 'timestampCreated'],
            [JobStatus.Discovering, 'timestampDiscovering'],
            [JobStatus.Checksumming, 'timestampChecksumming'],
            [JobStatus.InProgress, 'timestampTransferring'],
            [JobStatus.Completed, 'timestampCompleted'],
        ];

        it.each(cases)('sets %s timestamp on status change', (status, tsField) => {
            events$.next(new JobStatusChangeEvent('job-6', status, ts));

            const action = dispatchSpy.mock.calls[0][0] as {
                type: string,
                job: { id: string, changes: Record<string, unknown> },
            };
            expect(action.type).toBe('[Job Service] Update Status');
            expect(action.job.id).toBe('job-6');
            expect(action.job.changes['status']).toBe(status);
            expect(action.job.changes[tsField]).toBe(ts);
        });
    });

    // -----------------------------------------------------------------------
    // JobChecksumProgressEvent -> JobActions.updateChecksumProgress.
    // -----------------------------------------------------------------------
    describe('JobChecksumProgressEvent', () => {
        it('dispatches updateChecksumProgress carrying the event', () => {
            const evt = new JobChecksumProgressEvent('job-7', 10, 4);
            events$.next(evt);

            const action = dispatchSpy.mock.calls[0][0] as {
                type: string,
                job: { id: string, changes: { checksumProgress: unknown } },
            };
            expect(action.type).toBe('[Job Service] Update Checksum Progress');
            expect(action.job.id).toBe('job-7');
            expect(action.job.changes.checksumProgress).toBe(evt);
        });
    });

    // -----------------------------------------------------------------------
    // TaskCompleteEvent -> FileBrowserService.sendAutoRefreshRequest, routed
    // by direction; no store dispatch.
    // -----------------------------------------------------------------------
    describe('TaskCompleteEvent', () => {
        it('refreshes the bucket browser on an upload task completion', () => {
            events$.next(new TaskCompleteEvent('job-8', TransferDirection.Upload, 's3/dest/'));

            expect(sendAutoRefreshRequest).toHaveBeenCalledWith(BUCKET_FILE_BROWSER_ID, 's3/dest/');
            expect(dispatchSpy).not.toHaveBeenCalled();
        });

        it('refreshes the daemon browser on a download task completion', () => {
            events$.next(new TaskCompleteEvent('job-9', TransferDirection.Download, '/local/dest'));

            expect(sendAutoRefreshRequest).toHaveBeenCalledWith(DAEMON_FILE_BROWSER_ID, '/local/dest');
        });

        it('does not refresh when the task has no destination', () => {
            events$.next(new TaskCompleteEvent('job-10', TransferDirection.Upload, ''));

            expect(sendAutoRefreshRequest).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // TransferStatsEvent -> TransferStatsActions.update with the mapped stats.
    // -----------------------------------------------------------------------
    describe('TransferStatsEvent', () => {
        it('dispatches transfer-stats update with all six metrics', () => {
            events$.next(new TransferStatsEvent(1, 2, 100, 200, 3000, 4000));

            const action = dispatchSpy.mock.calls[0][0] as {
                type: string,
                transferStats: Record<string, number>,
            };
            expect(action.type).toBe('[TransferStats Service] Update');
            expect(action.transferStats).toEqual({
                activeDownloads: 1,
                activeUploads: 2,
                downloadBps: 100,
                uploadBps: 200,
                totalBytesDownloaded: 3000,
                totalBytesUploaded: 4000,
            });
        });
    });

    // -----------------------------------------------------------------------
    // Robustness: an unknown event is ignored, and a handler throwing is
    // swallowed (the subscription must survive to process later events).
    // -----------------------------------------------------------------------
    describe('event handling robustness', () => {
        it('ignores an event that matches no known type', () => {
            events$.next({logLevel: 0, logMessage: 'noop'} as unknown as BaseEvent);
            expect(dispatchSpy).not.toHaveBeenCalled();
            expect(sendAutoRefreshRequest).not.toHaveBeenCalled();
        });

        it('swallows a handler error and keeps processing subsequent events', () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            dispatchSpy.mockImplementationOnce(() => {
                throw new Error('dispatch blew up');
            });

            // First event triggers the throwing dispatch; must not tear down the stream.
            events$.next(new JobProgressEvent('job-11', 'A', 1, 2));
            expect(consoleError).toHaveBeenCalled();

            // Second event still gets handled.
            events$.next(new JobProgressEvent('job-12', 'B', 3, 4));
            const last = dispatchSpy.mock.calls.at(-1)![0] as { job: { id: string } };
            expect(last.job.id).toBe('job-12');
        });
    });
});
