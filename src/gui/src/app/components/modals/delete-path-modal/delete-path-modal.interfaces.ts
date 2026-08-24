import { FileBrowserType } from '@app/components/layout/file-browser/file-browser.interfaces';
import { PathType } from '@app/interfaces/paths';

export interface DeletePathModalData {
    pathToDelete: string;
    // Optional multi-delete list. When it holds more than one entry the modal shows a
    // count + scrollable list; single-path callers can omit it and use pathToDelete.
    pathsToDelete?: string[];
    // Optional folder/file split for the multi-delete summary ("3 folders and 2 objects").
    folderCount?: number;
    fileCount?: number;
    pathType: PathType;
    osType: FileBrowserType;
    transferProfile?: string;
}
