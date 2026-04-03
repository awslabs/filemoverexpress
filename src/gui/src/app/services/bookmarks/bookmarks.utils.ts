import { Bookmark } from '@services/bookmarks/bookmarks.classes';

/**
 * Processes the favorite path to a standardized form to store. Removes trailing slash if it's there
 * @param favoritePath Favorite path to process
 * @return The processed favorite path
 * @private
 */
export function processFavoritePath(favoritePath: string): string {
    if (favoritePath.length > 1 && favoritePath.endsWith('/')) {
        favoritePath = favoritePath.slice(0, -1);
    }
    return favoritePath;
}

/**
 * Returns true if a bookmark represents a local daemon connection
 * @param {Bookmark | null} bookmark - Bookmark to check
 * @returns {boolean} Whether the given bookmark is for a local daemon. Returns false if the bookmark is null.
 */
export function isLocalDaemon(bookmark: Bookmark | null): boolean {
    if (bookmark) {
        return bookmark.host.startsWith('127.');
    }
    return false;
}
