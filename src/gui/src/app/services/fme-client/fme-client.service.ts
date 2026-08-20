import { inject, Injectable } from '@angular/core';
import {
    FmeConfig,
    handleStreamError,
    NullBookmarkError,
    StreamError,
    StreamingClientError,
    StreamingClientErrorType,
} from '@app/classes';
import { FileBrowserObjectType } from '@app/components/layout/file-browser/file-browser.interfaces';
import { NotificationMessages } from '@app/constants/common.constants';
import { BaseEvent } from '@app/interfaces/events';
import { create } from '@bufbuild/protobuf';
import {
    CreateLocalFolderResponse,
    CreateS3PrefixResponse,
    DeleteLocalPathResponse,
    DeleteS3PathResponse,
    FSFolder,
    Job,
    RenameLocalPathResponse,
    RenameS3PathResponse,
    S3ListPrefix,
    Task as JobTask,
    UploadPrefixResponse,
} from '@classes/grpc';
import { CallbackClient, Code, ConnectError, createCallbackClient, Interceptor } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import { GetConfigurationRequestSchema, GRPCFmeConfig, SetConfigurationResponse } from '@gen/es/fme/v1/config_pb';
import { EventType } from '@gen/es/fme/v1/events_pb';
import { FmeService, ListEventsRequestSchema, ListEventsResponse } from '@gen/es/fme/v1/fme_service_pb';
import { InventoryReportRequestSchema, InventoryReportResponse } from '@gen/es/fme/v1/inventory_pb';
import {
    CancelJobRequestSchema,
    CancelJobResponse,
    ClearCompletedJobsRequestSchema,
    ListJobsRequestSchema,
    ListTasksForJobRequestSchema,
    PauseJobRequestSchema,
    PauseJobResponse,
    RenameJobRequestSchema,
    RenameJobResponse,
    ResubmitJobRequestSchema,
    ResubmitJobResponse,
    ResumeJobRequestSchema,
    ResumeJobResponse,
} from '@gen/es/fme/v1/job_pb';
import {
    CreateLocalFolderRequestSchema,
    DeleteLocalPathRequestSchema,
    FsFolder,
    ListFolderRequestSchema,
    RenameLocalPathRequestSchema,
} from '@gen/es/fme/v1/remote_daemon_pb';
import { ShutdownRequestSchema, ShutdownResult } from '@gen/es/fme/v1/shared_pb';
import { CreateSupportFileRequestSchema, CreateSupportFileResponse } from '@gen/es/fme/v1/supportfile_pb';
import { Store } from '@ngrx/store';
import * as ProgressActions from '@state/fme-client/actions/fme-client.actions';
import { succeedConnect, tryConnect } from '@state/fme-client/actions/fme-client.actions';
import { selectConnectionState } from '@state/fme-client/fme-client.selectors';
import { FmeClientState } from '@state/fme-client/reducers/fme-client.reducer';
import { ConnectionState } from '@state/models/connection-state-model';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Bookmark } from '../bookmarks/bookmarks.classes';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { PanelLevel } from '../notifications/notifications.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { authKey, backoffconnectionFactors, initialConnectionGracePeriod } from './fme-client.constants';
import { WailsService } from '@services/wails/wails.service';
import {
    AlertEvent,
    MessageEvent as FmeMessageEvent,
    MetadataEvent,
    NewVersionAvailableEvent,
    ServerDisconnectEvent,
    TransferStatsEvent,
    UnsupportedVersionEvent,
} from '@events/core';
import {
    CreateS3PrefixRequestSchema,
    DeleteS3PathRequestSchema,
    DownloadPrefixesRequestSchema,
    DownloadPrefixesResponse,
    RenameS3PathRequestSchema,
    S3ListPrefixRequestSchema,
    S3ListPrefixResponse,
    UploadPrefixResponse as ProtoUploadPrefixResponse,
    UploadPrefixRequestSchema,
} from '@gen/es/s3_shared/v1/s3_pb';
import {
    InventoryReportCompletedEvent,
    InventoryReportErrorEvent,
    InventoryReportStartedEvent,
} from '@events/inventory';
import {
    OIDCLoginRequestSchema,
    OIDCLoginResponse,
    OIDCLogoutRequestSchema,
    OIDCLogoutResponse,
    OIDCStatusRequestSchema,
    OIDCStatusResponse,
} from '@gen/es/fme/v1/fme_service_pb';
import {
    JobChecksumProgressEvent,
    JobCompleteEvent,
    JobCreateEvent,
    JobErrorEvent,
    JobProgressEvent,
    JobStatusChangeEvent,
    JobUpdateEvent,
    TaskCompleteEvent,
} from '@events/job';

