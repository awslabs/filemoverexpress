import { Preferences } from './preferences.interfaces';

export const CACHE_KEY = 'preferences';

export const defaultOptions: Preferences = {
    notificationPosition: {
        horizontal: 'center',
        vertical: 'top',
    },
    notificationAutoHideDelay: 5000,
    transferExport: 'ask',
    transferPageSize: 15,
    daemonClose: 'ask',
    trayHeight: 260,
};

