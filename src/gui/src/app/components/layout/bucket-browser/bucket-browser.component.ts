import { Component, inject, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
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
import { grpcPathToDisplayPath } from '@app/utils/path-utils';
import { getS3BrowserError, isRetryableError, S3BrowserError } from '@app/utils/s3-utils';
import { basename, commonPath, createJobName, dirname, getErrorMessage } from '@app/utils/utils';
import { BucketReportButtonComponent } from '@primitives/buttons/bucket-report-button/bucket-report-button.component';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { RefreshButtonComponent } from '@primitives/buttons/refresh-button/refresh-button.component';
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
import { Subscription, throwError } from 'rxjs';
import { catchError, distinctUntilChanged } from 'rxjs/operators';
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
import { BUCKET_BROWSER_INITIAL_DATA, BUCKET_FILE_BROWSER_ID, fileBrowserErrors, notificationMessages } from './bucket-browser.constants';
import { NavigateOptions } from './bucket-browser.interfaces';

@Component({
    selector: 'fme-bucket-browser',
    templateUrl: './bucket-browser.component.html',
    styleUrls: ['./bucket-browser.component.scss'],
    imports: [
        TextInputComponent,
        TransferProfileSelectorDropdownComponent,
        BucketReportButtonComponent,
        ButtonComponent,
        RefreshButtonComponent,
        FileBrowserComponent,
        BreadcrumbsComponent,
    ],
})
export class BucketBrowserComponent implements OnDestroy {
    private fmeClientService = inject(FmeClientService);
    private transferProfileService = inject(TransferProfileService);
    private notifications = inject(NotificationsService);
    private dialog = inject(MatDialog);
    private metadata = inject(MetadataService);
    private bookmarks = inject(BookmarksService);

    @ViewChild('filterField') filterField!: TextInputComponent;
    fileBrowserID = BUCKET_FILE_BROWSER_ID;
    allowedDragOriginIDs: string[] = [DAEMON_FILE_BROWSER_ID];
    currentDirectory = '';
    isRoot = true;
    fileBrowserData: FileBrowserData = {...BUCKET_BROWSER_INITIAL_DATA};
    filter: FileBrowserFilter = EMPTY_FILTER_DATA;
    subscriptions: Subscription[] = [];
    selectedTransferProfile: string | null = null;
    transferProfileList: string[] | null = null;
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
        this.setContextMenuData();

        this.subscriptions.push(this.transferProfileService.transferProfileState.subscribe(
            (transferProfileState: TransferProfileState) => {
                this.selectedTransferProfile = transferProfileState.currentTransferProfile;
                this.transferProfileList = transferProfileState.transferProfileList;
                if (!transferProfileState.transferProfileList?.length) {
                    // transfer profile list empty
                    this.setFileBrowserError(this.getErrorEmptyTransferProfileList());
                    return;
                }
                if (!this.selectedTransferProfile) {
                    // no transfer profile selected
                    this.setFileBrowserError(this.getErrorNoTransferProfileSelected());
                    return;
                }
                this.navigateToPath(this.getStartingDirectory());
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
        const transferProfile = this.selectedTransferProfile;
        if (transferProfile) {
            this.navigateToPath(this.currentDirectory, {silentRefreshNavigation: silentRefresh});
        }
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
            },
            error: (error) => {
                if (options?.silentRefreshNavigation) {
                    // don't do anything if an auto refresh attempt failed
                    return;
                }
                const errorMessage = getErrorMessage(error);
                let s3Error: S3BrowserError = {
                    errorMessage: '',
                    fixableByConfiguration: false,
                };
                if (errorMessage !== null) {
                    const s3BrowserError = getS3BrowserError(error, transferProfile);
                    if (s3BrowserError) {
                        s3Error = s3BrowserError;
                    }
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
                this.openTransferSettingsModal(dropResult, transferProfile);
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
        const basePath = sources.length === 1 ? dirname(sources[0]) : commonPath(sources);
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
        if (showEditButton && transferProfile && this.allowUiConfiguration) {
            fileBrowserError.actionButtons = [
                {
                    buttonText: 'Edit Remote Configuration',
                    buttonClickHandler: () => {
                        this.editTransferProfile(transferProfile);
                    },
                },
            ];
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
        this.navigateToPath(this.getStartingDirectory());
    }

    /**
     * Sets the right-click context menu data for the file browser.
     *
     * @private
     */
    private setContextMenuData() {
        this.fileBrowserContextMenuData = [
            {
                label: 'Create Prefix',
                icon: 'folder',
                iconColor: 'blue',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['emptySpace', null],
                ]),
                action: this.createS3Prefix(),
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
                    ['file', this.isRemoteRenameDeleteAllowed()], ['folder', this.isRemoteRenameDeleteAllowed()],
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
                icon: 'edit',
                iconColor: 'inherit',
                triggers: new Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>([
                    ['folder', this.showS3StartingPrefixMenuRow()], ['emptySpace', this.showS3StartingPrefixMenuRow()],
                ]),
                action: this.setS3StartingPrefix(),
            },
        ];
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
                    this.fmeClientService.getConfiguration().subscribe({
                        next: (config) => {
                            const transferProfileData = config.protocols.s3.transferProfiles[transferProfile];
                            if (!transferProfileData) {
                                this.notifications.warning(`Remote configuration ${transferProfile} does not exist in configuration file. Unable to update S3 Bucket Prefix.`);
                                return;
                            }
                            config.protocols.s3.transferProfiles[transferProfile].paths.remote = result;
                            this.fmeClientService.setConfiguration(config).subscribe({
                                next: () => {
                                    this.notifications.success(`Successfully updated S3 Bucket Prefix for remote configuration ${transferProfile}.`);
                                    this.refreshFileBrowser(true);
                                },
                                error: (error) => {
                                    this.notifications.warning(`Error occurred when updating S3 Bucket Prefix for remote configuration ${transferProfile}: ${error}`);
                                },
                            });
                        },
                    });
                }
            },
        );
    }

    isRemoteRenameDeleteAllowed(): FileBrowserContextMenuTriggerCondition {
        return () => {
            return this.allowRemoteRenameDelete;
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
            this.openDeleteS3PathModal(triggerObject.name, triggerObject.type);
        };
    }

    private openDeleteS3PathModal(pathToDelete: string, type: FileBrowserObjectType) {
        const transferProfile = this.selectedTransferProfile;
        if (!transferProfile) {
            this.notifications.error(`No remote configuration selected, cannot delete ${type === FileBrowserObjectType.FOLDER ? 'S3 prefix' : 'S3 object'}`);
            return;
        }

        const pathType: PathType = type === FileBrowserObjectType.FOLDER ? PathType.S3_PREFIX : PathType.S3_OBJECT;

        const dialogRef = this.dialog.open<DeletePathModalComponent, DeletePathModalData>(
            DeletePathModalComponent,
            {
                width: '700px',
                data: {
                    pathToDelete: pathToDelete,
                    pathType: pathType,
                    osType: 's3',
                    transferProfile: transferProfile,
                },
            },
        );
        dialogRef.afterClosed().subscribe(
            (result) => {
                if (result) {
                    this.notifications.info(`Deletion in progress for ${pathToDelete}`);
                    this.fmeClientService.deleteS3Path(pathToDelete, transferProfile, type).subscribe({
                        next: () => {
                            this.notifications.success(`Successfully deleted ${pathToDelete}`);
                            this.refreshFileBrowser(true);
                        },
                        error: (error) => {
                            this.notifications.warning(`Error occurred when deleting ${pathToDelete}: ${error}`);
                        },
                    });
                }
            },
        );
    }
}
