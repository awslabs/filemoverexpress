import { FileBrowserType } from '@app/components/layout/file-browser/file-browser.interfaces';

export enum StartingPathType {
    Local = 'local',
    S3 = 's3'
}

export interface StartingPathEditorData {
    type: StartingPathType;
    fileBrowserType: FileBrowserType;
    newStartingPath: string;
    originalStartingPath: string;
    transferProfile: string;
}
