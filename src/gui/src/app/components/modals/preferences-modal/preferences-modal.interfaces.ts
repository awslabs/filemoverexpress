import { NotificationPosition } from '@services/preferences/preferences.interfaces';

export interface PrefsPosition {
    name: string;
    position: NotificationPosition;
}

export interface PrefsAutoHideDelay {
    name: string;
    value: number;
}

export interface PrefsDaemonShutdown {
    name: string;
    value: string;
}
