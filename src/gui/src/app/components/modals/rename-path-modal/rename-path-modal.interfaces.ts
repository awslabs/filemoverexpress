import { FileBrowserType } from '@app/components/layout/file-browser/file-browser.interfaces';
import { PathType } from '@app/interfaces/paths';

export interface RenamePathModalData {
    parentDirectory: string;
    objectToRename: string;
    pathType: PathType;
    osType: FileBrowserType;
    transferProfile?: string;
}
