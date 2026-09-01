import { Component, effect, ElementRef, inject, NgZone, OnDestroy, signal, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Code, ConnectError } from '@connectrpc/connect';
import { BreadcrumbsComponent } from '@primitives/breadcrumbs/breadcrumbs.component';
import { FileBrowserComponent } from '@app/components/layout/file-browser/file-browser.component';
import { cleanPath } from '@app/components/layout/file-browser/file-browser.utils';
import { CreatePrefixFolderModalComponent } from '@app/components/modals/create-prefix-folder/create-prefix-folder-modal.component';
import {
    CreatePrefixFolderData,
    CreatePrefixFolderType,
} from '@app/components/modals/create-prefix-folder/create-prefix-folder-modal.interfaces';
import { DeletePathModalComponent } from '@app/components/modals/delete-path-modal/delete-path-modal.component';
import { DeletePathModalData } from '@app/components/modals/delete-path-modal/delete-path-modal.interfaces';
import { RenamePathModalComponent } from '@app/components/modals/rename-path-modal/rename-path-modal.component';
import { RenamePathModalData } from '@app/components/modals/rename-path-modal/rename-path-modal.interfaces';
import { StartingPathEditorModalComponent } from '@app/components/modals/starting-path-editor-modal/starting-path-editor-modal.component';
import { StartingPathType } from '@app/components/modals/starting-path-editor-modal/starting-path-editor-modal.interfaces';
import { TransferSettingsModalComponent } from '@app/components/modals/transfer-settings-modal/transfer-settings-modal.component';
import {
    TransferDirection,
    TransferSettingsModalData,
    TransferSettingsModalResult,
} from '@app/components/modals/transfer-settings-modal/transfer-settings-modal.interfaces';
import { tooltipMessages } from '@app/constants/common.constants';
import { PathType } from '@app/interfaces/paths';
import { grpcPathToDisplayPath, toGrpcPath } from '@app/utils/path-utils';
import { getS3BrowserError, isRetryableError, S3BrowserError } from '@app/utils/s3-utils';
import { basename, commonPath, createJobName, dirname, getErrorMessage } from '@app/utils/utils';
import { BucketReportModalComponent } from '@app/components/modals/bucket-report-modal/bucket-report-modal.component';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { RefreshButtonComponent } from '@primitives/buttons/refresh-button/refresh-button.component';
import { OidcAuthStatusComponent } from '@app/components/containers/oidc-auth-status/oidc-auth-status.component';
import { OidcSignInModalComponent } from '@app/components/modals/oidc-sign-in-modal/oidc-sign-in-modal.component';
import {
    OidcSignInModalData,
    OidcSignInModalResult,
} from '@app/components/modals/oidc-sign-in-modal/oidc-sign-in-modal.interfaces';
import { TextInputComponent } from '@primitives/forms/text-input/text-input.component';
import { TransferProfileSelectorDropdownComponent } from '@primitives/forms/transfer-profile-selector-dropdown/transfer-profile-selector-dropdown.component';
import { Bookmark } from '@services/bookmarks/bookmarks.classes';
import { DEFAULT_BOOKMARK_NAME } from '@services/bookmarks/bookmarks.constants';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { MetadataService } from '@services/metadata/metadata.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { TransferProfileState } from '@services/transfer-profile/transfer-profile.interfaces';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { forkJoin, of, Subscription, throwError } from 'rxjs';
import { catchError, distinctUntilChanged, map } from 'rxjs/operators';
import { DAEMON_FILE_BROWSER_ID } from '../daemon-browser/daemon-browser.constants';
import { EMPTY_FILTER_DATA } from '../file-browser/file-browser.constants';
import {
    FileBrowserContextMenuClickHandler,
    FileBrowserContextMenuRow,
    FileBrowserContextMenuTrigger,
    FileBrowserContextMenuTriggerCondition,
    FileBrowserData,
    FileBrowserDropResult,
    FileBrowserError,
    FileBrowserFilter,
    FileBrowserObject,
    FileBrowserObjectType,
    FileBrowserState,
} from '../file-browser/file-browser.interfaces';
import {
    BUCKET_BROWSER_INITIAL_DATA,
    BUCKET_FILE_BROWSER_ID,
    fileBrowserErrors,
    notificationMessages,
} from './bucket-browser.constants';
import { NavigateOptions, WailsFileList } from './bucket-browser.interfaces';
import { Store } from '@ngrx/store';
import { AppState } from '@app/state';
import * as UiContextActions from '@state/ui-context/actions/ui-context.actions';
import { addLog } from '@state/logs/actions/logs.actions';
import { WailsService } from '@services/wails/wails.service';
import { Events } from '@wailsio/runtime';

@Component({
    selector: 'fme-bucket-browser',
    templateUrl: './bucket-browser.component.html',
    styleUrls: ['./bucket-browser.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        TextInputComponent,
        TransferProfileSelectorDropdownComponent,
        ButtonComponent,
        RefreshButtonComponent,
        FileBrowserComponent,
        BreadcrumbsComponent,
        OidcAuthStatusComponent,
    ],
})
export class BucketBrowserComponent implements OnDestroy {
    private fmeClientService = inject(FmeClientService);
    private transferProfileService = inject(TransferProfileService);
    private notifications = inject(NotificationsService);
    private dialog = inject(MatDialog);
    private metadata = inject(MetadataService);
    private bookmarks = inject(BookmarksService);
    private store = inject<Store<AppState>>(Store);
    private wails = inject(WailsService);
    private zone = inject(NgZone);
    /** True while an OS file drag is over the window (macOS); drives the S3 drop-zone highlight. */
    externalDragActive = signal(false);
    private wailsFileList = signal<Record<string, string> | null>(null);
    private dropResult = signal<FileBrowserDropResult | null>(null);
    /**
     *
     * When a drag and drop is coming from Wails we need to get the full path from the Wails emitted event, which is
     * provided by listening on the wails "files-dropped". Once we have both the dropResult aswell as the wailsFileList
     * we can process the request. Once a request has triggered the modal opening, we reset both signals to `null`.
     *
     * @private
     */
    private effRef = effect(() => {
        const wailsFileList = this.wailsFileList();
        const dropResult = this.dropResult();

        if (!dropResult || !this.selectedTransferProfile) {
            return;
        }

        if (!dropResult.fromExternalSource) {
            this.openTransferSettingsModal(dropResult, this.selectedTransferProfile);
            this.wailsFileList.set(null);
            this.dropResult.set(null);
            return;
        }

        if (!wailsFileList) {
            return;
        }

        for (const item of dropResult.sources) {
            item.name = wailsFileList[item.name];
        }

        this.openTransferSettingsModal(dropResult, this.selectedTransferProfile);
        this.wailsFileList.set(null);
        this.dropResult.set(null);
    });

