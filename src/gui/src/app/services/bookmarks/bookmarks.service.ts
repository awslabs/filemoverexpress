import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LocalStorageService } from '../local-storage/local-storage.service';
import { Bookmark } from './bookmarks.classes';
import { BookmarkActionResult, BookmarkStorage } from './bookmarks.interfaces';
import { PanelLevel } from '../notifications/notifications.constants';
import {
    BOOKMARK_LIST_STORAGE_KEY,
    CURRENT_BOOKMARK_STORAGE_KEY,
    DEFAULT_BOOKMARK,
    DEFAULT_BOOKMARK_NAME,
    DEFAULT_BOOKMARK_STORE,
    DEFAULT_HOST_NAME,
} from './bookmarks.constants';
import { StorageServiceError } from '@app/classes/errors';
import { processFavoritePath } from '@services/bookmarks/bookmarks.utils';

@Injectable({
    providedIn: 'root',
})
export class BookmarksService {
    private readonly currentSelection$: BehaviorSubject<Bookmark>;
    private readonly bookmarks$: BehaviorSubject<Bookmark[]>;
    private readonly bookmarksStore: BookmarkStorage = {...DEFAULT_BOOKMARK_STORE};
    private readonly storage = inject(LocalStorageService);
    private currentSelectionName = '';

    constructor() {
        try {
            const result = this.storage.getObject<BookmarkStorage>(BOOKMARK_LIST_STORAGE_KEY, DEFAULT_BOOKMARK_STORE);
            if (Array.isArray(result)) {
                this.bookmarksStore = {
                    version: 1,
                    bookmarks: result.map((itm) => new Bookmark(itm)),
                };
                this.setSelection(DEFAULT_BOOKMARK_NAME);

            } else {
                this.bookmarksStore = {
                    ...result,
                    bookmarks: result.bookmarks.map((itm) => new Bookmark(itm)),
                };
            }

            // clear out the starting paths if any were saved from a previous session
            this.bookmarksStore.bookmarks = this.bookmarksStore.bookmarks.map(
                (bookmark) => {
                    bookmark.onConnectStartingPath = null;
                    return bookmark;
                },
            );
        } catch (e) {
            if (e instanceof StorageServiceError) {
                console.debug(`'StorageServiceError: Couldn't get bookmarks from local storage: ${e.message}`);
            }
        }

        try {
            this.currentSelectionName = this.storage.getString(CURRENT_BOOKMARK_STORAGE_KEY, DEFAULT_BOOKMARK_NAME);
        } catch (e) {
            if (e instanceof StorageServiceError) {
                console.debug('StorageServiceError: Couldn\'t get current bookmark from local storage');
            }
        }

        this.bookmarks$ = new BehaviorSubject<Bookmark[]>(this.bookmarksStore.bookmarks);
        const currentSelection = this.getByName(this.currentSelectionName);

        if (currentSelection) {
            this.currentSelection$ = new BehaviorSubject<Bookmark>(currentSelection);
        } else {
            this.currentSelectionName = DEFAULT_BOOKMARK_NAME;
            this.currentSelection$ = new BehaviorSubject<Bookmark>(this.getByName(DEFAULT_BOOKMARK_NAME)!);
        }

        // validation can only be run after bookmarks$ and currentSelection$ initialized
        this.validateBookmarks();
        this.save();
    }

    /**
     * Get observable for the current bookmark selection
     */
    get current(): Observable<Bookmark> {
        return this.currentSelection$ as Observable<Bookmark>;
    }

    /**
     * Get observable for the list of all bookmarks
     */
    get getAllBookmarks(): Observable<Bookmark[]> {
        return this.bookmarks$ as Observable<Bookmark[]>;
    }

    /**
     * Get a bookmark's data by name. Returns undefined if a bookmark with the given name doesn't exist
     * @param name Bookmark name to find
     */
    getByName(name: string): Bookmark | undefined {
        return this.bookmarksStore.bookmarks.find((bookmark) => bookmark.name === name);
    }

