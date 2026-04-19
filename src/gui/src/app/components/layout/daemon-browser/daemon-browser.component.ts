import { Component, inject, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BreadcrumbsComponent } from '@primitives/breadcrumbs/breadcrumbs.component';
import { FileBrowserComponent } from '@app/components/layout/file-browser/file-browser.component';
import { cleanPath, getOSFileBrowserName, stringToFileBrowserType } from '@app/components/layout/file-browser/file-browser.utils';
import { ConfigureHotFolderModalComponent } from '@app/components/modals/configure-hot-folder-modal/configure-hot-folder-modal.component';
import { ConfigureHotFolderModalData } from '@app/components/modals/configure-hot-folder-modal/configure-hot-folder-modal.interfaces';
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
import { displayPathToGrpcPath, grpcPathToDisplayPath } from '@app/utils/path-utils';
import { basename, commonPath, createJobName, getErrorMessage, s3BasePath } from '@app/utils/utils';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { RefreshButtonComponent } from '@primitives/buttons/refresh-button/refresh-button.component';
import { DaemonSelectorDropdownComponent } from '@primitives/forms/daemon-selector-dropdown/daemon-selector-dropdown.component';
import { TextInputComponent } from '@primitives/forms/text-input/text-input.component';
import { Bookmark } from '@services/bookmarks/bookmarks.classes';
import { DEFAULT_BOOKMARK_NAME } from '@services/bookmarks/bookmarks.constants';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { isLocalDaemon } from '@services/bookmarks/bookmarks.utils';
import { MetadataService } from '@services/metadata/metadata.service';
import { PanelLevel } from '@services/notifications/notifications.constants';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { TransferProfileState } from '@services/transfer-profile/transfer-profile.interfaces';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { Subscription } from 'rxjs';
import { catchError, distinctUntilChanged } from 'rxjs/operators';
import { BUCKET_FILE_BROWSER_ID } from '../bucket-browser/bucket-browser.constants';
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
    FileBrowserType,
} from '../file-browser/file-browser.interfaces';
import { DAEMON_FILE_BROWSER_ID, fileBrowserErrors, notificationMessages } from './daemon-browser.constants';
import { NavigateOptions } from './daemon-browser.interfaces';

@Component({
    selector: 'fme-daemon-browser',
    templateUrl: './daemon-browser.component.html',
    styleUrls: ['./daemon-browser.component.scss'],
    imports: [
        TextInputComponent,
        DaemonSelectorDropdownComponent,
        ButtonComponent,
        RefreshButtonComponent,
        FileBrowserComponent,
        BreadcrumbsComponent,
    ],
})
export class DaemonBrowserComponent implements OnDestroy {
    private fmeClientService = inject(FmeClientService);
    private transferProfileService = inject(TransferProfileService);
    private notifications = inject(NotificationsService);
    private bookmarks = inject(BookmarksService);
    private dialog = inject(MatDialog);
    private metadata = inject(MetadataService);

    @ViewChild('filterField') filterField!: TextInputComponent;
    fileBrowserID = DAEMON_FILE_BROWSER_ID;
    allowedDragOriginIDs: string[] = [BUCKET_FILE_BROWSER_ID];
    currentDirectory = '';
    isRoot = true;
    fileBrowserData: FileBrowserData = {
        state: FileBrowserState.ERROR,
        list: [],
        error: {
            ...fileBrowserErrors.NO_ACTIVE_SESSION_LOCAL,
            actionButtons: [
                {
                    buttonText: 'Retry Connection',
                    buttonClickHandler: () => {
                        this.retryDaemonConnection(null);
                    },
                },
            ],
        },
    };
    filter: FileBrowserFilter = EMPTY_FILTER_DATA;
    subscriptions: Subscription[] = [];
    connectionState: ConnectionState = ConnectionState.DISCONNECTED;
    selectedTransferProfile: string | null = null;
    selectedBookmark: Bookmark | null = null;
    hotFolderList: string[] = [];
    fileBrowserType: FileBrowserType = 'unknown';
    shouldManualRefresh = false;
    fileBrowserContextMenuData: FileBrowserContextMenuRow[] = [];
    allowLocalRenameDelete = false;
    protected readonly ConnectionState = ConnectionState;
    protected readonly REFRESH_BUTTON_TOOLTIP = tooltipMessages.FILE_BROWSER_REFRESH_NOTIFICATION;

