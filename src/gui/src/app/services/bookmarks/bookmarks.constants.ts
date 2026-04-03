import { Bookmark } from './bookmarks.classes';
import { BookmarkStorage } from '@services/bookmarks/bookmarks.interfaces';

export const BOOKMARK_LIST_STORAGE_KEY = 'bookmarks_v2';
export const CURRENT_BOOKMARK_STORAGE_KEY = 'currentBookmark_v2';
export const DEFAULT_BOOKMARK_NAME = 'Local File System';
export const DEFAULT_HOST_NAME = '127.0.0.1';
export const DEFAULT_BOOKMARK = new Bookmark(
    {
        name: DEFAULT_BOOKMARK_NAME,
        host: DEFAULT_HOST_NAME,
        port: 50006,
        encryption: false,
        pre_shared_key: '',
        favoritePaths: [],
        onConnectStartingPath: null,
    },
);
export const DEFAULT_BOOKMARK_STORE: BookmarkStorage = {
    version: 1,
    bookmarks: [DEFAULT_BOOKMARK],
};
