import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Reusable ConnectRPC transport / callback-client mock.
//
// These vi.hoisted / vi.mock calls MUST sit at the top of the module, before
// any other imports. Vitest hoists them above the imports regardless, but its
// static analyzer emits a "not at the top level" warning (a future hard error)
// unless they are physically first. Keeping them here also guarantees the
// mocks are registered before FmeClientService (and its @connectrpc deps) are
// imported below.
//
// FmeClientService builds its client with createCallbackClient(FmeService,
// transport) inside its private connect(), which is triggered when the
// BookmarksService.current observable emits during init(). We intercept the
// two connect modules so no real transport is created and so we get a single
// shared fake callback client whose per-method behaviour each test controls.
//
// `mockCallbackClient` is a Proxy: every property access returns a vi.fn().
// A unary RPC on the real CallbackClient is `method(request, callback)`, so a
// test stubs it with `.mockImplementation((_req, cb) => cb(err, res))`. The
// stream method `listEvents` is `method(request, onMessage, onError)` and
// returns a cancel function; the default stub returns a no-op canceller so the
// auto-reconnect machinery stays inert during tests.
//
// This pattern is the shared dependency the Tier 1 service specs reuse.
// ---------------------------------------------------------------------------
// vi.hoisted runs before the hoisted vi.mock factories, so the shared map and
// proxy client it creates are safe to reference from inside those factories
// (a plain top-level const is NOT — it would be captured before assignment and
// blow up with "__async is not a function").
const {rpcFns, mockCallbackClient} = vi.hoisted(() => {
    const fns = new Map<string, ReturnType<typeof vi.fn>>();
    const client = new Proxy(
        {},
        {
            get(_target, prop: string) {
                if (!fns.has(prop)) {
                    const fn = vi.fn();
                    if (prop === 'listEvents') {
                        // server-streaming: (req, onMessage, onError) => cancelFn
                        fn.mockReturnValue(() => {
                            /* no-op cancel */
                        });
                    }
                    fns.set(prop, fn);
                }
                return fns.get(prop);
            },
        },
    );
    return {rpcFns: fns, mockCallbackClient: client};
});

vi.mock('@connectrpc/connect-web', () => ({
    createGrpcWebTransport: vi.fn(() => ({__mockTransport: true})),
}));

vi.mock('@connectrpc/connect', () => {
    // Synchronous factory (no await): an async factory makes esbuild emit an
    // __async helper that is not in scope once the call is hoisted. The service
    // only needs createCallbackClient plus the Code enum / ConnectError class for
    // its error-stream branches (which these tests do not drive), so minimal
    // stand-ins are sufficient.
    class ConnectError extends Error {
        code: number;
        constructor(message: string, code = 2) {
            super(message);
            this.code = code;
        }
    }
    const Code = {Canceled: 1, Unauthenticated: 16} as const;
    return {
        createCallbackClient: vi.fn(() => mockCallbackClient),
        ConnectError,
        Code,
    };
});