    constructor() {
        this.setContextMenuData();

        // navigate to starting path on connection or set error state on disconnection
        this.subscriptions.push(this.fmeClientService.connectionState.pipe(distinctUntilChanged()).subscribe(
            (connState) => {
                const oldConnectionState = this.connectionState;
                this.connectionState = connState;
                if (oldConnectionState !== ConnectionState.CONNECTED && connState === ConnectionState.CONNECTED) {
                    // disconnected to connected
                    // TODO: added a half second delay so that metadata's local path can be received before navigating,
                    //  want to find a better way to do this later
                    setTimeout(
                        () => {
                            this.navigateToPath(this.getStartingDirectory(), {initialNavigation: true});
                        },
                        500,
                    );
                } else if (connState === ConnectionState.CONNECTING) {
                    this.currentDirectory = '';
                    this.isRoot = true;
                    this.fileBrowserData = {
                        state: FileBrowserState.ERROR,
                        list: [],
                        error: {
                            ...fileBrowserErrors.CONNECTING_TO_SESSION,
                        },
                    };
                } else if (connState === ConnectionState.DISCONNECTED) {
                    this.currentDirectory = '';
                    this.isRoot = true;
                    this.fileBrowserData = {
                        state: FileBrowserState.ERROR,
                        list: [],
                        error: this.getErrorNoActiveSession(this.selectedBookmark),
                    };
                }
            },
        ));
        // get the current transfer profile
        this.subscriptions.push(this.transferProfileService.transferProfileState.subscribe(
            (transferProfileState: TransferProfileState) => {
                this.selectedTransferProfile = transferProfileState.currentTransferProfile;
                this.refreshFileBrowser(true);
            },
        ));
        // set the new error state when a bookmark has changed but hasn't been connected to yet
        this.subscriptions.push(this.bookmarks.current.subscribe(
            (bookmark: Bookmark) => {
                this.selectedBookmark = bookmark;
            },
        ));
        // get the hot folder list and file browser type
        this.subscriptions.push(this.metadata.onUpdate.subscribe({
            next: () => {
                try {
                    this.hotFolderList = this.metadata.hotFolderSourceDirectories.map((hotFolder) => {
                        return this.cleanHotFolderPath(hotFolder);
                    });
                    this.fileBrowserType = stringToFileBrowserType(this.metadata.daemonOS);
                    this.allowLocalRenameDelete = this.metadata.permissions.allowLocalRenameDelete;
                    this.setContextMenuData();
                } catch {
                    // this.metadata getter methods throw an error when metadata is not loaded
                    this.hotFolderList = [];
                    this.fileBrowserType = 'unknown';
                    this.allowLocalRenameDelete = false;
                }
            },
        }));
    }

    /**
     * Unsubscribe from all subscriptions
     */
    ngOnDestroy() {
        this.subscriptions.map((subscription) => subscription.unsubscribe());
        this.subscriptions = [];
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
        if (this.connectionState === ConnectionState.CONNECTED) {
            if (this.currentDirectory) {
                this.navigateToPath(this.currentDirectory, {silentRefreshNavigation: silentRefresh});
            }
        }
    }

