import { Bookmark } from '@services/bookmarks/bookmarks.classes';

export interface FavoritePathModalData {
    bookmark: Bookmark;
    prefilledFavoritePath: string;
}