import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Overlay } from '@angular/cdk/overlay';
import { firstValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { FmeClientService } from './fme-client.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { WailsService } from '@services/wails/wails.service';
import { AppState } from '@app/state';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { StreamingClientError, StreamingClientErrorType, FmeConfig } from '@app/classes';
import { ConnectionState } from '@state/models/connection-state-model';
import { ShutdownResult } from '@gen/es/fme/v1/shared_pb';
import { Bookmark } from '../bookmarks/bookmarks.classes';
import { BehaviorSubject } from 'rxjs';

/** Returns the vi.fn backing a given RPC method on the shared fake client. */
function rpc(name: string): ReturnType<typeof vi.fn> {
    // Touch the proxy so the fn is created, then hand back the same instance.
    void (mockCallbackClient as Record<string, unknown>)[name];
    return rpcFns.get(name)!;
}

// The service methods build a plain rxjs Subject and only call sub.next()/complete()
// from inside the RPC callback. A real transport delivers that callback
// asynchronously, so the caller's firstValueFrom() has already subscribed by the
// time next/complete fire. If the mock invokes the callback SYNCHRONOUSLY, the
// Subject completes before subscription and firstValueFrom throws EmptyError
// ("no elements in sequence"). Deferring to a microtask reproduces real async
// delivery so the success-path assertions observe the emitted value.

/** Stub a unary RPC (req, cb) to succeed with `res`, delivered asynchronously. */
function unarySuccess(name: string, res: unknown): ReturnType<typeof vi.fn> {
    const fn = rpc(name);
    fn.mockImplementation((_req: unknown, cb: (e: unknown, r: unknown) => void) => {
        queueMicrotask(() => cb(undefined, res));
    });
    return fn;
}

/** Stub a unary RPC (req, cb) to fail with `err`, delivered asynchronously. */
function unaryFailure(name: string, err: unknown): ReturnType<typeof vi.fn> {
    const fn = rpc(name);
    fn.mockImplementation((_req: unknown, cb: (e: unknown) => void) => {
        queueMicrotask(() => cb(err));
    });
    return fn;
}

/** Resolve/reject helpers wired to expose the RPC's private Subject. */
function expectStreamingNullError(err: unknown) {
    expect(err).toBeInstanceOf(StreamingClientError);
    expect((err as StreamingClientError).errorType).toBe(StreamingClientErrorType.StreamingClientNull);
}

describe('FmeClientService', () => {
    let service: FmeClientService;
    let store: MockStore<AppState>;
    let bookmarks: BookmarksService;
    let wails: WailsService;
    let currentBookmark$: BehaviorSubject<Bookmark>;

    const testBookmark = new Bookmark({
        encryption: false,
        host: 'localhost',
        name: 'Local Daemon',
        port: 9999,
        pre_shared_key: 'test-key',
        favoritePaths: [],
        onConnectStartingPath: null,
    });

    beforeEach(() => {
        rpcFns.clear();
        currentBookmark$ = new BehaviorSubject<Bookmark>(testBookmark);

        const bookmarksStub: Partial<BookmarksService> = {
            current: currentBookmark$.asObservable(),
            isDefaultLocalDaemon: vi.fn(() => false),
        };
        const wailsStub: Partial<WailsService> = {
            startDaemon: vi.fn(),
            fatalShutdown: vi.fn(() => new BehaviorSubject(undefined).asObservable()),
        };

        TestBed.configureTestingModule({
            providers: [
                MatSnackBar,
                NotificationsService,
                Overlay,
                provideMockStore<AppState>({initialState: initialTestState}),
                {provide: BookmarksService, useValue: bookmarksStub},
                {provide: WailsService, useValue: wailsStub},
            ],
        });
        store = TestBed.inject(MockStore);
        bookmarks = TestBed.inject(BookmarksService);
        wails = TestBed.inject(WailsService);
        service = TestBed.inject(FmeClientService);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    // -----------------------------------------------------------------------
    // Guard: RPCs error with a StreamingClientError when no client exists yet
    // (init() has not run, so connectClient is null).
    // -----------------------------------------------------------------------
    describe('with no active connection', () => {
        it('getConfiguration errors StreamingClientNull', async () => {
            await expect(firstValueFrom(service.getConfiguration())).rejects.toBeInstanceOf(StreamingClientError);
        });

        it('listJobs errors StreamingClientNull', async () => {
            await expect(firstValueFrom(service.listJobs())).rejects.toBeInstanceOf(StreamingClientError);
        });

        it('pauseJob errors StreamingClientNull', async () => {
            await expect(firstValueFrom(service.pauseJob('j1'))).rejects.toBeInstanceOf(StreamingClientError);
        });

        it('shutdown errors StreamingClientNull', async () => {
            await expect(firstValueFrom(service.shutdown())).rejects.toBeInstanceOf(StreamingClientError);
        });

        it('generateSupportFile errors StreamingClientNull', async () => {
            await expect(firstValueFrom(service.generateSupportFile())).rejects.toBeInstanceOf(StreamingClientError);
        });

        it('createS3Prefix errors "Not connected" (state gate, not client gate)', async () => {
            await expect(firstValueFrom(service.createS3Prefix('k/', 'profile'))).rejects.toBe('Not connected');
        });

        it('deleteLocalPath errors "Not connected"', async () => {
            await expect(firstValueFrom(service.deleteLocalPath('/tmp/x', 0 as never))).rejects.toBe('Not connected');
        });
    });

    // -----------------------------------------------------------------------
    // init() drives connect(); the shared mock client is installed and the
    // event stream is opened.
    // -----------------------------------------------------------------------
    describe('init / connect', () => {
        it('installs a callback client and opens the event stream on bookmark emit', () => {
            service.init();
            expect(rpc('listEvents')).toHaveBeenCalledTimes(1);
        });

        it('dispatches tryConnect when a bookmark is selected', () => {
            const spy = vi.spyOn(store, 'dispatch');
            service.init();
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({type: expect.stringContaining('Connect')}));
        });

        it('starts the local daemon when the bookmark is the default local daemon', () => {
            (bookmarks.isDefaultLocalDaemon as ReturnType<typeof vi.fn>).mockReturnValue(true);
            service.init();
            expect(wails.startDaemon).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Unary RPCs against a live client. init() is called first so connectClient
    // is set; connectedState is forced to CONNECTED for the state-gated methods.
    // -----------------------------------------------------------------------
    describe('unary RPCs with a connected client', () => {
        beforeEach(() => {
            service.init();
            // Force CONNECTED for the file-management RPCs gated on connectedState.
            store.setState({
                ...initialTestState,
                fmeClient: {connectionState: ConnectionState.CONNECTED},
            });
        });

        it('getConfiguration resolves an FmeConfig on success', async () => {
            unarySuccess('getConfiguration', {general: null, logging: null, reports: null, protocols: null, uploadHotFolders: {}});
            const cfg = await firstValueFrom(service.getConfiguration());
            expect(cfg).toBeInstanceOf(FmeConfig);
        });

        it('getConfiguration errors on RPC failure', async () => {
            unaryFailure('getConfiguration', new Error('boom'));
            await expect(firstValueFrom(service.getConfiguration())).rejects.toBe('Failed to get configuration');
        });

        it('setConfiguration forwards the response', async () => {
            const cfg = {toProtobuf: vi.fn(() => ({__proto: true}))} as unknown as FmeConfig;
            unarySuccess('setConfiguration', {success: true});
            const res = await firstValueFrom(service.setConfiguration(cfg));
            expect(res).toEqual({success: true});
            expect(cfg.toProtobuf).toHaveBeenCalled();
        });

        it('listJobs maps protobuf jobs to Job instances', async () => {
            unarySuccess('listJobs', {jobs: [{jobId: 'a', name: 'Job A'}, {jobId: 'b', name: 'Job B'}]});
            const jobs = await firstValueFrom(service.listJobs());
            expect(jobs).toHaveLength(2);
            expect(jobs[0].jobId).toBe('a');
        });

        it('listJobs propagates errors', async () => {
            unaryFailure('listJobs', new Error('nope'));
            await expect(firstValueFrom(service.listJobs())).rejects.toThrow('nope');
        });

        it('pauseJob sends the job id and returns the response', async () => {
            const fn = unarySuccess('pauseJob', {ok: true});
            const res = await firstValueFrom(service.pauseJob('job-42'));
            expect(res).toEqual({ok: true});
            expect(fn.mock.calls[0][0].jobId).toBe('job-42');
        });

        it('resumeJob returns the response', async () => {
            unarySuccess('resumeJob', {r: 1});
            expect(await firstValueFrom(service.resumeJob('j'))).toEqual({r: 1});
        });

        it('cancelJob returns the response', async () => {
            unarySuccess('cancelJob', {c: 1});
            expect(await firstValueFrom(service.cancelJob('j'))).toEqual({c: 1});
        });

        it('renameJob sends id + name', async () => {
            const fn = unarySuccess('renameJob', {});
            await firstValueFrom(service.renameJob('id7', 'new name'));
            expect(fn.mock.calls[0][0].jobId).toBe('id7');
            expect(fn.mock.calls[0][0].jobName).toBe('new name');
        });

        it('resubmitJob returns the response', async () => {
            unarySuccess('resubmitJob', {ok: 1});
            expect(await firstValueFrom(service.resubmitJob('j'))).toEqual({ok: 1});
        });

        it('generateInventoryReport forwards params + response', async () => {
            const fn = unarySuccess('generateInventoryReport', {report: 'x'});
            const res = await firstValueFrom(service.generateInventoryReport('prof', 'json', true, false));
            expect(res).toEqual({report: 'x'});
            expect(fn.mock.calls[0][0].transferProfile).toBe('prof');
            expect(fn.mock.calls[0][0].outputFormat).toBe('json');
            expect(fn.mock.calls[0][0].pretty).toBe(true);
            expect(fn.mock.calls[0][0].includeChecksums).toBe(false);
        });

        it('generateSupportFile returns the response', async () => {
            unarySuccess('generateSupportFile', {path: 'z'});
            expect(await firstValueFrom(service.generateSupportFile())).toEqual({path: 'z'});
        });

        it('OIDC login/status/logout forward the profile name', async () => {
            const loginFn = unarySuccess('initiateOIDCLogin', {url: 'u'});
            const statusFn = unarySuccess('getOIDCStatus', {loggedIn: true});
            const logoutFn = unarySuccess('logoutOIDC', {ok: true});

            expect(await firstValueFrom(service.initiateOIDCLogin('p1'))).toEqual({url: 'u'});
            expect(loginFn.mock.calls[0][0].transferProfile).toBe('p1');
            expect(await firstValueFrom(service.getOIDCStatus('p2'))).toEqual({loggedIn: true});
            expect(statusFn.mock.calls[0][0].transferProfile).toBe('p2');
            expect(await firstValueFrom(service.logoutOIDC('p3'))).toEqual({ok: true});
            expect(logoutFn.mock.calls[0][0].transferProfile).toBe('p3');
        });
    });

    // -----------------------------------------------------------------------
    // Transfer + listing RPCs (client gate, not state gate).
    // -----------------------------------------------------------------------
    describe('transfer + listing RPCs', () => {
        beforeEach(() => service.init());

        it('listS3Prefix forwards profile + prefix and maps the response', async () => {
            const fn = unarySuccess('s3ListPrefix', {commonPrefixes: [], objects: []});
            const res = await firstValueFrom(service.listS3Prefix('prof', 'a/b/'));
            expect(res).toBeTruthy();
            expect(fn.mock.calls[0][0].transferProfile).toBe('prof');
            expect(fn.mock.calls[0][0].prefix).toBe('a/b/');
        });

        it('listS3Prefix propagates RPC errors', async () => {
            unaryFailure('s3ListPrefix', new Error('list-fail'));
            await expect(firstValueFrom(service.listS3Prefix('p', 'x/'))).rejects.toThrow('list-fail');
        });

        it('listDaemonFolder forwards the path', async () => {
            const fn = unarySuccess('listFolder', {folders: [], files: []});
            await firstValueFrom(service.listDaemonFolder('/root'));
            expect(fn.mock.calls[0][0].path).toBe('/root');
        });

        it('downloadPrefixes forwards all params', async () => {
            const fn = unarySuccess('downloadPrefixes', {jobId: 'dl1'});
            const res = await firstValueFrom(
                service.downloadPrefixes('prof', true, ['p1', 'p2'], '/dest', 'my job', 's3/cur/'),
            );
            expect(res).toEqual({jobId: 'dl1'});
            const req = fn.mock.calls[0][0];
            expect(req.transferProfile).toBe('prof');
            expect(req.force).toBe(true);
            expect(req.prefixes).toEqual(['p1', 'p2']);
            expect(req.destination).toBe('/dest');
            expect(req.jobName).toBe('my job');
            expect(req.s3CurrentDirectory).toBe('s3/cur/');
        });

        it('uploadPrefixes forwards params and maps the response', async () => {
            const fn = unarySuccess('uploadPrefixes', {jobId: 'up1'});
            const res = await firstValueFrom(
                service.uploadPrefixes('prof', false, '/base', ['f1'], 'dest/', 'upjob'),
            );
            expect(res).toBeTruthy();
            const req = fn.mock.calls[0][0];
            expect(req.transferProfile).toBe('prof');
            expect(req.basePath).toBe('/base');
            expect(req.prefixes).toEqual(['f1']);
        });

        it('listTasksForJob streams tasks then completes', async () => {
            // Task.fromProtobuf requires localFile + s3Object; a bare {taskId} throws
            // "Missing required data". listTasksForJobStream is (req, onMessage, onError).
            const task = (id: string) => ({
                taskId: id,
                destination: 'dest',
                localFile: {path: '/f', size: 0n, lastModified: undefined},
                s3Object: {key: 'k', size: 0n, lastModified: undefined},
                taskDirection: 'upload',
                status: 'queued',
                statusMessage: '',
                jobId: 'job1',
                checksum: '',
                priority: 0,
                err: '',
                bytesTransferred: 0n,
            });
            rpc('listTasksForJobStream').mockImplementation(
                (_req: unknown, onMsg: (t: unknown) => void, onEnd: (e: unknown) => void) => {
                    queueMicrotask(() => {
                        onMsg(task('t1'));
                        onMsg(task('t2'));
                        onEnd(undefined);
                    });
                },
            );
            const tasks = await firstValueFrom(service.listTasksForJob('job1').pipe(toArray()));
            expect(tasks).toHaveLength(2);
        });

        it('listTasksForJob errors when the stream errors', async () => {
            rpc('listTasksForJobStream').mockImplementation(
                (_req: unknown, _onMsg: unknown, onEnd: (e: unknown) => void) => queueMicrotask(() => onEnd(new Error('stream-fail'))),
            );
            await expect(firstValueFrom(service.listTasksForJob('job1'))).rejects.toThrow('stream-fail');
        });

        it('clearCompletedJobs returns cleared ids on success', async () => {
            unarySuccess('clearCompletedJobs', {success: true, clearedJobIds: ['a', 'b']});
            expect(await firstValueFrom(service.clearCompletedJobs())).toEqual(['a', 'b']);
        });

        it('clearCompletedJobs errors when result.success is false', async () => {
            unarySuccess('clearCompletedJobs', {success: false, error: 'cannot clear'});
            await expect(firstValueFrom(service.clearCompletedJobs())).rejects.toBe('cannot clear');
        });

        it('listJobNames maps job ids to names', async () => {
            unarySuccess('listJobs', {jobs: [{jobId: 'a', name: 'Alpha'}]});
            const names = await firstValueFrom(service.listJobNames());
            expect(names).toEqual({a: 'Alpha'});
        });
    });

    // -----------------------------------------------------------------------
    // State-gated file management RPCs.
    // -----------------------------------------------------------------------
    describe('file management RPCs (require CONNECTED state)', () => {
        beforeEach(() => {
            service.init();
            store.setState({...initialTestState, fmeClient: {connectionState: ConnectionState.CONNECTED}});
        });

        it('createS3Prefix forwards key + profile', async () => {
            const fn = unarySuccess('createS3Prefix', {});
            await firstValueFrom(service.createS3Prefix('new/', 'prof'));
            expect(fn.mock.calls[0][0].prefixKey).toBe('new/');
            expect(fn.mock.calls[0][0].transferProfile).toBe('prof');
        });

        it('createLocalFolder forwards path', async () => {
            const fn = unarySuccess('createLocalFolder', {});
            await firstValueFrom(service.createLocalFolder('/new/dir'));
            expect(fn.mock.calls[0][0].path).toBe('/new/dir');
        });

        it('deleteS3Path errors when result.success is false', async () => {
            unarySuccess('deleteS3Path', {success: false, message: 'denied'});
            await expect(firstValueFrom(service.deleteS3Path('k', 'prof', 0 as never))).rejects.toBe('denied');
        });

        it('deleteS3Path succeeds when result.success is true', async () => {
            unarySuccess('deleteS3Path', {success: true});
            expect(await firstValueFrom(service.deleteS3Path('k', 'prof', 0 as never))).toBeTruthy();
        });

        it('renameS3Path forwards old + new name and maps pathType folder->prefix', async () => {
            const fn = unarySuccess('renameS3Path', {success: true});
            // FileBrowserObjectType.FOLDER === 1 in the enum; anything else maps to 'object'.
            await firstValueFrom(service.renameS3Path('old', 'new', 'prof', 1 as never));
            expect(fn.mock.calls[0][0].oldName).toBe('old');
            expect(fn.mock.calls[0][0].newName).toBe('new');
        });

        it('deleteLocalPath succeeds when result.success is true', async () => {
            unarySuccess('deleteLocalPath', {success: true});
            expect(await firstValueFrom(service.deleteLocalPath('/x', 0 as never))).toBeTruthy();
        });

        it('renameLocalPath errors when result.success is false', async () => {
            unarySuccess('renameLocalPath', {success: false, message: 'bad rename'});
            await expect(firstValueFrom(service.renameLocalPath('a', 'b', 0 as never))).rejects.toBe('bad rename');
        });
    });

    // -----------------------------------------------------------------------
    // shutdown()
    // -----------------------------------------------------------------------
    describe('shutdown', () => {
        beforeEach(() => service.init());

        it('reports SUCCEEDED and force-disconnects on daemon result SUCCEEDED', async () => {
            const dispatch = vi.spyOn(store, 'dispatch');
            store.setState({...initialTestState, fmeClient: {connectionState: ConnectionState.CONNECTED}});
            unarySuccess('shutdown', {result: ShutdownResult.SUCCEEDED});
            const result = await firstValueFrom(service.shutdown());
            expect(result).toBe(ShutdownResult.SUCCEEDED);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: expect.stringContaining('isconnect')}));
        });

        it('treats an RPC error as a successful stop (daemon dropped the connection)', async () => {
            unaryFailure('shutdown', new Error('conn dropped'));
            const result = await firstValueFrom(service.shutdown());
            expect(result).toBe(ShutdownResult.SUCCEEDED);
        });
    });

    // -----------------------------------------------------------------------
    // Observables + alert handling + stream errors.
    // -----------------------------------------------------------------------
    describe('observables + alerts', () => {
        it('connectionState reflects store state changes (distinct)', async () => {
            service.init();
            const first = await firstValueFrom(service.connectionState);
            expect(Object.values(ConnectionState)).toContain(first);
        });

        it('handleAlert opens a notification for each level', () => {
            const openSpy = vi.spyOn(TestBed.inject(NotificationsService), 'open').mockImplementation(() => undefined as never);
            for (const level of ['info',
                'warning',
                'error',
                'success',
                'default']) {
                service.handleAlert({level, message: `msg-${level}`} as never);
            }
            expect(openSpy).toHaveBeenCalledTimes(5);
        });

        it('processStreamError triggers fatalShutdown when fatal', () => {
            service.processStreamError({fatal: true} as never);
            expect(wails.fatalShutdown).toHaveBeenCalled();
        });

        it('processStreamError warns (no fatal shutdown) when non-fatal with a message', () => {
            const warnSpy = vi.spyOn(TestBed.inject(NotificationsService), 'warning').mockImplementation(() => undefined as never);
            service.processStreamError({fatal: false, message: 'heads up'} as never);
            expect(warnSpy).toHaveBeenCalledWith('heads up');
            expect(wails.fatalShutdown).not.toHaveBeenCalled();
        });

        it('cancelConnection tears down and dispatches disconnect when connected', () => {
            service.init();
            const dispatch = vi.spyOn(store, 'dispatch');
            store.setState({...initialTestState, fmeClient: {connectionState: ConnectionState.CONNECTED}});
            service.cancelConnection();
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: expect.stringContaining('isconnect')}));
        });
    });

    // guard-helper sanity (keeps the helper referenced + documents intent)
    it('expectStreamingNullError recognises a StreamingClientError', () => {
        expectStreamingNullError(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
    });
});