    /**
     * Get the starting directory to navigate to
     */
    getStartingDirectory() {
        // try getting favorite path first
        const bookmarkStartingPath = this.selectedBookmark?.onConnectStartingPath;
        if (bookmarkStartingPath) {
            return bookmarkStartingPath;
        }
        // try getting local starting path from metadata next
        try {
            if (this.selectedTransferProfile) {
                const paths = this.metadata.transferProfiles[this.selectedTransferProfile];
                const localPath = paths.local;
                if (localPath) {
                    return displayPathToGrpcPath(localPath, this.fileBrowserType);
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
        this.filterField?.reset();
        const oldFileBrowserData = {...this.fileBrowserData};
        if (!options?.silentRefreshNavigation) {
            // set to loading state if not auto-refreshing
            this.fileBrowserData = {
                state: FileBrowserState.LOADING,
                list: [],
                error: null,
            };
        }
        let redirectToRoot = false;
        let originalErrorMessage: string | null = '';
        this.fmeClientService.listDaemonFolder(path).pipe(
            catchError((error) => {
                // if this is the initial navigation, and we're not already navigating to the root, redirect to root
                if (options?.initialNavigation && path !== '/') {
                    redirectToRoot = true;
                    originalErrorMessage = getErrorMessage(error);
                    return this.fmeClientService.listDaemonFolder('/');
                }
                // else just re-throw the error
                throw error;
            }),
        ).subscribe({
            next: (data) => {
                if (redirectToRoot) {
                    this.notifications.warning(`Unable to navigate to the requested path ${grpcPathToDisplayPath(path, this.fileBrowserType)}, redirected to root folder.`);
                }
                const fileBrowserList: FileBrowserObject[] = [];
                data.folders.map((folder) => {
                    const folderDisplayPath = grpcPathToDisplayPath(folder, this.fileBrowserType);
                    fileBrowserList.push({
                        name: folder,
                        size: null, // TODO when backend implementation done
                        dateModified: null, // TODO when backend implementation done
                        type: FileBrowserObjectType.FOLDER,
                        isFavorite: this.selectedBookmark ? this.bookmarks.hasFavoritePath(this.selectedBookmark, folderDisplayPath) : false,
                        isHotFolder: this.isHotFolder(folder),
                        isStartingPath: this.isStartingPath(folder),
                    });
                });
                data.files.map((file) => {
                    fileBrowserList.push({
                        name: file.path,
                        size: file.size,
                        dateModified: file.lastModified,
                        type: FileBrowserObjectType.FILE,
                    });
                });
                this.currentDirectory = redirectToRoot ? '/' : path;
                this.isRoot = (this.currentDirectory === '/' || this.currentDirectory === '');
                if (this.selectedBookmark) {
                    // remember the current path so if switching away then back to this bookmark, can try to start navigation from here
                    this.selectedBookmark.onConnectStartingPath = path;
                    this.bookmarks.edit(this.selectedBookmark);
                }
                this.fileBrowserData = {
                    state: FileBrowserState.LOADED,
                    list: fileBrowserList,
                    error: null,
                };
            },
            error: (error) => {
                if (options?.silentRefreshNavigation) {
                    // don't do anything if an auto refresh attempt failed
                    return;
                }
                const errorMessage = getErrorMessage(error);
                if (redirectToRoot) {
                    // redirect to root failed
                    this.currentDirectory = '/';
                    this.isRoot = true;
                    if (this.selectedBookmark) {
                        // remember the current path so if switching away then back to this bookmark, can try to start navigation from here
                        this.selectedBookmark.onConnectStartingPath = '/';
                        this.bookmarks.edit(this.selectedBookmark);
                    }
                    this.fileBrowserData = {
                        state: FileBrowserState.ERROR,
                        list: [],
                        error: this.getErrorRedirectToRoot(originalErrorMessage, errorMessage),
                    };
                    return;
                }
                if (this.currentDirectory === path) {
                    // same directory
                    // don't navigate and show error in browser
                    this.fileBrowserData = {
                        state: FileBrowserState.ERROR,
                        list: [],
                        error: this.getErrorListFolder(errorMessage),
                    };
                } else {
                    // is ancestor or descendent directory
                    // don't navigate and show error notification
                    this.fileBrowserData = {...oldFileBrowserData};
                    let notificationMessage = `Unable to navigate to the requested path ${grpcPathToDisplayPath(path, this.fileBrowserType)}.`;
                    if (errorMessage) {
                        notificationMessage += ` Error: ${errorMessage}.`;
                    }
                    this.notifications.error(notificationMessage);
                }
            },
        });
    }

    /**
     * Start download from a drag and drop action
     *
     * @param {FileBrowserDropResult} dropResult - FileBrowserDropResult from the file browser with download data
     */
    dragDropDownload(dropResult: FileBrowserDropResult) {
        if (dropResult.fromExternalSource) {
            this.notifications.error(notificationMessages.EXTERNAL_DOWNLOAD_ERROR);
            return;
        }
        const transferProfile = this.selectedTransferProfile;
        if (dropResult.sourceContainerID && this.allowedDragOriginIDs.includes(dropResult.sourceContainerID)
            && dropResult.destinationContainerID === this.fileBrowserID) {
            if (!transferProfile) {
                this.notifications.error(notificationMessages.NO_TRANSFER_PROFILE_SELECTED_ERROR);
                return;
            }
            if (dropResult.sources.length && dropResult.destination) {
                this.openTransferSettingsModal(dropResult, transferProfile);
            }
        }
    }

    /**
     * Opens the transfer settings modal to get user input and makes the request to download if the user confirms to
     * in the modal.
     *
     * @param {FileBrowserDropResult} dropResult - FileBrowserDropResult from the file browser with download data
     * @param {string} transferProfile - Current selected transfer profile
     * @private
     */
    private openTransferSettingsModal(dropResult: FileBrowserDropResult, transferProfile: string) {
        const dialogRef = this.dialog.open<TransferSettingsModalComponent, TransferSettingsModalData>(
            TransferSettingsModalComponent, {
                width: '50%',
                maxWidth: '600px',
                data: {
                    transferDirection: TransferDirection.DOWNLOAD,
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
                    this.downloadPrefixes(
                        transferProfile,
                        result.forceTransfers,
                        prefixes,
                        dropResult.destination,
                        result.jobName,
                    );
                } else {
                    this.notifications.info('Download cancelled');
                }
            },
        });
        dialogRef.afterClosed().subscribe(() => {
            dialogOnSave.unsubscribe();
        });
    }

    /**
     * Sends the request to start a download
     *
     * @param {string} transferProfile - Transfer profile to download with
     * @param {boolean} force - Whether to force transfers
     * @param {string[]} prefixes - List of prefixes to download, each prefix is a full path
     * @param {string} destination - Destination path to download to
     * @param {string} jobName - Name generated for the download job
     */
    private downloadPrefixes(transferProfile: string, force: boolean, prefixes: string[], destination: string, jobName: string) {
        const basePath = prefixes.length === 1 ? s3BasePath(prefixes[0]) : commonPath(prefixes);
        this.fmeClientService.downloadPrefixes(transferProfile, force, prefixes, destination, jobName, basePath).subscribe({
            next: () => {
                this.notifications.success('Started download.');
            },
            error: (error) => {
                this.notifications.error(notificationMessages.GRPC_DOWNLOAD_ERROR + error);
            },
        });
    }

    /**
     * Returns true if a file browser object's path is not a favorite path
     *
     * @param {FileBrowserObject} fileBrowserObject - File browser object to check
     * @returns {boolean} Whether the object is not a favorite path
     */
    isNotFavoritePath(fileBrowserObject: FileBrowserObject): boolean {
        return !fileBrowserObject.isFavorite;
    }

    /**
     * Returns true if a file browser object's path is a favorite path
     *
     * @param {FileBrowserObject} fileBrowserObject - File browser object to check
     * @returns {boolean} Whether the object is a favorite path
     */
    isFavoritePath(fileBrowserObject: FileBrowserObject): boolean {
        return !!fileBrowserObject.isFavorite;
    }

    /**
     * Returns a function that checks if the current connected daemon is a local daemon
     *
     * @returns {FileBrowserContextMenuTriggerCondition} Condition function that returns true if currently connected to a local daemon
     */
    isCurrentDaemonLocal(): FileBrowserContextMenuTriggerCondition {
        return () => {
            return this.connectionState === ConnectionState.CONNECTED && isLocalDaemon(this.selectedBookmark);
        };
    }

    isLocalRenameDeleteAllowed(): FileBrowserContextMenuTriggerCondition {
        return () => {
            return this.allowLocalRenameDelete;
        };
    }

    /**
     * Returns a click handler for adding a favorite path from the context menu
     *
     * @returns {FileBrowserContextMenuClickHandler} Function that adds the clicked file browser path to favorite paths
     */
    addFavoritePath(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            if (triggerObject && this.selectedBookmark) {
                const favoriteDisplayPath = grpcPathToDisplayPath(triggerObject.name, this.fileBrowserType);
                const addResult = this.bookmarks.addFavoritePath(this.selectedBookmark, favoriteDisplayPath);
                if (addResult) {
                    this.notifications.open(addResult.message, addResult.level);
                    if (addResult.level === PanelLevel.SUCCESS) {
                        triggerObject.isFavorite = true;
                    }
                }
            }
        };
    }

    /**
     * Returns a click handler for removing a favorite path from the context menu
     *
     * @returns {FileBrowserContextMenuClickHandler} Function that removes the clicked file browser path from favorite paths
     */
    removeFavoritePath(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            if (triggerObject && this.selectedBookmark) {
                const favoriteDisplayPath = grpcPathToDisplayPath(triggerObject.name, this.fileBrowserType);
                const deleteResult = this.bookmarks.deleteFavoritePath(this.selectedBookmark, favoriteDisplayPath);
                if (deleteResult) {
                    this.notifications.open(deleteResult.message, deleteResult.level);
                    if (deleteResult.level === PanelLevel.SUCCESS) {
                        triggerObject.isFavorite = false;
                    }
                }
            }
        };
    }

