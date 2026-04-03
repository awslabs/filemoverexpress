import { PanelLevel } from '../notifications/notifications.constants';
import { Bookmark as CBookmark } from '@services/bookmarks/bookmarks.classes';

export interface BookmarkStorage {
    version: number;
    bookmarks: CBookmark[];
}

export interface Bookmark {
    name: string;
    host: string;
    port: number;
    encryption: boolean;
    pre_shared_key: string;
    favoritePaths: string[];
    onConnectStartingPath: string | null;
}

export interface BookmarkActionResult {
    message: string;
    level: PanelLevel;
}