    /**
     * Returns if the given bookmark is the default local daemon bookmark
     * @param bookmark Bookmark to check
     */
    isDefaultLocalDaemon(bookmark: Bookmark) {
        return bookmark.name === DEFAULT_BOOKMARK_NAME;
    }

    /**
     * Set the current selected bookmark to the given bookmark
     * @param bookmarkName Name of the bookmark to select
     * @throws Error Throws an Error if the provided bookmark name doesn't exist
     */
    setSelection(bookmarkName: string): void {
        this.currentSelectionName = bookmarkName;
        const bookmark: Bookmark | undefined = this.bookmarksStore.bookmarks.find((itm) => itm.name === bookmarkName);
        if (bookmark) {
            this.storage.set(CURRENT_BOOKMARK_STORAGE_KEY, bookmarkName);
            this.currentSelection$.next(bookmark);
        } else {
            throw new Error(`No such bookmark found: ${bookmarkName}`);
        }
    }

    /**
     * Adds a bookmark to the bookmarks list and saves to local storage. Returns true if successful. Returns false if
     * another bookmark with the same name already exists
     * @param bookmark Bookmark to add
     */
    add(bookmark: Bookmark): boolean {
        if (this.bookmarksStore.bookmarks.find((itm) => bookmark.name === itm.name)) {
            return false;
        } else {
            this.bookmarksStore.bookmarks.push(bookmark);
            this.save();
        }

        return true;
    }

    /**
     * Deletes a bookmark from the bookmarks list and saves to local storage. Doesn't allow deletion of local daemon
     * bookmark. Returns a BookmarkActionResult that explains the deletion status
     * @param bookmarkName Name of the bookmark to delete
     */
    delete(bookmarkName: string): BookmarkActionResult | null {
        let message = `Deleted the daemon ${bookmarkName}.`;

        if (bookmarkName === DEFAULT_BOOKMARK_NAME) {
            return {
                message: `You cannot delete the daemon ${DEFAULT_BOOKMARK_NAME}`,
                level: PanelLevel.ERROR,
            };
        }

        this.bookmarksStore.bookmarks = this.bookmarksStore.bookmarks.filter((bookmark) => bookmark.name !== bookmarkName);
        if (this.bookmarksStore.bookmarks.length === 0) {
            this.bookmarksStore.bookmarks = [DEFAULT_BOOKMARK];
        }

        if (bookmarkName === this.currentSelectionName) {
            try {
                this.setSelection(DEFAULT_BOOKMARK_NAME);
                message = `Deleting active daemon. Setting current daemon to ${DEFAULT_BOOKMARK_NAME}`;
            } catch {
                const firstBookmarkName = this.bookmarksStore.bookmarks[0].name;
                this.setSelection(firstBookmarkName);
                message = `Deleting active daemon. Setting current daemon to ${firstBookmarkName}`;
            }
        }
        this.validateBookmarks();
        this.save();

        return {
            message,
            level: PanelLevel.INFO,
        };
    }

    /**
     * Replaces the bookmark in the bookmarks list with the same name as the given bookmark with the given bookmark
     * and saves it to local storage.
     * @param bookmark Bookmark with replace the old one with
     */
    edit(bookmark: Bookmark) {
        this.bookmarksStore.bookmarks = this.bookmarksStore.bookmarks.map((itm) => {
            if (itm.name === bookmark.name) {
                return bookmark;
            }
            return itm;
        });
        this.save();
    }