    @ViewChild('filterField') filterField!: TextInputComponent;
    @ViewChild('fileBrowser') fileBrowser!: FileBrowserComponent;
    @ViewChild('overflowMenuBtn', {read: ElementRef}) overflowMenuBtn?: ElementRef<HTMLElement>;
    fileBrowserID = BUCKET_FILE_BROWSER_ID;
    allowedDragOriginIDs: string[] = [DAEMON_FILE_BROWSER_ID];
    currentDirectory = '';
    isRoot = true;
    fileBrowserData: FileBrowserData = {...BUCKET_BROWSER_INITIAL_DATA};
    filter: FileBrowserFilter = EMPTY_FILTER_DATA;
    subscriptions: Subscription[] = [];
    selectedTransferProfile: string | null = null;
    transferProfileList: string[] | null = null;
    currentProfileIsOIDC = false;
    oidcAuthenticated = false;
    // Last profile passed to resolveProfileAndLoad. Auth is per-profile, so when this
    // changes we forget the previous profile's authenticated flag (see resolveProfileAndLoad).
    private lastResolvedProfile: string | null = null;
    allowUiConfiguration = false;
    allowRemoteRenameDelete = false;
    connectionState: ConnectionState = ConnectionState.DISCONNECTED;
    selectedBookmark: Bookmark | null = null;
    shouldManualRefresh = false;
    fileBrowserContextMenuData: FileBrowserContextMenuRow[] = [];
    protected readonly ConnectionState = ConnectionState;
    protected readonly DEFAULT_BOOKMARK_NAME = DEFAULT_BOOKMARK_NAME;
    protected readonly REFRESH_BUTTON_TOOLTIP = tooltipMessages.FILE_BROWSER_REFRESH_NOTIFICATION;

    constructor() {
        this.wails.onEvent('files-dropped', (event: Events.WailsEvent) => {
            if (event.name !== 'files-dropped') {
                return;
            }

            const wfl = event.data as unknown as WailsFileList;
            this.externalDragActive.set(false);
            this.handleExternalFilesDropped(wfl.files, wfl.targetId);
        });

        // macOS drag enter/exit over the window -> toggle the S3 drop-zone highlight so
        // users discover they can drag files in from Finder. Run in the Angular zone since
        // the Wails event fires outside it.
        this.wails.onEvent('file-dragging-entered', () => {
            this.zone.run(() => this.externalDragActive.set(true));
        });
        this.wails.onEvent('file-dragging-exited', () => {
            this.zone.run(() => this.externalDragActive.set(false));
        });
        this.setContextMenuData();

        this.subscriptions.push(this.transferProfileService.transferProfileState.subscribe(
            (transferProfileState: TransferProfileState) => {
                this.selectedTransferProfile = transferProfileState.currentTransferProfile;
                this.transferProfileList = transferProfileState.transferProfileList;
                if (!transferProfileState.transferProfileList?.length) {
                    // transfer profile list empty
                    this.currentProfileIsOIDC = false;
                    this.setFileBrowserError(this.getErrorEmptyTransferProfileList());
                    return;
                }
                if (!this.selectedTransferProfile) {
                    // no transfer profile selected
                    this.currentProfileIsOIDC = false;
                    this.setFileBrowserError(this.getErrorNoTransferProfileSelected());
                    return;
                }
                // Resolve whether this profile uses OIDC BEFORE deciding how to load it.
                // Determining OIDC-ness is async (a config fetch), so branching on the
                // previously-cached currentProfileIsOIDC raced: switching to a non-OIDC
                // profile could take the OIDC path and hang on "Loading File Browser",
                // and switching to an OIDC profile could skip the auth check.
                this.resolveProfileAndLoad(this.selectedTransferProfile);
            },
        ));
        this.subscriptions.push(this.metadata.onUpdate.subscribe({
            next: () => {
                try {
                    this.allowUiConfiguration = this.metadata.permissions.allowUiConfiguration;
                    this.allowRemoteRenameDelete = this.metadata.permissions.allowRemoteRenameDelete;
                } catch {
                    // this.metadata.allowUiConfiguration throws error when metadata is not loaded
                    this.allowUiConfiguration = false;
                    this.allowRemoteRenameDelete = false;
                }
            },
        }));
        this.subscriptions.push(this.fmeClientService.connectionState.pipe(distinctUntilChanged()).subscribe(
            (connState) => {
                this.connectionState = connState;
                if (connState !== ConnectionState.CONNECTED) {
                    this.setFileBrowserError(this.getErrorNoActiveSession());
                } else {
                    this.getTransferProfileList();
                }
            },
        ));

        this.subscriptions.push(this.bookmarks.current.subscribe(
            (bookmark: Bookmark) => {
                this.selectedBookmark = bookmark;
            },
        ));

        // When the currently-selected Remote Configuration is edited + saved, re-list it so
        // a config that now fails actually attempts a connection (its ERROR result then
        // flips the header pill to Disconnected instead of leaving a stale "Connected").
        this.subscriptions.push(this.transferProfileService.transferProfileEdited.subscribe(
            (editedProfile) => {
                if (editedProfile === this.selectedTransferProfile) {
                    this.resolveProfileAndLoad(this.selectedTransferProfile);
                }
            },
        ));
    }

    /**
     * Connection state shown in the header pill. Reflects S3/profile REACHABILITY (the
     * result of listing the selected Remote Configuration), not the daemon event stream —
     * so a config edited to fail flips the pill to Disconnected. The daemon `connectionState`
     * is still used to gate controls and the "no active session" state.
     */
    get s3ConnectionState(): ConnectionState {
        switch (this.fileBrowserData.state) {
            case FileBrowserState.LOADED:
                return ConnectionState.CONNECTED;
            case FileBrowserState.LOADING:
                return ConnectionState.CONNECTING;
            default:
                return ConnectionState.DISCONNECTED;
        }
    }

