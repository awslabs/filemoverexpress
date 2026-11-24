import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { VerificationGateService } from './verification-gate.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { Job, JobStatus } from '@state/models/job.model';
import { selectAll as jobSelectAll } from '@state/job/job.selectors';

// The service subscribes to the job store in init() and opens one gate dialog at
// a time for jobs in NEEDS_REVIEW. We drive the store with the mock selector and
// control each dialog's afterClosed() result.

function makeJob(over: Partial<Job> = {}): Job {
    return {
        id: 'job-1',
        name: 'Upload A',
        transferProfile: 'p',
        status: JobStatus.NeedsReview,
        statusMessage: '',
        totalBytes: 0,
        bytesTransferred: 0,
        progress: 0,
        eta: '',
        hasTaskErrors: false,
        hasSuccessfulTasks: false,
        lastUpdate: new Date(),
        destination: '/d',
        direction: TransferDirection.Upload,
        timestampCreated: new Date(),
        timestampDiscovering: null,
        timestampChecksumming: null,
        timestampTransferring: null,
        timestampCompleted: null,
        checksumProgress: null,
        force: false,
        ascMhlListed: 3,
        ascMhlVerified: 1,
        ascMhlProblems: 2,
        ascMhlAlgorithm: 'xxhash64',
        ...over,
    };
}

describe('VerificationGateService', () => {
    let service: VerificationGateService;
    let store: MockStore<AppState>;
    let dialogOpen: ReturnType<typeof vi.fn>;
    let resolveGate: ReturnType<typeof vi.fn>;
    let notifications: Record<string, ReturnType<typeof vi.fn>>;
    // Each afterClosed() pulls the next queued result, so multiple dialogs in one
    // test resolve in order.
    let closeResults: boolean[];

    beforeEach(() => {
        dialogOpen = vi.fn(() => ({
            afterClosed: () => of(closeResults.length ? closeResults.shift() : false),
        }));
        resolveGate = vi.fn(() => of({success: true}));
        notifications = {error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn()};
        closeResults = [];

        TestBed.configureTestingModule({
            providers: [
                VerificationGateService,
                provideMockStore<AppState>({initialState: initialTestState}),
                {provide: MatDialog, useValue: {open: dialogOpen}},
                {provide: FmeClientService, useValue: {resolveVerificationGate: resolveGate}},
                {provide: NotificationsService, useValue: notifications},
            ],
        });
        store = TestBed.inject(MockStore);
        store.overrideSelector(jobSelectAll, []);
        service = TestBed.inject(VerificationGateService);
    });

    it('opens the gate once for a job entering NEEDS_REVIEW and resolves stop on close', () => {
        closeResults = [false];
        service.init();
        store.overrideSelector(jobSelectAll, [makeJob({id: 'a'})]);
        store.refreshState();

        expect(dialogOpen).toHaveBeenCalledTimes(1);
        expect(resolveGate).toHaveBeenCalledWith('a', false);

        // Re-emitting the same still-parked job does not reopen it.
        store.refreshState();
        expect(dialogOpen).toHaveBeenCalledTimes(1);
    });

    it('resolves proceed=true when the operator chooses upload anyway', () => {
        closeResults = [true];
        service.init();
        store.overrideSelector(jobSelectAll, [makeJob({id: 'a'})]);
        store.refreshState();
        expect(resolveGate).toHaveBeenCalledWith('a', true);
    });

    it('shows a separate dialog for each of multiple NEEDS_REVIEW jobs, in order', () => {
        closeResults = [false, true];
        service.init();
        store.overrideSelector(jobSelectAll, [makeJob({id: 'a'}), makeJob({id: 'b'})]);
        store.refreshState();

        expect(dialogOpen).toHaveBeenCalledTimes(2);
        expect(resolveGate).toHaveBeenNthCalledWith(1, 'a', false);
        expect(resolveGate).toHaveBeenNthCalledWith(2, 'b', true);
    });

    it('notifies when the resolve RPC errors', () => {
        closeResults = [false];
        resolveGate.mockReturnValueOnce(throwError(() => new Error('boom')));
        service.init();
        store.overrideSelector(jobSelectAll, [makeJob({id: 'a'})]);
        store.refreshState();
        expect(notifications.error).toHaveBeenCalledWith('Unable to resolve verification review');
    });

    it('openGate re-raises the dialog for a specific job (Review action)', () => {
        closeResults = [false];
        service.init();
        service.openGate(makeJob({id: 'z'}));
        expect(dialogOpen).toHaveBeenCalledTimes(1);
        expect(resolveGate).toHaveBeenCalledWith('z', false);
    });

    it('does not reopen while a dialog is already showing', () => {
        // A dialog that never closes (afterClosed stays pending) blocks the queue.
        const pending = new Subject<boolean>();
        dialogOpen.mockReturnValue({afterClosed: () => pending.asObservable()});
        service.init();
        store.overrideSelector(jobSelectAll, [makeJob({id: 'a'}), makeJob({id: 'b'})]);
        store.refreshState();
        // Only the first job's dialog is open; the second waits in the queue.
        expect(dialogOpen).toHaveBeenCalledTimes(1);
    });

    it('closes the open dialog and skips resolve when its job leaves NEEDS_REVIEW', () => {
        const closed = new Subject<boolean | undefined>();
        const close = vi.fn(() => {
            closed.next(undefined);
            closed.complete();
        });
        dialogOpen.mockReturnValue({afterClosed: () => closed.asObservable(), close});
        service.init();
        store.overrideSelector(jobSelectAll, [makeJob({id: 'a'})]);
        store.refreshState();
        expect(dialogOpen).toHaveBeenCalledTimes(1);

        // The job leaves NEEDS_REVIEW out-of-band (e.g. cancelled from the CLI).
        store.overrideSelector(jobSelectAll, [makeJob({id: 'a', status: JobStatus.Cancelled})]);
        store.refreshState();

        expect(close).toHaveBeenCalledTimes(1);
        // The dialog closed because the job departed, not a user click, so no
        // resolve RPC is sent (it would be rejected by the daemon).
        expect(resolveGate).not.toHaveBeenCalled();
    });
});