    /**
     * Adds the given favorite path to the given bookmark and saves the result to local storage
     * @param bookmark Bookmark to add the favorite path to
     * @param favoritePath Favorite path to add to bookmark
     */
    addFavoritePath(bookmark: Bookmark, favoritePath: string): BookmarkActionResult | null {
        if (!this.hasBookmark(bookmark)) {
            return {
                message: `Daemon ${bookmark.name} doesn't exist. Failed to add favorite path.`,
                level: PanelLevel.ERROR,
            };
        }
        if (this.hasFavoritePath(bookmark, favoritePath)) {
            return {
                message: `Daemon ${bookmark.name} already has favorite path ${favoritePath}.`,
                level: PanelLevel.ERROR,
            };
        }
        bookmark.favoritePaths.push(processFavoritePath(favoritePath));
        this.edit(bookmark);
        return {
            message: `Added favorite path ${favoritePath} to daemon ${bookmark.name}.`,
            level: PanelLevel.SUCCESS,
        };
    }

    /**
     * Deletes the given favorite path from the given bookmark and saves the result to local storage
     * @param bookmark Bookmark to delete favorite path from
     * @param favoritePath Favorite path to delete from bookmark
     */
    deleteFavoritePath(bookmark: Bookmark, favoritePath: string): BookmarkActionResult | null {
        if (!this.hasBookmark(bookmark)) {
            return {
                message: `Daemon ${bookmark.name} doesn't exist. Failed to delete favorite path.`,
                level: PanelLevel.ERROR,
            };
        }
        const editedFavoritePaths = bookmark.favoritePaths.filter((path) => {
            return path !== processFavoritePath(favoritePath);
        });
        if (editedFavoritePaths.length === bookmark.favoritePaths.length) {
            return null;
        }
        bookmark.favoritePaths = editedFavoritePaths;
        this.edit(bookmark);
        return {
            message: `Removed favorite path ${favoritePath} from daemon ${bookmark.name}.`,
            level: PanelLevel.SUCCESS,
        };
    }

    /**
     * Returns if a bookmark has a favorite path
     * @param bookmark Bookmark to check if favorite path belongs to it
     * @param favoritePath Favorite path to check
     */
    hasFavoritePath(bookmark: Bookmark, favoritePath: string): boolean {
        return bookmark.favoritePaths.includes(processFavoritePath(favoritePath));
    }

    /**
     * Checks if the given bookmark is in the bookmarks list
     * @param bookmark Bookmark to check
     * @return True if the given bookmark is in the bookmarks list
     * @private
     */
    private hasBookmark(bookmark: Bookmark): boolean {
        for (const b of this.bookmarksStore.bookmarks) {
            if (bookmark.name === b.name) {
                return true;
            }
        }
        return false;
    }

    /**
     * Performs validation on bookmarks list and current selection. If these are malformed, then the list and selection
     * are restored to a good state. These are malformed if the list is empty, the default local bookmark is missing,
     * the current selection is not in the bookmarks list, and/or the data doesn't follow our restrictions.
     * @private
     */
    private validateBookmarks() {
        if (!this.bookmarksStore.bookmarks.length) {
            this.bookmarksStore.bookmarks = [DEFAULT_BOOKMARK];
        }

        if (!this.bookmarksStore.bookmarks.find((bookmark) => bookmark.name === DEFAULT_BOOKMARK_NAME)) {
            this.bookmarksStore.bookmarks.unshift(DEFAULT_BOOKMARK);
        }

        this.bookmarksStore.bookmarks.forEach((bookmark) => {
            if (bookmark.name === DEFAULT_BOOKMARK_NAME) {
                bookmark.host = DEFAULT_HOST_NAME;
            } else {
                bookmark.encryption = true;
            }
        });
        if (this.bookmarksStore.bookmarks.filter((itm) => itm.name === this.currentSelectionName).length === 0) {
            this.setSelection(DEFAULT_BOOKMARK_NAME);
        }
    }

    /**
     * Saves the current bookmark list and selection state to local storage and emits the bookmark list
     * @private
     */
    private save() {
        this.storage.set(BOOKMARK_LIST_STORAGE_KEY, this.bookmarksStore);
        this.storage.set(CURRENT_BOOKMARK_STORAGE_KEY, this.currentSelectionName);
        this.bookmarks$.next(this.bookmarksStore.bookmarks);
    }
}
