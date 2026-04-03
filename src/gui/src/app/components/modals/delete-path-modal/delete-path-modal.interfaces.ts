import { FileBrowserType } from '@app/components/layout/file-browser/file-browser.interfaces';
import { PathType } from '@app/interfaces/paths';

export interface DeletePathModalData {
    pathToDelete: string;
    pathType: PathType;
    osType: FileBrowserType;
    transferProfile?: string;
}