    /**
     * Unsubscribe from all subscriptions
     */
    ngOnDestroy() {
        this.subscriptions.map((subscription) => subscription.unsubscribe());
        this.subscriptions = [];
        this.effRef.destroy();
    }

    /**
     * Update the file browser filter
     *
     * @param {(string | null)} filterString - String to filter on
     */
    updateFilter(filterString: string | null) {
        this.filter = {
            name: filterString,
        };
    }

    /**
     * Refresh the file browser
     *
     * @param {boolean} [silentRefresh] - True if the refresh is a silent refresh rather than a manual refresh.
     * Defaults to false if not provided.
     */
    refreshFileBrowser(silentRefresh = false) {
        const transferProfile = this.selectedTransferProfile;
        if (transferProfile) {
            this.navigateToPath(this.currentDirectory, {silentRefreshNavigation: silentRefresh});
        }
    }

    /**
     * Handles authentication state changes from the OIDC auth status component.
     * Refreshes the file browser on successful authentication, clears the listing on sign-out.
     *
     * @param {boolean} authenticated - Whether the user is now authenticated
     */
    onOidcAuthChange(authenticated: boolean) {
        if (authenticated) {
            this.oidcAuthenticated = true;
            this.navigateToPath(this.getStartingDirectory());
        } else {
            this.oidcAuthenticated = false;
            this.setFileBrowserError(this.getErrorSignInRequired());
        }
    }