    /**
     * Returns a click handler for configuring hot folders from the context menu
     *
     * @returns {FileBrowserContextMenuClickHandler} Function that opens the configure hot folder modal
     */
    configureHotFolder(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            const hotFolderSourcePath = grpcPathToDisplayPath(triggerObject.name, this.fileBrowserType);

            const dialogRef = this.dialog.open<ConfigureHotFolderModalComponent, ConfigureHotFolderModalData>(
                ConfigureHotFolderModalComponent, {
                    width: '60%',
                    maxWidth: '900px',
                    maxHeight: '80%',
                    data: {
                        hotFolderSourcePath: hotFolderSourcePath,
                    },
                    autoFocus: 'dialog',
                },
            );
            dialogRef.componentInstance.hotFoldersSaved.subscribe((result) => {
                if (result) {
                    setTimeout(
                        () => {
                            this.refreshFileBrowser(true);
                        },
                        200,
                    );
                }
            });
        };
    }


    /**
     * Creates a new, empty folder in the currently active directory
     */
    createLocalFolder() {
        return () => {
            this.openCreateLocalFolderModal(this.currentDirectory);
        };
    }

    /**
     * Returns a function that opens the given file on the user's machine
     */
    openLocalFile(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (triggerObject?.name && this.selectedBookmark?.name === DEFAULT_BOOKMARK_NAME) {
                const filePath = grpcPathToDisplayPath(triggerObject?.name, this.fileBrowserType);
                window.fme?.systemOpen(filePath);
            }
        };
    }

    /**
     * Returns a function that shows the given object in the OS file browser
     */
    showItemInFolder(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (triggerObject?.name && this.selectedBookmark?.name === DEFAULT_BOOKMARK_NAME) {
                const filePath = grpcPathToDisplayPath(triggerObject?.name, this.fileBrowserType);
                window.fme?.systemShowItemInFolder(filePath);
            }
        };
    }

    /**
     * Opens the modal to create a new folder in the current directory.
     *
     * @private
     */
    private openCreateLocalFolderModal(parent: string) {
        const dialog = this.dialog.open<CreatePrefixFolderModalComponent, CreatePrefixFolderData, string | null>(
            CreatePrefixFolderModalComponent,
            {
                minWidth: '400px',
                data: {
                    parent: parent,
                    type: CreatePrefixFolderType.Local,
                },
            },
        );

        dialog.afterClosed().subscribe(
            (modalResult) => {
                if (modalResult) {
                    this.fmeClientService.createLocalFolder(modalResult).subscribe(
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
     * Returns if the given folder path is a hot folder
     *
     * @param {string} folderPath - Path to check
     * @private
     */
    private isHotFolder(folderPath: string): boolean {
        folderPath = this.cleanHotFolderPath(folderPath);
        return this.hotFolderList.includes(folderPath);
    }

    /**
     * Constructs the file browser error for when there is no active session
     *
     * @param {(Bookmark | null)} currentBookmark - The current selected bookmark
     * @private
     */
    private getErrorNoActiveSession(currentBookmark: Bookmark | null): FileBrowserError {
        if (!currentBookmark) {
            return {
                ...fileBrowserErrors.NO_BOOKMARK_SELECTED,
            };
        }
        let fileBrowserErrorType = {
            ...fileBrowserErrors.NO_ACTIVE_SESSION_REMOTE,
        };
        if (currentBookmark.name === DEFAULT_BOOKMARK_NAME) {
            fileBrowserErrorType = {
                ...fileBrowserErrors.NO_ACTIVE_SESSION_LOCAL,
            };
        }
        return {
            ...fileBrowserErrorType,
            actionButtons: [
                {
                    buttonText: 'Retry Connection',
                    buttonClickHandler: () => {
                        this.retryDaemonConnection(currentBookmark);
                    },
                },
            ],
        };
    }

    /**
     * Constructs the file browser error for when unable to list the folder
     *
     * @param {(string | null)} error - The specific error reason to display to the user
     * @private
     */
    private getErrorListFolder(error: string | null): FileBrowserError {
        const fileBrowserError = {
            ...fileBrowserErrors.LIST_FOLDER_ERROR,
        };
        if (error) {
            fileBrowserError.message += ` Error: ${error}.`;
        }
        return fileBrowserError;
    }

    /**
     * Constructs the file browser error for when unable to list the folder
     *
     * @param {(string | null)} originalError - The specific error reason that caused the original navigation to fail
     * @param {(string | null)} rootError - The specific error reason that caused the root redirect navigation to fail
     * @private
     */
    private getErrorRedirectToRoot(originalError: string | null, rootError: string | null): FileBrowserError {
        const fileBrowserError = {
            ...fileBrowserErrors.REDIRECT_TO_ROOT_ERROR,
        };
        if (originalError) {
            fileBrowserError.message += ` Original navigation error: ${originalError}.`;
        }
        if (rootError) {
            fileBrowserError.message += ` Root redirect error: ${rootError}.`;
        }
        return fileBrowserError;
    }

    /**
     * Tries to connect to the selected bookmark again
     *
     * @param {(Bookmark | null)} bookmark - Bookmark to select again. If null, nothing happens
     * @private
     */
    private retryDaemonConnection(bookmark: Bookmark | null) {
        if (bookmark) {
            try {
                this.bookmarks.setSelection(bookmark.name);
            } catch (e) {
                this.notifications.warning(`Failed to switch daemon: ${(e as Error).message}`);
            }
        }
    }

    /**
     * Cleans a path to be compared with a hot folder path
     *
     * @param {string} path - Path to be cleaned
     * @private
     */
    private cleanHotFolderPath(path: string): string {
        path = path.trim();
        if (path !== '/') {
            path = path.endsWith('/') ? path.slice(0, -1) : path;
        }
        return path;
    }

    /**
     * Sets the right-click context menu data for the file browser.
     *
     * @private
     */
    private setContextMenuData() {
        this.fileBrowserContextMenuData = [
            {
                label: 'Open file',
                icon: 'open_in_new',
                iconColor: 'inherit',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['file', this.isCurrentDaemonLocal()],
                ]),
                action: this.openLocalFile(),
            },
            {
                label: `Open in ${getOSFileBrowserName(this.fileBrowserType)}`,
                icon: 'folder_open',
                iconColor: 'blue',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['file', this.isCurrentDaemonLocal()], ['folder', this.isCurrentDaemonLocal()],
                ]),
                action: this.showItemInFolder(),
                hasTrailingSeparator: true,
            },
            {
                label: 'Create Folder',
                icon: 'folder',
                iconColor: 'blue',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['emptySpace', null],
                ]),
                action: this.createLocalFolder(),
            },
            {
                label: 'Create Child Folder',
                icon: 'folder',
                iconColor: 'blue',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', null],
                ]),
                action: this.createChildLocalFolder(),
                hasTrailingSeparator: true,
            },
            {
                label: 'Rename',
                icon: 'edit',
                iconColor: 'inherit',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['file', this.isLocalRenameDeleteAllowed()], ['folder', this.isLocalRenameDeleteAllowed()],
                ]),
                action: this.renameLocalPath(),
            },
            {
                label: 'Delete',
                icon: 'delete_outline',
                iconColor: 'red',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['file', this.isLocalRenameDeleteAllowed()], ['folder', this.isLocalRenameDeleteAllowed()],
                ]),
                action: this.deleteLocalPath(),
                hasTrailingSeparator: true,
            },
            {
                label: 'Add as Favorite Path',
                icon: 'star',
                iconColor: 'yellow',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', this.isNotFavoritePath],
                ]),
                action: this.addFavoritePath(),
            },
            {
                label: 'Remove from Favorite Paths',
                icon: 'star',
                iconColor: 'yellow',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', this.isFavoritePath],
                ]),
                action: this.removeFavoritePath(),
            },
            {
                label: 'Set as Local Starting Directory',
                icon: 'edit',
                iconColor: 'inherit',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', this.showLocalStartingPathMenuRow()], ['emptySpace', this.showLocalStartingPathMenuRow()],
                ]),
                action: this.setLocalStartingPath(),
            },
            {
                label: 'Configure Hot Folder',
                icon: 'whatshot',
                iconColor: 'orange',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', null],
                ]),
                action: this.configureHotFolder(),
            },
        ];
    }

    private createChildLocalFolder(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            this.openCreateLocalFolderModal(triggerObject.name);
        };
    }

    private showLocalStartingPathMenuRow(): FileBrowserContextMenuTriggerCondition {
        return (fileBrowserObject: FileBrowserObject) => {
            const pathToCheck = fileBrowserObject ? fileBrowserObject.name : this.currentDirectory;
            return !this.isStartingPath(pathToCheck);
        };
    }

    private isStartingPath(path: string): boolean {
        let configLocalStartingPath;
        const currentTransferProfile = this.selectedTransferProfile;
        try {
            if (currentTransferProfile) {
                const paths = this.metadata.transferProfiles[currentTransferProfile];
                configLocalStartingPath = displayPathToGrpcPath(paths.local, this.fileBrowserType);
            } else {
                return false;
            }
        } catch {
            return false;
        }
        configLocalStartingPath = cleanPath(configLocalStartingPath);
        const folderPath = cleanPath(path);
        if (configLocalStartingPath) {
            return configLocalStartingPath === folderPath;
        }
        return false;
    }

    private setLocalStartingPath(): FileBrowserContextMenuClickHandler {
        return (triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, currentDirectory: string) => {
            const currentTransferProfile = this.selectedTransferProfile;
            if (!currentTransferProfile) {
                return;
            }

            let newLocalStartingPath: string;

            if (triggerType === 'emptySpace') {
                newLocalStartingPath = grpcPathToDisplayPath(currentDirectory, this.fileBrowserType);
            } else {
                newLocalStartingPath = grpcPathToDisplayPath(triggerObject?.name || '', this.fileBrowserType);
            }
            let originalLocalStartingPath = '';
            try {
                const paths = this.metadata.transferProfiles[currentTransferProfile];
                originalLocalStartingPath = paths.local;
            } catch {
                console.error(`Couldn't get remote configuration data for ${this.selectedTransferProfile}`);
            }

            this.openLocalStartingPathModal(currentTransferProfile, newLocalStartingPath, originalLocalStartingPath);
        };
    }

    private openLocalStartingPathModal(transferProfile: string, newLocalStartingPath: string, originalLocalStartingPath: string) {
        const dialogRef = this.dialog.open(
            StartingPathEditorModalComponent,
            {
                minWidth: '400px',
                maxWidth: '750px',
                data: {
                    type: StartingPathType.Local,
                    fileBrowserType: this.fileBrowserType,
                    newStartingPath: newLocalStartingPath,
                    originalStartingPath: originalLocalStartingPath,
                    transferProfile: transferProfile,
                },
            },
        );
        dialogRef.afterClosed().subscribe(
            (result) => {
                if (result !== null) {
                    this.fmeClientService.getConfiguration().subscribe({
                        next: (config) => {
                            const transferProfileData = config.protocols.s3.transferProfiles[transferProfile];
                            if (!transferProfileData) {
                                this.notifications.warning(`Remote configuration ${transferProfile} does not exist in configuration file. Unable to update Local Directory.`);
                                return;
                            }
                            config.protocols.s3.transferProfiles[transferProfile].paths.local = result;
                            this.fmeClientService.setConfiguration(config).subscribe({
                                next: () => {
                                    this.notifications.success(`Successfully updated Local Directory for remote configuration ${transferProfile}.`);
                                    this.refreshFileBrowser(true);
                                },
                                error: (error) => {
                                    this.notifications.warning(`Error occurred when updating Local Directory for remote configuration ${transferProfile}: ${error}`);
                                },
                            });
                        },
                    });
                }
            },
        );
    }

    private renameLocalPath(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            this.openRenameLocalPathModal(triggerObject.name, triggerObject.type);
        };
    }

    private openRenameLocalPathModal(pathToRename: string, type: FileBrowserObjectType) {
        const pathType: PathType = type === FileBrowserObjectType.FOLDER ? PathType.FOLDER : PathType.FILE;

        const dialogRef = this.dialog.open<RenamePathModalComponent, RenamePathModalData>(
            RenamePathModalComponent,
            {
                width: '700px',
                data: {
                    objectToRename: basename(pathToRename),
                    pathType: pathType,
                    parentDirectory: this.currentDirectory,
                    osType: this.fileBrowserType,
                },
            },
        );
        dialogRef.afterClosed().subscribe(
            (result) => {
                if (result) {
                    const displayPathToRename = grpcPathToDisplayPath(pathToRename, this.fileBrowserType);
                    this.notifications.info(`Renaming in progress for ${displayPathToRename}`);
                    this.fmeClientService.renameLocalPath(pathToRename, result, type).subscribe({
                        next: () => {
                            this.notifications.success(`Successfully renamed ${displayPathToRename}`);
                            this.refreshFileBrowser(true);
                        },
                        error: (error) => {
                            this.notifications.error(`Error occurred when renaming ${displayPathToRename}: ${error}`);
                        },
                    });
                }
            },
        );
    }

    private deleteLocalPath(): FileBrowserContextMenuClickHandler {
        return (_triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, __currentDirectory: string) => {
            if (!triggerObject) {
                return;
            }
            this.openDeleteLocalPathModal(triggerObject.name, triggerObject.type);
        };
    }

    private openDeleteLocalPathModal(pathToDelete: string, type: FileBrowserObjectType) {
        const pathType: PathType = type === FileBrowserObjectType.FOLDER ? PathType.FOLDER : PathType.FILE;

        const dialogRef = this.dialog.open<DeletePathModalComponent, DeletePathModalData>(
            DeletePathModalComponent,
            {
                width: '700px',
                data: {
                    pathToDelete: pathToDelete,
                    pathType: pathType,
                    osType: this.fileBrowserType,
                },
            },
        );
        dialogRef.afterClosed().subscribe(
            (result) => {
                if (result) {
                    const displayPathToDelete = grpcPathToDisplayPath(pathToDelete, this.fileBrowserType);
                    this.notifications.info(`Deletion in progress for ${displayPathToDelete}`);
                    this.fmeClientService.deleteLocalPath(pathToDelete, type).subscribe({
                        next: () => {
                            this.notifications.success(`Successfully deleted ${displayPathToDelete}`);
                            this.refreshFileBrowser(true);
                        },
                        error: (error) => {
                            this.notifications.warning(`Error occurred when deleting ${displayPathToDelete}: ${error}`);
                        },
                    });
                }
            },
        );
    }
}
