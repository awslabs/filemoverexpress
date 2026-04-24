import { AppState } from './index';
import { ConnectionState } from '@state/models/connection-state-model';

export const initialTestState: AppState = {
    fmeClient: {
        connectionState: ConnectionState.DISCONNECTED,
    },
    logs: {
        logs: [],
    },
    jobs: {
        ids: [],
        entities: {},
    },
    transferStats: {
        activeDownloads: 0,
        activeUploads: 0,
        downloadBps: 0,
        uploadBps: 0,
        totalBytesDownloaded: 0,
        totalBytesUploaded: 0,
    },
    notifications: {
        ids: [],
        entities: {},
    },
    uiContext: {
        daemonBrowserPath: '',
        bucketBrowserPath: '',
    },
};
