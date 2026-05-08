import { Component, EventEmitter, inject, Input, OnDestroy, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { FileBrowserType } from '@app/components/layout/file-browser/file-browser.interfaces';
import { ConfirmationModalComponent } from '@app/components/modals/confirmation-modal/confirmation-modal.component';
import { DaemonEditorModalComponent } from '@app/components/modals/daemon-editor-modal/daemon-editor-modal.component';
import { FavoritePathModalComponent } from '@app/components/modals/favorite-path-modal/favorite-path-modal.component';
import { NotificationMessages } from '@app/constants/common.constants';
import { displayPathToGrpcPath, grpcPathToDisplayPath } from '@app/utils/path-utils';
import { SelectMenuDropdownComponent } from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.component';
import {
    ADD_CIRCLE_ICON,
    ADD_ICON,
    EDIT_ICON,
    STOP_ICON,
    TRASH_ICON,
} from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.constants';
import { ActionIcon, DropdownIcon, DropdownItem } from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.interfaces';
import { Bookmark } from '@services/bookmarks/bookmarks.classes';
import { DEFAULT_BOOKMARK_NAME } from '@services/bookmarks/bookmarks.constants';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { CONNECTED_ICON, CONNECTING_ICON, DISCONNECTED_ICON, PLACEHOLDER_TEXT, STAR_ICON } from './daemon-selector-dropdown.constants';

@Component({
    selector: 'fme-daemon-selector-dropdown',
    templateUrl: './daemon-selector-dropdown.component.html',
    styleUrls: ['./daemon-selector-dropdown.component.scss'],
    imports: [
        SelectMenuDropdownComponent,
    ],
})
export class DaemonSelectorDropdownComponent implements OnDestroy {
    protected readonly PLACEHOLDER_TEXT = PLACEHOLDER_TEXT;
    private bookmarks = inject(BookmarksService);
    private fmeClientService = inject(FmeClientService);
    private notifications = inject(NotificationsService);
    private subscriptions: Subscription[] = [];
    private dialog = inject(MatDialog);

    @Input() currentDirectory = '';
    @Input() fileBrowserType: FileBrowserType = 'unknown';
    @Output() daemonSelectorNavigate = new EventEmitter<string>();
    dropdownItems: DropdownItem[] = [];
    currentBookmark: Bookmark | null = null;
    allBookmarks: Bookmark[] = [];
    connectionState: ConnectionState = ConnectionState.DISCONNECTED;
    connectionIcon: DropdownIcon = {...DISCONNECTED_ICON};

    constructor() {
        this.subscriptions.push(this.bookmarks.getAllBookmarks.subscribe({
            next: (bookmarks) => {
                this.allBookmarks = bookmarks;
                this.setDropdownItems(bookmarks);
            },
        }));
        this.subscriptions.push(this.bookmarks.current.subscribe({
            next: (bookmark) => {
                this.currentBookmark = bookmark;
                this.setDropdownItems(this.allBookmarks);
            },
        }));
        this.subscriptions.push(this.fmeClientService.connectionState.pipe(distinctUntilChanged()).subscribe(
            (connStatus) => {
                this.connectionState = connStatus;
                switch (connStatus) {
                    case ConnectionState.CONNECTED:
                        this.connectionIcon = {...CONNECTED_ICON};
                        break;
                    case ConnectionState.CONNECTING:
                        this.connectionIcon = {...CONNECTING_ICON};
                        break;
                    case ConnectionState.DISCONNECTED:
                        this.connectionIcon = {...DISCONNECTED_ICON};
                }
                this.setDropdownItems(this.allBookmarks);
            },
        ));
    }

    /**
     * Unsubscribe from all subscriptions
     */
    ngOnDestroy() {
        this.subscriptions.map((sub) => sub.unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Gets the currently selected daemon name, which is null if no daemon is selected
     */
    getSelectedDaemon(): string | null {
        const currentBookmark = this.currentBookmark;
        return currentBookmark ? currentBookmark.name : null;
    }

    /**
     * Given a list of bookmarks, sets the list of DropdownItems to be displayed in menu dropdown.
     * @param bookmarks List of bookmark names to display
     */
    setDropdownItems(bookmarks: Bookmark[]) {
        const newDropdownItems: DropdownItem[] = [];
        for (const bookmark of bookmarks) {
            newDropdownItems.push(this.createDaemonNameHeaderRow(bookmark));
            for (const favoritePath of bookmark.favoritePaths) {
                newDropdownItems.push(this.createFavoritePathSubRow(bookmark, favoritePath));
            }
            newDropdownItems.push(this.createAddFavoritePathSubRow(bookmark));
        }
        newDropdownItems.push(this.createAddDaemonHeaderRow(), this.createAddDaemonSubRow());
        this.dropdownItems = newDropdownItems;
    }

    /**
     * Creates the DropdownItem row for daemon name in the dropdown
     * @param bookmark Daemon name to display
     * @private
     */
    private createDaemonNameHeaderRow(bookmark: Bookmark): DropdownItem {
        const actionIcons: ActionIcon[] = [
            {
                id: 'edit-action-icon',
                type: 'action-icon',
                dropdownIcon: EDIT_ICON,
                iconClickHandler: () => {
                    this.editRemoteDaemon(bookmark);
                },
            },
        ];
        if (bookmark.name === DEFAULT_BOOKMARK_NAME) {
            // only don't show stop daemon button if on the local daemon and not connected
            if (this.currentBookmark?.name === DEFAULT_BOOKMARK_NAME && this.connectionState !== ConnectionState.CONNECTED) {
                actionIcons.push({
                    id: 'placeholder',
                    type: 'placeholder',
                });
            } else {
                actionIcons.push({
                    id: 'stop-action-icon',
                    type: 'action-icon',
                    dropdownIcon: STOP_ICON,
                    iconClickHandler: () => {
                        this.stopLocalDaemon();
                    },
                });
            }
        } else {
            actionIcons.push({
                id: 'delete-action-icon',
                type: 'action-icon',
                dropdownIcon: TRASH_ICON,
                iconClickHandler: () => {
                    this.deleteRemoteDaemon(bookmark);
                },
            });
        }
        return {
            id: `daemon-name-header-row-${bookmark.name}`,
            type: 'section-header',
            text: bookmark.name,
            itemClickHandler: () => {
                this.selectDaemon(bookmark, bookmark.onConnectStartingPath);
            },
            actionIcons: actionIcons,
        };
    }

    /**
     * Creates the DropdownItem row for a daemon's favorite path
     * @param bookmark Daemon that the favorite path belongs to
     * @param favoritePath Favorite path string
     * @private
     */
    private createFavoritePathSubRow(bookmark: Bookmark, favoritePath: string): DropdownItem {
        return {
            id: `favorite-path-sub-row-${bookmark.name}-${favoritePath}`,
            type: 'section-item',
            text: favoritePath,
            tooltipText: favoritePath,
            leadingIcon: STAR_ICON,
            itemClickHandler: () => {
                this.navigateFavoritePath(bookmark, favoritePath);
            },
            actionIcons: [
                {
                    id: 'delete-action-icon',
                    type: 'action-icon',
                    dropdownIcon: TRASH_ICON,
                    iconClickHandler: () => {
                        this.deleteFavoritePath(bookmark, favoritePath);
                    },
                },
            ],
        };
    }

    /**
     * Creates the DropdownItem row for the add favorite path option in the dropdown
     * @param bookmark Daemon to add the favorite path for
     * @private
     */
    private createAddFavoritePathSubRow(bookmark: Bookmark): DropdownItem {
        return {
            id: `add-favorite-path-sub-row-${bookmark.name}`,
            type: 'section-item',
            text: 'Add Favorite Path...',
            leadingIcon: ADD_ICON,
            itemClickHandler: () => {
                this.addFavoritePath(bookmark);
            },
        };
    }

    /**
     * Creates the DropdownItem row for Add Remote Daemon section title in the dropdown
     * @private
     */
    private createAddDaemonHeaderRow(): DropdownItem {
        return {
            id: 'add-daemon-header-row',
            type: 'section-header',
            text: 'Add Remote Daemon',
        };
    }

    /**
     * Creates the DropdownItem row for the add remote daemon option in the dropdown
     * @private
     */
    private createAddDaemonSubRow(): DropdownItem {
        return {
            id: 'add-daemon-sub-row',
            type: 'section-item',
            leadingIcon: ADD_CIRCLE_ICON,
            text: 'Add Remote Daemon...',
            itemClickHandler: () => {
                this.addRemoteDaemon();
            },
        };
    }

    /**
     * Set the currently selected bookmark if the user confirms in the confirmation modal.
     * Confirmation is only needed if the user is switching between bookmarks
     * @param bookmark Bookmark to select
     * @param onConnectStartingPath Path to start navigation from when bookmark is connected to
     * @private
     */
    private selectDaemon(bookmark: Bookmark, onConnectStartingPath: string | null) {
        const currentBookmark = this.currentBookmark;
        if (currentBookmark) {
            let titleText = 'Connect to Daemon';
            let messageText = `Are you sure you want to connect to <b>${bookmark.name}</b> and disconnect from <b>${currentBookmark.name}</b>?`;
            let confirmText = 'Connect';
            if (currentBookmark.name === bookmark.name) {
                titleText = 'Retry Connection';
                messageText = `Retry connection to daemon <b>${bookmark.name}</b>?`;
                confirmText = 'Retry Connection';
            }
            messageText += ' The jobs table will be cleared and you will not receive any more updates about currently ongoing jobs in the jobs table.';

            const dialogRef = this.dialog.open(
                ConfirmationModalComponent,
                {
                    width: '520px',
                    data: {
                        cancelText: 'Cancel',
                        confirmText: confirmText,
                        message: messageText,
                        title: titleText,
                    },
                },
            );
            dialogRef.afterClosed().subscribe(
                (result) => {
                    if (result) {
                        bookmark.onConnectStartingPath = onConnectStartingPath;
                        try {
                            this.bookmarks.setSelection(bookmark.name);
                        } catch (e) {
                            this.notifications.warning(`Failed to switch daemons: ${(e as Error).message}`);
                        }
                    }
                },
            );
        }
    }

    /**
     * Open add favorite path modal for the given bookmark. Prefills the favorite path modal form value with the current
     * directory if the user is connected to that bookmark and the current directory is not already a favorite path. The
     * user is free to change this prefilled path if they want to add another path instead.
     * @param bookmark Name of the bookmark to add a favorite path to
     * @private
     */
    private addFavoritePath(bookmark: Bookmark) {
        let favoritePathToPrefill = grpcPathToDisplayPath(this.currentDirectory, this.fileBrowserType);
        if (bookmark.name !== this.currentBookmark?.name || this.bookmarks.hasFavoritePath(bookmark, favoritePathToPrefill)) {
            favoritePathToPrefill = '';
        }
        const dialogRef = this.dialog.open(FavoritePathModalComponent, {
            width: '50%',
            maxWidth: '600px',
            data: {
                prefilledFavoritePath: favoritePathToPrefill,
                bookmark: bookmark,
            },
        });
        const dialogOnSave = dialogRef.componentInstance.favoritePathSaved.subscribe({
            next: (favoritePath: string) => {
                if (favoritePath) {
                    const addResult = this.bookmarks.addFavoritePath(bookmark, favoritePath);
                    if (addResult) {
                        this.notifications.open(addResult.message, addResult.level);
                    }
                }
            },
        });
        dialogRef.afterClosed().subscribe(() => {
            dialogOnSave.unsubscribe();
        });
    }

    /**
     * Deletes the given favorite path from the bookmark if the user confirms to
     * @param bookmark Bookmark to delete favorite path from
     * @param favoritePath Favorite path to delete
     * @private
     */
    private deleteFavoritePath(bookmark: Bookmark, favoritePath: string) {
        const dialogRef = this.dialog.open(
            ConfirmationModalComponent,
            {
                width: '520px',
                data: {
                    cancelText: 'Cancel',
                    confirmText: 'Delete',
                    message: `Are you sure you want to delete the favorite path ${favoritePath} from ${bookmark.name}?`,
                    title: 'Delete Favorite Path',
                },
            },
        );
        dialogRef.afterClosed().subscribe(
            (result) => {
                if (result) {
                    const deleteResult = this.bookmarks.deleteFavoritePath(bookmark, favoritePath);
                    if (deleteResult) {
                        this.notifications.open(deleteResult.message, deleteResult.level);
                    }
                }
            },
        );
    }

    /**
     * Navigates to the given favorite path. Will switch bookmarks if the given bookmark is different from the current one
     * and the user confirms they want to switch.
     * @param bookmark Bookmark that favorite path belongs to
     * @param favoritePath Favorite path to navigate to
     * @private
     */
    private navigateFavoritePath(bookmark: Bookmark, favoritePath: string) {
        const favoriteGrpcPath = displayPathToGrpcPath(favoritePath, this.fileBrowserType);
        if (bookmark.name === this.currentBookmark?.name) {
            this.daemonSelectorNavigate.emit(favoriteGrpcPath);
        } else {
            this.selectDaemon(bookmark, favoriteGrpcPath);
        }
    }

    /**
     * Open the daemon editor modal to add a new remote daemon
     * @private
     */
    private addRemoteDaemon() {
        const dialogRef = this.dialog.open(DaemonEditorModalComponent, {
            width: '50%',
            maxWidth: '600px',
            data: {
                mode: 'add',
                remote: true,
            },
        });

        const dialogOnSave = dialogRef.componentInstance.bookmarkSaved.pipe(
            handleStreamError({retryCount: 3}),
        ).subscribe({
            next: (bookmark) => {
                try {
                    if (this.bookmarks.add(new Bookmark(bookmark))) {
                        dialogRef.close();
                        this.notifications.success(`Added daemon ${bookmark.name}`);
                    } else {
                        this.notifications.warning(`Could not add daemon, the name ${bookmark.name} is already in use`);
                    }
                } catch (e) {
                    console.error(e);
                    this.notifications.error(NotificationMessages.ADD_BOOKMARK_ERROR);
                }
            },
            error: (error) => {
                this.notifications.notifyStreamError(error);
            },
        });

        dialogRef.afterClosed().subscribe(() => {
            dialogOnSave.unsubscribe();
        });
    }


    /**
     * Open the daemon editor modal to edit a remote daemon
     * @private
     */
    private editRemoteDaemon(bookmark: Bookmark) {
        const dialogRef = this.dialog.open(DaemonEditorModalComponent, {
            width: '50%',
            maxWidth: '600px',
            data: {
                bookmark: bookmark,
                mode: 'edit',
                remote: bookmark.name !== DEFAULT_BOOKMARK_NAME,
            },
        });

        const dialogOnEdit = dialogRef.componentInstance.bookmarkSaved.pipe(
            handleStreamError({retryCount: 3}),
        ).subscribe({
            next: (editedBookmark) => {
                try {
                    this.bookmarks.edit(new Bookmark({
                        ...editedBookmark,
                        favoritePaths: bookmark.favoritePaths,
                        onConnectStartingPath: bookmark.onConnectStartingPath,
                    }));
                    dialogRef.close();
                    this.notifications.success(`Updated daemon ${bookmark.name}`);
                } catch (e) {
                    console.error(e);
                    this.notifications.error(NotificationMessages.EDIT_BOOKMARK_ERROR);
                }
            },
            error: (error) => {
                this.notifications.notifyStreamError(error);
            },
        });

        dialogRef.afterClosed().subscribe(() => {
            dialogOnEdit.unsubscribe();
        });
    }

    /**
     * Delete the given remote daemon editor if the user confirms in confirmation modal
     * @param bookmark Remote daemon to delete
     * @private
     */
    private deleteRemoteDaemon(bookmark: Bookmark) {
        let confirmationMessage = `Are you sure you want to delete the daemon <b>${bookmark.name}</b>?`;
        if (this.currentBookmark?.name === bookmark.name) {
            confirmationMessage += ' You are currently connected to this daemon.';
        }
        const dialogRef = this.dialog.open(
            ConfirmationModalComponent,
            {
                width: '520px',
                data: {
                    cancelText: 'Cancel',
                    confirmText: 'Delete',
                    message: confirmationMessage,
                    title: 'Delete Daemon',
                },
            },
        );

        dialogRef.afterClosed().subscribe(
            (result) => {
                try {
                    if (result) {
                        const result = this.bookmarks.delete(bookmark.name);
                        if (result) {
                            this.notifications.open(result.message, result.level);
                            return;
                        }
                        this.notifications.info(`Deleted daemon ${bookmark.name}`);
                    }
                } catch (e) {
                    console.error(e);
                    this.notifications.error(NotificationMessages.DELETE_BOOKMARK_ERROR);
                }
            },
        );
    }

    /**
     * Tries to stop the local daemon if the user confirms in confirmation modal
     * @private
     */
    private stopLocalDaemon() {
        const clearJobsMessage: string = this.currentBookmark?.name === DEFAULT_BOOKMARK_NAME ?
            `The jobs table will be cleared and any ongoing jobs running in the ${DEFAULT_BOOKMARK_NAME} daemon will be terminated.` :
            `Any ongoing jobs running in the ${DEFAULT_BOOKMARK_NAME} daemon will be terminated.`;
        const confirmationMessage =
            `Are you sure you want to try to stop the running <b>${DEFAULT_BOOKMARK_NAME}</b> daemon? ${clearJobsMessage}
            <br/> If the daemon was started with a CLI command, it cannot be stopped here and must be cancelled through
            the command line.`;
        const dialogRef = this.dialog.open(
            ConfirmationModalComponent,
            {
                width: '520px',
                data: {
                    cancelText: 'Cancel',
                    confirmText: 'Stop Daemon',
                    message: confirmationMessage,
                    title: 'Stop Local Daemon',
                },
            },
        );

        dialogRef.afterClosed().subscribe(
            (result) => {
                try {
                    if (result) {
                        try {
                            this.fmeClientService.shutdown();
                            this.notifications.info('Attempted to stop the running local daemon.');
                        } catch(error) {
                            console.debug(`Failed stopping daemon: ${error}`);
                            this.notifications.error('Unable to stop the local daemon.');
                        }
                    }
                } catch (e) {
                    console.error(e);
                    this.notifications.error('Unable to stop the local daemon.');
                }
            },
        );
    }
}