    /**
     * Opens the OIDC sign-in modal for the selected profile. On success, lists the
     * bucket; if the user chose to edit the configuration, opens the profile editor.
     *
     * @private
     */
    private openSignInModal() {
        const profileName = this.selectedTransferProfile;
        if (!profileName) {
            return;
        }
        const dialogRef = this.dialog.open<OidcSignInModalComponent, OidcSignInModalData, OidcSignInModalResult>(
            OidcSignInModalComponent,
            {
                width: '460px',
                disableClose: true,
                data: {profileName},
            },
        );
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'authenticated') {
                this.oidcAuthenticated = true;
                this.navigateToPath(this.getStartingDirectory());
            } else if (result === 'edit') {
                this.editTransferProfile(profileName);
            }
        });
    }

    /**
     * Get the starting directory to navigate to
     */
    getStartingDirectory() {
        // try getting remote starting path from metadata
        try {
            if (this.selectedTransferProfile) {
                const paths = this.metadata.transferProfiles[this.selectedTransferProfile];
                const remotePath = paths.remote;
                if (remotePath) {
                    return remotePath;
                }
            }
        } catch {
            return '/';
        }
        // return root if no starting path found
        return '/';
    }

    /**
     * Navigates to the given path by listing the path's contents and setting the file browser data
     *
     * @param {string} path - Path to list contents for
     * @param {NavigateOptions} [options] - Optional arguments
     */
    navigateToPath(path: string, options?: NavigateOptions) {
        const transferProfile = this.selectedTransferProfile;
        if (!transferProfile) {
            return;
        }
        this.filterField?.reset();
        // add leading slash if not present
        if (path.length > 0 && path[0] !== '/') {
            path = '/' + path;
        }
        if (!options?.silentRefreshNavigation) {
            // set to loading state if not auto-refreshing
            this.fileBrowserData = {
                state: FileBrowserState.LOADING,
                list: [],
                error: null,
            };
        }
        this.fmeClientService.listS3Prefix(transferProfile, path).pipe(
            catchError((error) => {
                const errorMessage = getErrorMessage(error);
                if (errorMessage !== null && isRetryableError(errorMessage)) {
                    return this.fmeClientService.listS3Prefix(transferProfile, path);
                }
                return throwError(() => error);
            }),
        ).subscribe({
            next: (data) => {
                const fileBrowserList: FileBrowserObject[] = [];
                data.folders.map((folder) => {
                    fileBrowserList.push({
                        name: folder,
                        size: null, // TODO when backend implementation done
                        dateModified: null, // TODO when backend implementation done
                        type: FileBrowserObjectType.FOLDER,
                        isStartingPath: this.isStartingPath(folder),
                    });
                });
                data.files.map((file) => {
                    fileBrowserList.push({
                        name: file.path,
                        size: file.size,
                        dateModified: file.lastModified,
                        type: FileBrowserObjectType.FILE,
                        storageClass: file.storageClass,
                    });
                });
                this.currentDirectory = path;
                this.isRoot = (this.currentDirectory === '/' || this.currentDirectory === '');
                this.fileBrowserData = {
                    state: FileBrowserState.LOADED,
                    list: fileBrowserList,
                    error: null,
                };
                // A successful listing on an OIDC profile is proof of a valid session —
                // reflect it (drives the toolbar "Signed in" chip) regardless of which
                // navigation path triggered the load.
                if (this.currentProfileIsOIDC) {
                    this.oidcAuthenticated = true;
                }
                this.store.dispatch(UiContextActions.setBucketBrowserPath({path: path}));
            },
            error: (error) => {
                if (options?.silentRefreshNavigation) {
                    // don't do anything if an auto refresh attempt failed
                    return;
                }
                const errorMessage = getErrorMessage(error);
                // An OIDC profile whose session isn't (or is no longer) authenticated:
                // route to the clear Sign-In Required state with a Sign in button, rather
                // than the generic list error or an endless loading bar. Covers refresh and
                // any other navigation that reaches an unauthenticated OIDC profile.
                // Classify by the Connect Unauthenticated code (robust to message wording,
                // which rawMessage strips the code prefix from) and fall back to the text.
                const isUnauthenticated =
                    (error instanceof ConnectError && error.code === Code.Unauthenticated) ||
                    (errorMessage !== null && /not authenticated|unauthenticated|sign in required/i.test(errorMessage));
                // For an OIDC profile we have NOT confirmed a session for (first sign-in, or
                // just switched to it), a listing failure is expected — you can't list before
                // signing in — so show the calm "Sign In Required" prompt rather than the
                // alarming listing error. Once authenticated, a later failure surfaces the
                // real error (which still carries a Sign in fallback).
                if (this.currentProfileIsOIDC && (!this.oidcAuthenticated || isUnauthenticated)) {
                    this.oidcAuthenticated = false;
                    this.store.dispatch(addLog({
                        log: {
                            level: 'warn',
                            message: `Not signed in to OIDC remote configuration "${transferProfile}"`
                                + (errorMessage ? ` (${errorMessage})` : '') + ' \u2014 sign-in required.',
                            timestamp: new Date(),
                            jobId: null,
                        },
                    }));
                    this.setFileBrowserError(this.getErrorSignInRequired());
                    return;
                }
                let s3Error: S3BrowserError = {
                    errorMessage: '',
                    fixableByConfiguration: false,
                };
                if (errorMessage !== null) {
                    const s3BrowserError = getS3BrowserError(error, transferProfile);
                    if (s3BrowserError) {
                        s3Error = s3BrowserError;
                    }
                    // Record the real failure detail in the Logs table — the panel only shows a
                    // generic "something went wrong" summary, which previously left auth/listing
                    // errors invisible in Logs.
                    this.store.dispatch(addLog({
                        log: {
                            level: 'error',
                            message: `Failed to list bucket for remote configuration "${transferProfile}": ${errorMessage}`,
                            timestamp: new Date(),
                            jobId: null,
                        },
                    }));
                    s3Error.errorMessage = 'Something went wrong while trying to list bucket content. Click on Logs tab for further detail.';
                    s3Error.fixableByConfiguration = true;
                }
                this.fileBrowserData = {
                    state: FileBrowserState.ERROR,
                    list: [],
                    error: this.getErrorListFolder(s3Error.errorMessage, s3Error.fixableByConfiguration, transferProfile),
                };
            },
        });
    }

    /**
     * Handle an OS file drop delivered by the Wails native runtime. On the Wails macOS
     * webview the browser DOM `drop` event is intercepted natively and no longer reliably
     * reaches the file browser, so the old path (which required both the DOM drop AND this
     * native event) silently did nothing. This event carries the real absolute paths
     * (basename -> path), so we synthesize the drop result here and target the current S3
     * directory, making external OS -> S3 uploads work without the DOM drop. Intra-app
     * drags (local <-> S3) still flow through the DOM drop / dragDropUpload path.
     */
    private handleExternalFilesDropped(files: Record<string, string>, targetId: string) {
        const basenames = Object.keys(files ?? {});
        if (!basenames.length) {
            return;
        }
        if (!this.selectedTransferProfile) {
            this.notifications.error(notificationMessages.NO_TRANSFER_PROFILE_SELECTED_ERROR);
            return;
        }
        // Cannot externally drag in files when connected to a remote daemon.
        if (this.selectedBookmark?.name !== DEFAULT_BOOKMARK_NAME) {
            this.notifications.error(notificationMessages.REMOTE_DAEMON_EXTERNAL_UPLOAD_ERROR);
            return;
        }

        const sources: FileBrowserObject[] = basenames.map((name) => ({
            name: name,
            size: 0n,
            dateModified: new Date(),
            type: FileBrowserObjectType.UNKNOWN,
        }));
        // The join effect maps each source name (basename) to its absolute path via wailsFileList.
        // Set the data (wailsFileList) BEFORE the gate (dropResult) so the effect never observes
        // a dropResult with a null wailsFileList, even if these updates are ever separated by an
        // await/microtask in a future refactor.
        this.wailsFileList.set(files);
        this.dropResult.set({
            fromExternalSource: true,
            sourceContainerID: null,
            sources: sources,
            destinationContainerID: this.fileBrowserID,
            destination: this.externalDropDestination(targetId),
            dragOriginSourceName: sources[0].name,
        });
    }

    /**
     * Resolve where an external OS drop should land. When the drop hit a folder row (marked
     * with a decodable `fbdt:<id>:<path>` drop-target id), upload into that folder; otherwise
     * fall back to the current directory.
     */
    private externalDropDestination(targetId: string): string {
        const prefix = `fbdt:${this.fileBrowserID}:`;
        if (targetId && targetId.startsWith(prefix)) {
            return decodeURIComponent(targetId.slice(prefix.length));
        }
        return this.currentDirectory;
    }

    /**
     * Start upload from a drag and drop action
     *
     * @param {FileBrowserDropResult} dropResult - FileBrowserDropResult from the file browser with upload data
     */
    dragDropUpload(dropResult: FileBrowserDropResult) {
        const uploadFromDaemonBrowser = dropResult.sourceContainerID &&
            this.allowedDragOriginIDs.includes(dropResult.sourceContainerID) &&
            dropResult.destinationContainerID === this.fileBrowserID;
        const uploadFromExternalDrag = dropResult.fromExternalSource && dropResult.destinationContainerID === this.fileBrowserID;
        // cannot externally drag in files if using a remote daemon
        if (uploadFromExternalDrag && this.selectedBookmark?.name !== DEFAULT_BOOKMARK_NAME) {
            this.notifications.error(notificationMessages.REMOTE_DAEMON_EXTERNAL_UPLOAD_ERROR);
            return;
        }
        const transferProfile = this.selectedTransferProfile;
        if (uploadFromDaemonBrowser || uploadFromExternalDrag) {
            if (!transferProfile) {
                this.notifications.error(notificationMessages.NO_TRANSFER_PROFILE_SELECTED_ERROR);
                return;
            }
            if (dropResult.sources.length && dropResult.destination) {
                this.dropResult.set(dropResult);
                // this.openTransferSettingsModal(dropResult, transferProfile);
            }
        }
    }

    /**
     * Opens the transfer settings modal to get user input and makes the request to upload if the user confirms to
     * in the modal.
     *
     * @param {FileBrowserDropResult} dropResult - FileBrowserDropResult from the file browser with upload data
     * @param {string} transferProfile - Current selected transfer profile
     * @private
     */
    private openTransferSettingsModal(dropResult: FileBrowserDropResult, transferProfile: string) {
        const dialogRef = this.dialog.open<TransferSettingsModalComponent, TransferSettingsModalData>(
            TransferSettingsModalComponent, {
                width: '50%',
                maxWidth: '600px',
                data: {
                    transferDirection: TransferDirection.UPLOAD,
                    objectsToTransfer: dropResult.sources,
                    destinationPath: dropResult.destination,
                    dragOriginObjectName: dropResult.dragOriginSourceName,
                    forceTransfers: false,
                    jobName: createJobName(dropResult.dragOriginSourceName, dropResult.sources.length),
                },
                autoFocus: 'dialog',
            },
        );
        const dialogOnSave = dialogRef.componentInstance.transferSettingsResult.subscribe({
            next: (result: TransferSettingsModalResult) => {
                if (result.performTransfer) {
                    const prefixes = dropResult.sources.map((sourceObject) => sourceObject.name);
                    this.uploadPrefixes(
                        transferProfile,
                        result.forceTransfers,
                        prefixes,
                        dropResult.destination,
                        result.jobName,
                    );
                } else {
                    this.notifications.info('Upload cancelled');
                }
            },
        });
        dialogRef.afterClosed().subscribe(() => {
            dialogOnSave.unsubscribe();
        });
    }

    /**
     * Sends the request to start an upload
     *
     * @param {string} transferProfile - Transfer profile to upload with
     * @param {boolean} force - Whether to force transfers
     * @param {string[]} sources - List of sources to upload, each source is an absolute path
     * @param {string} destination - Destination path to upload to
     * @param {string} jobName - Name generated for the upload job
     */
    uploadPrefixes(transferProfile: string, force: boolean, sources: string[], destination: string, jobName: string) {
        // gets the base name and sources list into the format required by the daemon uploader
        const basePath = toGrpcPath(sources.length === 1 ? dirname(sources[0]) : commonPath(sources));
        sources = sources.map((source) => basename(source));
        // send upload request
        this.fmeClientService.uploadPrefixes(transferProfile, force, basePath, sources, destination, jobName).subscribe({
            next: () => {
                this.notifications.success('Started upload.');
            },
            error: (error) => {
                this.notifications.error(notificationMessages.GRPC_UPLOAD_ERROR + error);
            },
        });
    }

    /**
     * Creates a new, empty prefix in the currently active S3 bucket
     */
    createS3Prefix() {
        return () => {
            this.openCreateS3PrefixModal(this.currentDirectory);
        };
    }

    /**
     * Opens the shared panel (empty-space) context menu from the "..." overflow button,
     * anchored just below it. Same menu as right-clicking empty space, from one definition.
     */
    openOverflowMenu() {
        return () => {
            const rect = this.overflowMenuBtn?.nativeElement?.getBoundingClientRect();
            this.fileBrowser?.openEmptySpaceMenu(rect ? rect.left : 0, rect ? rect.bottom + 4 : 0);
        };
    }

    /**
     * Context-menu handler that refreshes the panel (mockup puts Refresh inside the
     * overflow / empty-space menu, in addition to the standalone refresh button).
     */
    private refreshFromContextMenu(): FileBrowserContextMenuClickHandler {
        return () => {
            this.refreshFileBrowser();
        };
    }

    /**
     * Returns a context-menu click handler that opens the Bucket Report modal. Lives in
     * the panel (empty-space / "...") menu so it is reachable without a dedicated button.
     */
    private generateBucketReport(): FileBrowserContextMenuClickHandler {
        return () => {
            this.dialog.open(BucketReportModalComponent, {width: '40%', maxWidth: '600px', autoFocus: 'dialog'});
        };
    }

    /**
     * Opens the modal to create a new prefix in the current S3 prefix.
     *
     * @private
     */
    private openCreateS3PrefixModal(parent: string) {
        if (!this.selectedTransferProfile) {
            this.notifications.error('Unable to create directory, no active remote configuration');
            return;
        }

        const dialog = this.dialog.open<CreatePrefixFolderModalComponent, CreatePrefixFolderData, string | null>(
            CreatePrefixFolderModalComponent,
            {
                minWidth: '400px',
                data: {
                    parent: parent,
                    type: CreatePrefixFolderType.S3,
                    transferProfile: this.selectedTransferProfile,
                },
            },
        );

        dialog.afterClosed().subscribe(
            (modalResult) => {
                if (modalResult) {
                    if (!this.selectedTransferProfile) {
                        this.notifications.error('Unable to create directory, no active remote configuration');
                        return;
                    }

                    this.fmeClientService.createS3Prefix(modalResult, this.selectedTransferProfile).subscribe(
                        (createResult) => {
                            if (!createResult.success) {
                                this.notifications.error(createResult.message);
                                return;
                            }

                            this.notifications.success(`Created folder ${modalResult}`);
                            this.refreshFileBrowser(true);
                        },
                    );
                }
            },
        );
    }

    /**
     * Sets the file browser error state to the given FileBrowserError
     *
     * @param {FileBrowserError} error - Error to display in the file browser
     * @private
     */
    private setFileBrowserError(error: FileBrowserError) {
        this.currentDirectory = '';
        this.isRoot = true;
        this.fileBrowserData = {
            state: FileBrowserState.ERROR,
            list: [],
            error: error,
        };
    }

    /**
     * Constructs the file browser error for when there is no active session
     *
     * @private
     */
    private getErrorNoActiveSession(): FileBrowserError {
        return {
            ...fileBrowserErrors['NO_ACTIVE_SESSION'],
        };
    }

    /**
     * Constructs the file browser error for when there are no transfer profiles in the config
     *
     * @private
     */
    private getErrorEmptyTransferProfileList(): FileBrowserError {
        if (this.allowUiConfiguration) {
            return {
                ...fileBrowserErrors['EMPTY_TRANSFER_PROFILE_LIST'],
                actionButtons: [
                    {
                        buttonText: 'Create a Remote Configuration',
                        buttonClickHandler: () => {
                            this.createTransferProfile();
                        },
                    },
                ],
            };
        }
        return {
            ...fileBrowserErrors['EMPTY_TRANSFER_PROFILE_LIST_NO_ALLOW_UI_CONFIG'],
        };
    }

    /**
     * Constructs the file browser error for when transfer profile list is loading. Has a button to manually try
     * setting the file browser state with the transfer profile list if the GUI ever gets in a bad state.
     *
     * @private
     */
    private getErrorLoadingTransferProfileList(): FileBrowserError {
        return {
            ...fileBrowserErrors['LOADING_TRANSFER_PROFILE_LIST'],
            actionButtons: [
                {
                    buttonText: 'Get Remote Configurations',
                    buttonClickHandler: () => {
                        this.getTransferProfileList(true);
                    },
                },
            ],
        };
    }

    /**
     * Constructs the file browser error for when unable to list the folder
     *
     * @param {(string | null)} error - The specific error reason to display to the user
     * @param {boolean} showEditButton - True if "Edit Remote Configuration" is a solution to the error
     * @param {string} transferProfile - Name of the transfer profile that the list error occurred for
     * @private
     */
    private getErrorListFolder(error: string | null, showEditButton: boolean, transferProfile: string): FileBrowserError {
        const fileBrowserError = {
            ...fileBrowserErrors['LIST_FOLDER_ERROR'],
        };
        if (error) {
            fileBrowserError.message = error;
        }
        const actionButtons: { buttonText: string, buttonClickHandler: () => void }[] = [];
        // For an OIDC profile, a listing failure is most often an auth problem (expired or
        // signed-out session), so always surface a Sign in action here — the panel must
        // never leave the user with no way to re-authenticate, regardless of how the
        // underlying error was classified.
        if (this.currentProfileIsOIDC) {
            actionButtons.push({
                buttonText: 'Sign in',
                buttonClickHandler: () => {
                    this.openSignInModal();
                },
            });
        }
        if (showEditButton && transferProfile && this.allowUiConfiguration) {
            actionButtons.push({
                buttonText: 'Edit Remote Configuration',
                buttonClickHandler: () => {
                    this.editTransferProfile(transferProfile);
                },
            });
        }
        if (actionButtons.length) {
            fileBrowserError.actionButtons = actionButtons;
        }
        return fileBrowserError;
    }

    /**
     * Constructs the file browser error for when there is no transfer profile selected
     *
     * @private
     */
    private getErrorNoTransferProfileSelected(): FileBrowserError {
        return {
            ...fileBrowserErrors['NO_TRANSFER_PROFILE_SELECTED'],
        };
    }

    /**
     * Opens the modal to create a transfer profile
     *
     * @private
     */
    private createTransferProfile() {
        this.transferProfileService.add();
    }

    /**
     * Opens the modal to edit the given transfer profile
     *
     * @param {(string | null)} transferProfile - Transfer profile to edit
     * @private
     */
    private editTransferProfile(transferProfile: string | null) {
        if (transferProfile) {
            this.transferProfileService.edit(transferProfile);
        }
    }

    /**
     * Use the transfer profile state to set the file browser data.
     *
     * @param {boolean} [retry] - Whether we are retrying to get the transfer profile list
     * @private
     */
    private getTransferProfileList(retry = false) {
        if (this.transferProfileList === null) {
            if (retry) {
                this.notifications.warning('Still loading Remote Configuration list.');
            }
            this.setFileBrowserError(this.getErrorLoadingTransferProfileList());
            return;
        }
        if (!this.transferProfileList.length) {
            this.setFileBrowserError(this.getErrorEmptyTransferProfileList());
            return;
        }
        if (!this.selectedTransferProfile) {
            this.setFileBrowserError(this.getErrorNoTransferProfileSelected());
            return;
        }
        this.resolveProfileAndLoad(this.selectedTransferProfile);
    }

    /**
     * Sets the right-click context menu data for the file browser.
     *
     * @private
     */
    private setContextMenuData() {
        this.fileBrowserContextMenuData = [
            {
                label: 'Refresh',
                icon: 'refresh',
                iconColor: 'blue',
                sectionHeader: 'Actions',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['emptySpace', null],
                ]),
                action: this.refreshFromContextMenu(),
            },
            {
                label: 'New Prefix',
                icon: 'folder',
                iconColor: 'blue',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['emptySpace', null],
                ]),
                action: this.createS3Prefix(),
            },
            {
                label: 'Generate Bucket Report',
                icon: 'assessment',
                iconColor: 'inherit',
                sectionHeader: 'Reports',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['emptySpace', null],
                ]),
                action: this.generateBucketReport(),
                hasTrailingSeparator: true,
            },
            {
                label: 'Create Child Prefix',
                icon: 'folder',
                iconColor: 'blue',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', null],
                ]),
                action: this.createChildS3Prefix(),
                hasTrailingSeparator: true,
            },
            {
                label: 'Rename',
                icon: 'edit',
                iconColor: 'inherit',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['file', this.isRemoteRenameSingleTarget()], ['folder', this.isRemoteRenameSingleTarget()],
                ]),
                action: this.renameS3Path(),
            },
            {
                label: 'Delete',
                icon: 'delete_outline',
                iconColor: 'red',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['file', this.isRemoteRenameDeleteAllowed()], ['folder', this.isRemoteRenameDeleteAllowed()],
                ]),
                action: this.deleteS3Path(),
                hasTrailingSeparator: true,
            },
            {
                label: 'Set as Bucket Starting Directory',
                icon: 'home',
                iconColor: 'inherit',
                sectionHeader: 'Navigation',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', this.showS3StartingPrefixMenuRow()], ['emptySpace', this.showS3StartingPrefixMenuRow()],
                ]),
                action: this.setS3StartingPrefix(),
            },
            {
                label: 'Clear Bucket Starting Directory',
                icon: 'clear',
                iconColor: 'inherit',
                sectionHeader: 'Navigation',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', this.showClearS3StartingPrefixMenuRow()], ['emptySpace', this.showClearS3StartingPrefixMenuRow()],
                ]),
                action: this.clearS3StartingPrefix(),
            },
            {
                label: 'Edit Remote Configuration',
                icon: 'settings',
                iconColor: 'inherit',
                sectionHeader: 'Configuration',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['emptySpace', this.hasSelectedTransferProfile()],
                ]),
                action: this.editRemoteConfiguration(),
            },
            {
                label: 'New Remote Configuration',
                icon: 'add',
                iconColor: 'inherit',
                sectionHeader: 'Configuration',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['emptySpace', null],
                ]),
                action: this.newRemoteConfiguration(),
            },
        ];
    }

    private hasSelectedTransferProfile(): FileBrowserContextMenuTriggerCondition {
        return () => !!this.selectedTransferProfile;
    }

    private editRemoteConfiguration(): FileBrowserContextMenuClickHandler {
        return () => {
            if (this.selectedTransferProfile) {
                this.transferProfileService.edit(this.selectedTransferProfile);
            }
        };
    }

    private newRemoteConfiguration(): FileBrowserContextMenuClickHandler {
        return () => {
            this.transferProfileService.add();
        };
    }

    private createChildS3Prefix(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            this.openCreateS3PrefixModal(triggerObject.name);
        };
    }

    private showS3StartingPrefixMenuRow(): FileBrowserContextMenuTriggerCondition {
        return (fileBrowserObject: FileBrowserObject) => {
            const pathToCheck = fileBrowserObject ? fileBrowserObject.name : this.currentDirectory;
            return !this.isStartingPath(pathToCheck);
        };
    }

    private isStartingPath(path: string): boolean {
        let configs3StartingPrefix;
        const currentTransferProfile = this.selectedTransferProfile;
        try {
            if (currentTransferProfile) {
                const paths = this.metadata.transferProfiles[currentTransferProfile];
                configs3StartingPrefix = paths.remote;
            } else {
                return false;
            }
        } catch {
            return false;
        }
        configs3StartingPrefix = cleanPath(configs3StartingPrefix);
        const folderPath = cleanPath(path);
        if (configs3StartingPrefix) {
            return configs3StartingPrefix === folderPath;
        }
        return false;
    }

    private setS3StartingPrefix(): FileBrowserContextMenuClickHandler {
        return (triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, currentDirectory: string) => {
            const currentTransferProfile = this.selectedTransferProfile;
            if (!currentTransferProfile) {
                return;
            }

            let newS3StartingPrefix: string;

            if (triggerType === 'emptySpace') {
                newS3StartingPrefix = grpcPathToDisplayPath(currentDirectory, 's3');
            } else {
                newS3StartingPrefix = grpcPathToDisplayPath(triggerObject?.name || '', 's3');
            }
            let originalS3StartingPath = '';
            try {
                const paths = this.metadata.transferProfiles[currentTransferProfile];
                originalS3StartingPath = paths.remote;
            } catch {
                console.error(`Couldn't get remote configuration data for ${this.selectedTransferProfile}`);
            }

            this.openS3BucketPrefixModal(currentTransferProfile, newS3StartingPrefix, originalS3StartingPath);
        };
    }

    private openS3BucketPrefixModal(transferProfile: string, newS3StartingPrefix: string, originalS3StartingPrefix: string) {
        const dialogRef = this.dialog.open(
            StartingPathEditorModalComponent,
            {
                minWidth: '400px',
                maxWidth: '750px',
                data: {
                    type: StartingPathType.S3,
                    fileBrowserType: 's3',
                    newStartingPath: newS3StartingPrefix,
                    originalStartingPath: originalS3StartingPrefix,
                    transferProfile: transferProfile,
                },
            },
        );
        dialogRef.afterClosed().subscribe(
            (result) => {
                if (result !== null) {
                    this.persistS3StartingPrefix(transferProfile, result);
                }
            },
        );
    }

    /**
     * Persists the S3 Bucket Prefix (starting prefix) for a transfer profile. Passing
     * an empty string clears it. Shared by the "Set" (modal) and "Clear" context-menu
     * actions. See issue #18.
     */
    private persistS3StartingPrefix(transferProfile: string, newS3StartingPrefix: string) {
        this.fmeClientService.getConfiguration().subscribe({
            next: (config) => {
                const transferProfileData = config.protocols.s3.transferProfiles[transferProfile];
                if (!transferProfileData) {
                    this.notifications.warning(`Remote configuration ${transferProfile} does not exist in configuration file. Unable to update S3 Bucket Prefix.`);
                    return;
                }
                config.protocols.s3.transferProfiles[transferProfile].paths.remote = newS3StartingPrefix;
                this.fmeClientService.setConfiguration(config).subscribe({
                    next: () => {
                        const message = newS3StartingPrefix
                            ? `Successfully updated S3 Bucket Prefix for remote configuration ${transferProfile}.`
                            : `Cleared S3 Bucket Starting Directory for remote configuration ${transferProfile}.`;
                        this.notifications.success(message);
                        this.refreshFileBrowser(true);
                    },
                    error: (error) => {
                        this.notifications.warning(`Error occurred when updating S3 Bucket Prefix for remote configuration ${transferProfile}: ${error}`);
                    },
                });
            },
        });
    }

    /**
     * Returns true if the selected transfer profile has an S3 Bucket Prefix set.
     */
    private isS3StartingPrefixConfigured(): boolean {
        const currentTransferProfile = this.selectedTransferProfile;
        if (!currentTransferProfile) {
            return false;
        }
        try {
            const paths = this.metadata.transferProfiles[currentTransferProfile];
            return !!cleanPath(paths.remote);
        } catch {
            return false;
        }
    }

    /**
     * Context-menu visibility for "Clear Bucket Starting Directory": show on the
     * prefix that is the starting prefix, and on empty space whenever one is configured.
     */
    private showClearS3StartingPrefixMenuRow(): FileBrowserContextMenuTriggerCondition {
        return (fileBrowserObject: FileBrowserObject) => {
            if (!fileBrowserObject) {
                return this.isS3StartingPrefixConfigured();
            }
            return this.isStartingPath(fileBrowserObject.name);
        };
    }

    private clearS3StartingPrefix(): FileBrowserContextMenuClickHandler {
        return (__triggerType: FileBrowserContextMenuTrigger | null, __triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            const currentTransferProfile = this.selectedTransferProfile;
            if (!currentTransferProfile) {
                return;
            }
            this.persistS3StartingPrefix(currentTransferProfile, '');
        };
    }

    isRemoteRenameDeleteAllowed(): FileBrowserContextMenuTriggerCondition {
        return () => {
            return this.allowRemoteRenameDelete;
        };
    }

    /** Rename requires a single target: allowed AND not part of a multi-selection. */
    isRemoteRenameSingleTarget(): FileBrowserContextMenuTriggerCondition {
        const base = this.isRemoteRenameDeleteAllowed();
        return (row) => {
            if (!base(row)) {
                return false;
            }
            const selected = this.fileBrowser.getSelectedObjects();
            return selected.length <= 1 || !selected.some((o) => o.name === row.name);
        };
    }

    private renameS3Path(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            this.openRenameS3PathModal(triggerObject.name, triggerObject.type);
        };
    }

    private openRenameS3PathModal(pathToRename: string, type: FileBrowserObjectType) {
        const transferProfile = this.selectedTransferProfile;
        if (!transferProfile) {
            this.notifications.error(`No remote configuration selected, cannot rename ${type === FileBrowserObjectType.FOLDER ? 'S3 prefix' : 'S3 object'}`);
            return;
        }

        const pathType: PathType = type === FileBrowserObjectType.FOLDER ? PathType.S3_PREFIX : PathType.S3_OBJECT;

        const dialogRef = this.dialog.open<RenamePathModalComponent, RenamePathModalData>(
            RenamePathModalComponent,
            {
                width: '700px',
                data: {
                    objectToRename: basename(pathToRename),
                    pathType: pathType,
                    parentDirectory: this.currentDirectory,
                    osType: 's3',
                    transferProfile: transferProfile,
                },
            },
        );
        dialogRef.afterClosed().subscribe(
            (result) => {
                if (result) {
                    this.notifications.info(`Renaming in progress for ${pathToRename}`);
                    this.fmeClientService.renameS3Path(pathToRename, result, transferProfile, type).subscribe({
                        next: () => {
                            this.notifications.success(`Successfully renamed ${pathToRename}`);
                            this.refreshFileBrowser(true);
                        },
                        error: (error) => {
                            this.notifications.error(`Error occurred when renaming ${pathToRename}: ${error}`);
                        },
                    });
                }
            },
        );
    }

    private deleteS3Path(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            // If the right-clicked row is part of a multi-selection, act on the whole
            // selection; otherwise act on just that row.
            const selected = this.fileBrowser.getSelectedObjects();
            const targets = selected.length > 1 && selected.some((o) => o.name === triggerObject.name)
                ? selected
                : [triggerObject];
            this.openDeleteS3PathModal(targets);
        };
    }

    private openDeleteS3PathModal(targets: FileBrowserObject[]) {
        const transferProfile = this.selectedTransferProfile;
        if (!transferProfile) {
            this.notifications.error('No remote configuration selected, cannot delete');
            return;
        }
        if (!targets.length) {
            return;
        }

        // pathType drives the confirmation copy: use prefix wording only when every
        // selected item is a folder, otherwise default to object wording.
        const folderCount = targets.filter((t) => t.type === FileBrowserObjectType.FOLDER).length;
        const pathType: PathType = folderCount === targets.length
            ? PathType.S3_PREFIX
            : PathType.S3_OBJECT;

        const dialogRef = this.dialog.open<DeletePathModalComponent, DeletePathModalData>(
            DeletePathModalComponent,
            {
                width: '700px',
                data: {
                    pathToDelete: targets[0].name,
                    pathsToDelete: targets.map((t) => t.name),
                    folderCount: folderCount,
                    fileCount: targets.length - folderCount,
                    pathType: pathType,
                    osType: 's3',
                    transferProfile: transferProfile,
                },
            },
        );
        dialogRef.afterClosed().subscribe(
            (result) => {
                if (result) {
                    this.deleteS3Targets(targets, transferProfile);
                }
            },
        );
    }

    /**
     * Deletes every selected S3 target (one RPC per object/prefix), then reports an
     * aggregated result and refreshes. Partial failures are surfaced without aborting
     * the rest of the batch.
     */
    private deleteS3Targets(targets: FileBrowserObject[], transferProfile: string) {
        const label = targets.length === 1 ? targets[0].name : `${targets.length} items`;
        this.notifications.info(`Deletion in progress for ${label}`);

        forkJoin(
            targets.map((t) =>
                this.fmeClientService.deleteS3Path(t.name, transferProfile, t.type).pipe(
                    map(() => ({ name: t.name, ok: true })),
                    catchError((error) => of({ name: t.name, ok: false, error })),
                ),
            ),
        ).subscribe((results) => {
            const failed = results.filter((r) => !r.ok);
            if (failed.length === 0) {
                this.notifications.success(targets.length === 1
                    ? `Successfully deleted ${targets[0].name}`
                    : `Successfully deleted ${targets.length} items`);
            } else if (failed.length < results.length) {
                this.notifications.warning(
                    `Deleted ${results.length - failed.length} of ${results.length} items; ${failed.length} failed`,
                );
            } else {
                this.notifications.warning(targets.length === 1
                    ? `Error occurred when deleting ${targets[0].name}`
                    : `Failed to delete ${failed.length} items`);
            }
            this.refreshFileBrowser(true);
        });
    }

    private resolveProfileAndLoad(profileName: string) {
        this.fmeClientService.getConfiguration().subscribe({
            next: (config) => {
                const tp = config.protocols.s3.transferProfiles[profileName];
                this.currentProfileIsOIDC = tp?.authMethod === 'oidc';
                // Auth is per-profile: forget the prior profile's authenticated flag when the
                // profile actually changes, so a fresh (never-signed-in) OIDC config is treated
                // as "sign in required" instead of inheriting the previous profile's session.
                if (!this.currentProfileIsOIDC || profileName !== this.lastResolvedProfile) {
                    this.oidcAuthenticated = false;
                }
                this.lastResolvedProfile = profileName;
                // Attempt the listing directly and let its RESULT be the single source of
                // truth. A successful list on an OIDC profile means we're authenticated
                // (navigateToPath sets oidcAuthenticated and shows the sign-out control); an
                // "unauthenticated" error routes to the Sign In Required state. This avoids
                // relying on GetOIDCStatus, which can disagree with the daemon's lazily
                // rehydrated session (the list path rehydrates it, the status call does not).
                this.navigateToPath(this.getStartingDirectory());
            },
            error: () => {
                // Couldn't read config; assume non-OIDC and attempt to list.
                this.currentProfileIsOIDC = false;
                this.oidcAuthenticated = false;
                this.navigateToPath(this.getStartingDirectory());
            },
        });
    }

    /**
     * File browser state that prompts the user to sign in for an OIDC profile, with a
     * primary "Sign in" button that opens the sign-in modal.
     *
     * @private
     */
    private getErrorSignInRequired(): FileBrowserError {
        return {
            ...fileBrowserErrors['SIGN_IN_REQUIRED'],
            actionButtons: [
                {
                    buttonText: 'Sign in',
                    buttonClickHandler: () => {
                        this.openSignInModal();
                    },
                },
            ],
        };
    }
}
