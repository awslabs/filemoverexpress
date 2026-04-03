import { FileBrowserObject } from '@app/components/layout/file-browser/file-browser.interfaces';

export enum TransferDirection {
    UPLOAD,
    DOWNLOAD
}

export interface TransferSettingsModalData {
    transferDirection: TransferDirection;
    objectsToTransfer: FileBrowserObject[];
    destinationPath: string;
    jobName: string;
    dragOriginObjectName: string;
    forceTransfers: boolean; // use if you want to provide an initial value
}

export interface TransferSettingsModalResult {
    performTransfer: boolean;
    forceTransfers: boolean;
    jobName: string;
}

export interface ObjectTypeCount {
    numFolders: number;
    numFiles: number;
}
