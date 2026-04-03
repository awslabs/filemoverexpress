import { Bookmark } from '@services/bookmarks/bookmarks.classes';

export interface DaemonEditorModalData {
    mode: EditorMode;
    remote: boolean;
    bookmark?: Bookmark;
}

export type EditorMode = 'add' | 'edit';