@Injectable({
    providedIn: 'root',
})
export class FmeClientService {
    private store = inject<Store<FmeClientState>>(Store);
    private notifications = inject(NotificationsService);
    private bookmarksService = inject(BookmarksService);
    private wails = inject(WailsService);

    private readonly _events$ = new Subject<BaseEvent>();
    private connectedState = ConnectionState.DISCONNECTED;
    private readonly connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
    private readonly metadata$ = new BehaviorSubject<MetadataEvent>(new MetadataEvent());
    private currentBookmark: Bookmark | null = null;
    private connectClient: CallbackClient<typeof FmeService> | null = null;
    private eventStreamCancel: (() => void | null) | null = null;
    private currentConnectAttemptID = '';
    private connectionAttempts = 0;
    // Tracks whether we've already surfaced the "couldn't connect" toast for the
    // current run of failures, so quiet background retries don't spam it.
    private connectionFailureNotified = false;

    init() {
        this.store.select(selectConnectionState).pipe(
            handleStreamError({retryCount: 5, fatal: true}),
        ).subscribe({
            next: (data) => {
                this.connectedState = data;
                this.connectionState$.next(data);
            },
            error: (error) => {
                this.processStreamError(error);
            },
        });
        this.bookmarksService.current.pipe(
            handleStreamError({
                retryCount: 5,
                nonFatalMessage: 'Error occurred when getting current bookmark, please restart.',
            }),
        ).subscribe({
            next: (currentSelection) => {
                try {
                    if (currentSelection && currentSelection.address) {
                        this.currentBookmark = currentSelection;
                        this.currentConnectAttemptID = this.generateNewConnectID(currentSelection);
                        this.connectionAttempts = 0;
                        this.connectionFailureNotified = false;
                        this.connect(true, this.currentConnectAttemptID);
                    } else {
                        console.log(`New connection to ${currentSelection.name} requested, but missing the server address: ${currentSelection.address}`);
                    }
                } catch (e) {
                    console.error(e);
                    this.notifications.error(NotificationMessages.BOOKMARK_CONNECT_ERROR);
                }
            },
            error: (error) => {
                this.processStreamError(error);
            },
        });
    }

    // region Property getters and setters
    get events$(): Observable<BaseEvent> {
        return this._events$.asObservable();
    }

    get connectionState(): Observable<ConnectionState> {
        return this.connectionState$.pipe(distinctUntilChanged()) as Observable<ConnectionState>;
    }

    get metadata(): Observable<MetadataEvent> {
        return this.metadata$.pipe(distinctUntilChanged()) as Observable<MetadataEvent>;
    }

    // endregion

