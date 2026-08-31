import { MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';

export type PreferenceTransferExport = 'ask' | 'always' | 'never';

export interface NotificationPosition {
    vertical: MatSnackBarVerticalPosition;
    horizontal: MatSnackBarHorizontalPosition;
}

export type PreferenceDaemonClose = 'ask' | 'always' | 'never';

export interface Preferences {
    notificationPosition: NotificationPosition;
    notificationAutoHideDelay: number;
    transferExport: PreferenceTransferExport;
    transferPageSize: number;
    daemonClose: PreferenceDaemonClose;
    trayHeight: number;
    // When false (default), file browsers hide dotfiles (names starting with '.').
    showHiddenFiles: boolean;
}