    // region Configuration
    getConfiguration(): Observable<FmeConfig> {
        const sub = new Subject<FmeConfig>();
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }
        this.connectClient.getConfiguration(
            create(GetConfigurationRequestSchema),
            (err: ConnectError | undefined, res: GRPCFmeConfig) => {
                if (err) {
                    sub.error('Failed to get configuration');
                    return;
                }
                sub.next(FmeConfig.fromProtobuf(res));
                sub.complete();
            },
        );
        return sub.asObservable();
    }

    setConfiguration(config: FmeConfig): Observable<SetConfigurationResponse> {
        const sub = new Subject<SetConfigurationResponse>();
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }
        this.connectClient.setConfiguration(
            config.toProtobuf(),
            (err: ConnectError | undefined, res: SetConfigurationResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    // endregion

    // region Listing files
    listS3Prefix(txProfile: string, prefix: string): Subject<S3ListPrefix> {
        const sub = new Subject<S3ListPrefix>();
        const req = create(S3ListPrefixRequestSchema);
        req.transferProfile = txProfile;
        req.prefix = prefix;

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub;
        }

        this.connectClient.s3ListPrefix(
            req,
            (err: ConnectError | undefined, res: S3ListPrefixResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(S3ListPrefix.fromProtobuf(res));
                sub.complete();
            },
        );

        return sub;
    }

    listDaemonFolder(path: string): Observable<FSFolder> {
        const sub = new Subject<FSFolder>();
        const req = create(ListFolderRequestSchema);
        req.path = path;

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.listFolder(
            req,
            (err: ConnectError | undefined, res: FsFolder) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(FSFolder.fromProtobuf(res));
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    //endregion

    // region Transfer RPC methods
    downloadPrefixes(
        txProfile: string,
        forceFlag: boolean,
        prefixes: string[],
        destination: string,
        jobName: string,
        s3CurrentDirectory: string,
    ): Observable<DownloadPrefixesResponse> {
        const sub = new Subject<DownloadPrefixesResponse>();
        const req = create(DownloadPrefixesRequestSchema);
        req.transferProfile = txProfile;
        req.force = forceFlag;
        req.prefixes = prefixes;
        req.destination = destination;
        req.jobName = jobName;
        req.s3CurrentDirectory = s3CurrentDirectory;

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.downloadPrefixes(
            req,
            (err: ConnectError | undefined, res: DownloadPrefixesResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    uploadPrefixes(
        txProfile: string,
        forceFlag: boolean,
        basePath: string,
        prefixes: string[],
        destination: string,
        jobName: string,
    ): Observable<UploadPrefixResponse> {
        const sub = new Subject<UploadPrefixResponse>();
        const req = create(UploadPrefixRequestSchema);
        req.transferProfile = txProfile;
        req.force = forceFlag;
        req.basePath = basePath;
        req.prefixes = prefixes;
        req.destination = destination;
        req.jobName = jobName;

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.uploadPrefixes(
            req,
            (err: ConnectError | undefined, res: ProtoUploadPrefixResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(UploadPrefixResponse.fromProtobuf(res));
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    pauseJob(jobId: string): Observable<PauseJobResponse> {
        const sub = new Subject<PauseJobResponse>();
        const req = create(PauseJobRequestSchema);
        req.jobId = jobId;
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }
        this.connectClient.pauseJob(
            req,
            (err, res) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );
        return sub.asObservable();
    }

    resumeJob(jobId: string): Observable<ResumeJobResponse> {
        const sub = new Subject<ResumeJobResponse>();
        const req = create(ResumeJobRequestSchema);
        req.jobId = jobId;
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }
        this.connectClient.resumeJob(
            req,
            (err, res) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );
        return sub.asObservable();
    }

    cancelJob(jobId: string): Observable<CancelJobResponse> {
        const sub = new Subject<CancelJobResponse>();
        const req = create(CancelJobRequestSchema);
        req.jobId = jobId;
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }
        this.connectClient.cancelJob(
            req,
            (err: ConnectError | undefined, res: CancelJobResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );
        return sub.asObservable();
    }

    renameJob(jobId: string, name: string): Observable<RenameJobResponse> {
        const sub = new Subject<RenameJobResponse>();
        const req = create(RenameJobRequestSchema);
        req.jobId = jobId;
        req.jobName = name;

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.renameJob(
            req,
            (err, res) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    listJobNames(): Observable<Record<string, string>> {
        const s = {};
        return this.listJobs().pipe(
            switchMap((jobs) => jobs.map((job) => {
                return {...s, ...{[job.jobId]: job.name}};
            }, s)),
        );
    }

    resubmitJob(jobId: string): Observable<ResubmitJobResponse> {
        const sub = new Subject<ResubmitJobResponse>();
        const req = create(ResubmitJobRequestSchema);
        req.jobId = jobId;

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.resubmitJob(
            req,
            (err: ConnectError | undefined, res: ResubmitJobResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    listJobs(): Observable<Job[]> {
        const sub = new Subject<Job[]>();
        const req = create(ListJobsRequestSchema);

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.listJobs(
            req,
            (err, res) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                const jobs = res.jobs.map((itm) => Job.fromProtobuf(itm));
                sub.next(jobs);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    listTasksForJob(jobId: string): Observable<JobTask> {
        const sub = new Subject<JobTask>();
        const req = create(ListTasksForJobRequestSchema);
        req.jobId = jobId;

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient?.listTasksForJobStream(
            req,
            (task) => {
                sub.next(JobTask.fromProtobuf(task));
            },
            (err) => {
                if (err === undefined) {
                    sub.complete();
                    return;
                }
                sub.error(err);
            },
        );

        return sub.asObservable();
    }

    clearCompletedJobs(): Observable<string[]> {
        const sub = new Subject<string[]>();
        const req = create(ClearCompletedJobsRequestSchema);

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient?.clearCompletedJobs(
            req,
            (err, result) => {
                if (err !== undefined) {
                    sub.error(err);
                    return;
                }

                if (!result.success) {
                    sub.error(result.error);
                    return;
                }

                if (result.success) {
                    sub.next(result.clearedJobIds);
                    sub.complete();
                }
            },
        );

        return sub.asObservable();
    }

    /**
     * Creates a new, empty prefix with the given key, for the currently active remote configuration
     *
     * @param prefixKey {string} Key of the prefix to create in the S3 bucket
     * @param transferProfile {string} Name of the transfer profile to create the prefix in
     *
     * @returns {Observable<CreateS3PrefixResponse>} Observable that returns the result from S3
     */
    createS3Prefix(prefixKey: string, transferProfile: string): Observable<CreateS3PrefixResponse> {
        const sub = new Subject<CreateS3PrefixResponse>();
        const req = create(CreateS3PrefixRequestSchema);

        if (this.connectedState !== ConnectionState.CONNECTED) {
            sub.error('Not connected');
            return sub.asObservable();
        }

        req.transferProfile = transferProfile;
        req.prefixKey = prefixKey;

        this.connectClient?.createS3Prefix(
            req,
            (err, result) => {
                if (err !== undefined) {
                    sub.error(err);
                    return;
                }

                sub.next(CreateS3PrefixResponse.fromProtobuf(result));
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    /**
     *
     * @param path
     */
    createLocalFolder(path: string): Observable<CreateLocalFolderResponse> {
        const sub = new Subject<CreateLocalFolderResponse>();
        const req = create(CreateLocalFolderRequestSchema);

        if (this.connectedState !== ConnectionState.CONNECTED) {
            sub.error('Not connected');
            return sub.asObservable();
        }

        req.path = path;

        this.connectClient?.createLocalFolder(
            req,
            (err, result) => {
                if (err !== undefined) {
                    sub.error(err);
                    return;
                }

                sub.next(CreateLocalFolderResponse.fromProtobuf(result));
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    deleteS3Path(pathToDelete: string, transferProfile: string, pathType: FileBrowserObjectType): Observable<DeleteS3PathResponse> {
        const sub = new Subject<DeleteS3PathResponse>();
        const req = create(DeleteS3PathRequestSchema);

        if (this.connectedState !== ConnectionState.CONNECTED) {
            sub.error('Not connected');
            return sub.asObservable();
        }

        req.pathToDelete = pathToDelete;
        req.transferProfile = transferProfile;
        req.pathType = pathType === FileBrowserObjectType.FOLDER ? 'prefix' : 'object';

        this.connectClient?.deleteS3Path(
            req,
            (err, result) => {
                if (err !== undefined) {
                    sub.error(err);
                    return;
                }

                if (!result.success) {
                    sub.error(result.message);
                    return;
                }

                sub.next(DeleteS3PathResponse.fromProtobuf(result));
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    renameS3Path(
        oldName: string,
        newName: string,
        transferProfile: string,
        pathType: FileBrowserObjectType,
    ): Observable<RenameS3PathResponse> {
        const sub = new Subject<RenameS3PathResponse>();
        const req = create(RenameS3PathRequestSchema);

        if (this.connectedState !== ConnectionState.CONNECTED) {
            sub.error('Not connected');
            return sub.asObservable();
        }

        req.oldName = oldName;
        req.newName = newName;
        req.transferProfile = transferProfile;
        req.pathType = pathType === FileBrowserObjectType.FOLDER ? 'prefix' : 'object';

        this.connectClient?.renameS3Path(
            req,
            (err, result) => {
                if (err !== undefined) {
                    sub.error(err);
                    return;
                }

                if (!result.success) {
                    sub.error(result.message);
                    return;
                }

                sub.next(RenameS3PathResponse.fromProtobuf(result));
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    deleteLocalPath(pathToDelete: string, pathType: FileBrowserObjectType): Observable<DeleteLocalPathResponse> {
        const sub = new Subject<DeleteLocalPathResponse>();
        const req = create(DeleteLocalPathRequestSchema);

        if (this.connectedState !== ConnectionState.CONNECTED) {
            sub.error('Not connected');
            return sub.asObservable();
        }

        req.pathToDelete = pathToDelete;
        req.pathType = pathType === FileBrowserObjectType.FOLDER ? 'folder' : 'file';

        this.connectClient?.deleteLocalPath(
            req,
            (err, result) => {
                if (err !== undefined) {
                    sub.error(err);
                    return;
                }

                if (!result.success) {
                    sub.error(result.message);
                    return;
                }

                sub.next(DeleteLocalPathResponse.fromProtobuf(result));
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    renameLocalPath(oldName: string, newName: string, pathType: FileBrowserObjectType): Observable<RenameLocalPathResponse> {
        const sub = new Subject<RenameLocalPathResponse>();
        const req = create(RenameLocalPathRequestSchema);

        if (this.connectedState !== ConnectionState.CONNECTED) {
            sub.error('Not connected');
            return sub.asObservable();
        }

        req.oldName = oldName;
        req.newName = newName;
        req.pathType = pathType === FileBrowserObjectType.FOLDER ? 'folder' : 'file';

        this.connectClient?.renameLocalPath(
            req,
            (err, result) => {
                if (err !== undefined) {
                    sub.error(err);
                    return;
                }

                if (!result.success) {
                    sub.error(result.message);
                    return;
                }

                sub.next(RenameLocalPathResponse.fromProtobuf(result));
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    // endregion

    // region Inventory Report
    generateInventoryReport(
        txProfile: string,
        outputFormat: string,
        pretty: boolean,
        includeChecksums: boolean,
    ): Observable<InventoryReportResponse> {
        const sub = new Subject<InventoryReportResponse>();
        const req = create(InventoryReportRequestSchema);
        req.transferProfile = txProfile;
        req.outputFormat = outputFormat;
        req.pretty = pretty;
        req.includeChecksums = includeChecksums;

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.generateInventoryReport(
            req,
            (err, res) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    // endregion

    // region Support file
    generateSupportFile(): Observable<CreateSupportFileResponse> {
        const sub = new Subject<CreateSupportFileResponse>();

        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.generateSupportFile(
            create(CreateSupportFileRequestSchema),
            (err, res) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(res);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    // endregion

    //region Shutdown
    shutdown(): Observable<ShutdownResult> {
        const sub = new Subject<ShutdownResult>();
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }

        this.connectClient.shutdown(
            create(ShutdownRequestSchema),
            (err, response) => {
                if (err) {
                    sub.error(err);
                    return;
                }

                sub.next(response.result);
                sub.complete();
            },
        );

        return sub.asObservable();
    }

    //endregion

    //region Alerts
    /**
     * handleAlert displays a notification based on the alert event. This function should live in NotificationService,
     * but would create a circular dependency because FmeClientService depends on NotificationService.
     * @param event The alert to be displayed
     */
    handleAlert(event: AlertEvent) {
        let panelLevel: PanelLevel = PanelLevel.DEFAULT;
        switch (event.level) {
            case 'info':
                panelLevel = PanelLevel.INFO;
                break;
            case 'warning':
                panelLevel = PanelLevel.WARNING;
                break;
            case 'error':
                panelLevel = PanelLevel.ERROR;
                break;
            case 'success':
                panelLevel = PanelLevel.SUCCESS;
                break;
            case 'default':
                panelLevel = PanelLevel.DEFAULT;
                break;
            default:
                console.error('Unknown notification level value');
        }
        this.notifications.open(event.message, panelLevel);
    }

    processStreamError(error: StreamError) {
        if (error?.fatal) {
            this.wails.fatalShutdown().subscribe();
        } else {
            if (error?.message) {
                this.notifications.warning(error.message);
            }
        }
    }

    // endregion

    disconnect() {
        if (this.connectClient && this.eventStreamCancel) {
            this.eventStreamCancel();
        }
    }

    private convertEvent(response: ListEventsResponse): BaseEvent | null {
        try {
            switch (response.eventType) {
                case EventType.INVENTORY_REPORT_STARTED_EVENT_TYPE:
                    return InventoryReportStartedEvent.fromProtobuf(response);
                case EventType.INVENTORY_REPORT_COMPLETED_EVENT_TYPE:
                    return InventoryReportCompletedEvent.fromProtobuf(response);
                case EventType.INVENTORY_REPORT_ERROR_EVENT_TYPE:
                    return InventoryReportErrorEvent.fromProtobuf(response);
                case EventType.NEW_VERSION_AVAILABLE_EVENT_TYPE:
                    return NewVersionAvailableEvent.fromProtobuf(response);
                case EventType.UNSUPPORTED_VERSION_EVENT_TYPE:
                    return UnsupportedVersionEvent.fromProtobuf(response);
                case EventType.SERVER_DISCONNECT_EVENT_TYPE:
                    return ServerDisconnectEvent.fromProtobuf(response);
                case EventType.MESSAGE_EVENT_TYPE:
                    return FmeMessageEvent.fromProtobuf(response);
                case EventType.METADATA_EVENT_TYPE:
                    // eslint-disable-next-line no-case-declarations
                    const md = MetadataEvent.fromProtobuf(response);
                    this.metadata$.next(md);
                    return md;
                case EventType.ALERT_EVENT_TYPE:
                    // eslint-disable-next-line no-case-declarations
                    const event = AlertEvent.fromProtobuf(response);
                    this.handleAlert(event);
                    return event;
                case EventType.JOB_CREATE_EVENT_TYPE:
                    return JobCreateEvent.fromProtobuf(response);
                case EventType.JOB_PROGRESS_EVENT_TYPE:
                    return JobProgressEvent.fromProtobuf(response);
                case EventType.JOB_COMPLETE_EVENT_TYPE:
                    return JobCompleteEvent.fromProtobuf(response);
                case EventType.JOB_STATUS_CHANGE_EVENT_TYPE:
                    return JobStatusChangeEvent.fromProtobuf(response);
                case EventType.JOB_ERROR_EVENT_TYPE:
                    return JobErrorEvent.fromProtobuf(response);
                case EventType.JOB_UPDATE_EVENT_TYPE:
                    return JobUpdateEvent.fromProtobuf(response);
                case EventType.TASK_COMPLETE_EVENT_TYPE:
                    return TaskCompleteEvent.fromProtobuf(response);
                case EventType.JOB_CHECKSUM_PROGRESS_EVENT:
                    return JobChecksumProgressEvent.fromProtobuf(response);
                case EventType.TRANSFER_STATS_EVENT_TYPE:
                    return TransferStatsEvent.fromProtobuf(response);
                default:
                    return null;
            }
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    /**
     * Generate a connection attempt ID with the bookmark to connect to and the time the connection attempt was made at
     * with millisecond precision.
     * @param bookmark Bookmark to connect to
     * @private
     */
    private generateNewConnectID(bookmark: Bookmark) {
        return `${bookmark.name} - ${Date.now()}`;
    }

    private connect(switchBookmarks: boolean, connectAttemptID: string) {
        const currentBookmark = this.currentBookmark;
        if (!currentBookmark) {
            throw new NullBookmarkError();
        }

        if (switchBookmarks) {
            // if switching bookmarks, want to cancel old stream
            if (this.connectedState != ConnectionState.DISCONNECTED) {
                // set status to disconnected when switching bookmarks
                this.store.dispatch(ProgressActions.disconnect());
            }
            if (this.connectClient) {
                if (this.eventStreamCancel) {
                    this.eventStreamCancel();
                }
                this.eventStreamCancel = null;
                this.connectClient = null;
            }
            if (this.connectedState != ConnectionState.CONNECTING) {
                // start process to connect
                this.store.dispatch(tryConnect());
            }
            // try to start the daemon if it's the default local daemon
            if (this.bookmarksService.isDefaultLocalDaemon(currentBookmark)) {
                this.wails.startDaemon();
            }
        } else if (this.connectedState === ConnectionState.CONNECTED) {
            // don't do anything if still on same bookmark and session is connected
            return;
        }

        const transport = createGrpcWebTransport({
            baseUrl: currentBookmark.address,
            interceptors: [createAuthInterceptor(currentBookmark.pre_shared_key)],
        });

        this.connectClient = createCallbackClient(FmeService, transport);
        this.eventStreamCancel = this.connectClient.listEvents(
            create(ListEventsRequestSchema),
            (event) => {
                if (this.connectedState != ConnectionState.CONNECTED) {
                    this.store.dispatch(succeedConnect());
                    // Fresh successful connection — reset backoff + failure notice so a
                    // future disconnection can surface its own failure toast.
                    this.connectionAttempts = 0;
                    this.connectionFailureNotified = false;
                }

                try {
                    const convertedEvent = this.convertEvent(event);
                    if (convertedEvent === null) {
                        console.error(`Unsupported event received: ${event.eventType}`);
                        console.debug(event);
                        return;
                    }

                    this._events$.next(convertedEvent);
                } catch (e) {
                    console.log(e);
                }
            },
            (err) => {
                const isCurrentAttempt = this.currentConnectAttemptID === connectAttemptID;

                if (err instanceof ConnectError && err.code === Code.Canceled) {
                    // Intentional teardown (bookmark switch, stop daemon, disconnect()) —
                    // reflect it immediately regardless of the grace period.
                    if (isCurrentAttempt && this.connectedState != ConnectionState.DISCONNECTED) {
                        this.store.dispatch(ProgressActions.disconnect());
                    }
                    this.notifications.info(`Disconnected from ${currentBookmark.name}. Clearing jobs table due to disconnection.`);
                    return;
                }

                if (err instanceof ConnectError && err.code === Code.Unauthenticated) {
                    // Terminal auth failure (bad/expired key) — surface immediately and stop
                    // retrying; waiting out the grace period would just delay a clear error.
                    if (isCurrentAttempt && this.connectedState != ConnectionState.DISCONNECTED) {
                        this.store.dispatch(ProgressActions.disconnect());
                    }
                    this.notifications.error('Failed authenticating with daemon. Update key and reconnect.');
                    return;
                }

                // Transient/network failure (includes "Failed to fetch" while the daemon is
                // still starting up). During the initial grace period, keep the UI in
                // CONNECTING and retry quietly — flipping to DISCONNECTED here is what caused
                // the "Connection Failed"/"Disconnected" flash on app startup, since the
                // panels classify any CONNECTING -> DISCONNECTED transition as a failure.
                // Only once the grace period is exhausted do we surface the disconnected
                // state and a one-time failure toast; background retries continue afterwards.
                const gracePeriodExhausted = this.connectionAttempts >= initialConnectionGracePeriod;
                if (isCurrentAttempt && this.connectedState != ConnectionState.DISCONNECTED && gracePeriodExhausted) {
                    this.store.dispatch(ProgressActions.disconnect());
                }
                if (gracePeriodExhausted && !this.connectionFailureNotified) {
                    this.connectionFailureNotified = true;
                    this.notifications.error(
                        `Couldn't connect to ${currentBookmark.name}. Make sure the daemon is running and ` +
                        'reachable and that your connection settings are correct, then retry.');
                }

                let retryConnectionTime = 5000;
                if (this.connectionAttempts <= backoffconnectionFactors.length - 1) {
                    retryConnectionTime = backoffconnectionFactors[this.connectionAttempts] * 1000;
                }
                this.connectionAttempts = Math.min(this.connectionAttempts + 1, backoffconnectionFactors.length - 1);

                setTimeout(() => {
                    try {
                        if (this.currentConnectAttemptID === connectAttemptID) {
                            this.connect(false, connectAttemptID);
                        }
                    } catch {
                        this.notifications.error(NotificationMessages.BOOKMARK_CONNECT_ERROR);
                        return;
                    }
                }, retryConnectionTime);
            },
        );
    }

    initiateOIDCLogin(profileName: string): Observable<OIDCLoginResponse> {
        const sub = new Subject<OIDCLoginResponse>();
        const req = create(OIDCLoginRequestSchema);
        req.transferProfile = profileName;
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }
        this.connectClient.initiateOIDCLogin(
            req,
            (err: ConnectError | undefined, res: OIDCLoginResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }
                sub.next(res);
                sub.complete();
            },
        );
        return sub.asObservable();
    }

    getOIDCStatus(profileName: string): Observable<OIDCStatusResponse> {
        const sub = new Subject<OIDCStatusResponse>();
        const req = create(OIDCStatusRequestSchema);
        req.transferProfile = profileName;
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }
        this.connectClient.getOIDCStatus(
            req,
            (err: ConnectError | undefined, res: OIDCStatusResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }
                sub.next(res);
                sub.complete();
            },
        );
        return sub.asObservable();
    }

    logoutOIDC(profileName: string): Observable<OIDCLogoutResponse> {
        const sub = new Subject<OIDCLogoutResponse>();
        const req = create(OIDCLogoutRequestSchema);
        req.transferProfile = profileName;
        if (!this.connectClient) {
            sub.error(new StreamingClientError(StreamingClientErrorType.StreamingClientNull));
            return sub.asObservable();
        }
        this.connectClient.logoutOIDC(
            req,
            (err: ConnectError | undefined, res: OIDCLogoutResponse) => {
                if (err) {
                    sub.error(err);
                    return;
                }
                sub.next(res);
                sub.complete();
            },
        );
        return sub.asObservable();
    }
}

function createAuthInterceptor(psk: string): Interceptor {
    return (next) => async (req) => {
        req.header.set(authKey, psk);
        return await next(req);
    };
}
