export const notificationMessages = {
    EXTERNAL_DOWNLOAD_ERROR: 'Unable to drop file. Externally dragged files can only be dropped into your S3 bucket.',
    NO_TRANSFER_PROFILE_SELECTED_ERROR: 'Can\'t download because there is no Remote Configuration selected',
    GRPC_DOWNLOAD_ERROR: 'Failed to start download: ',
} as const;

export const DAEMON_FILE_BROWSER_ID = 'daemon-browser';

export const fileBrowserErrors = {
    NO_BOOKMARK_SELECTED: {
        title: 'No Selected Daemon',
        message: 'Select a daemon from the dropdown to connect to.',
    },
    NO_ACTIVE_SESSION_LOCAL: {
        title: 'Not Connected',
        message: 'You\'re not connected to the local daemon. Retry the connection to start the daemon.',
    },
    NO_ACTIVE_SESSION_REMOTE: {
        title: 'Not Connected',
        message: 'You\'re not connected to this daemon. Start the daemon on the remote machine and confirm your ' +
            'connection settings, then connect.',
    },
    CONNECTION_FAILED_LOCAL: {
        title: 'Connection Failed',
        message: 'Couldn\'t start or connect to the local daemon. Check your daemon settings, then retry.',
        severity: 'error',
    },
    CONNECTION_FAILED_REMOTE: {
        title: 'Connection Failed',
        message: 'Couldn\'t reach the daemon. Make sure it\'s running on the remote machine and that your connection ' +
            'settings (address, port, and password) are correct, then retry.',
        severity: 'error',
    },
    CONNECTING_TO_SESSION: {
        title: 'Connecting to Session',
        message: 'Attempting to connect to session...',
    },
    LIST_FOLDER_ERROR: {
        title: 'File System Listing Error',
        message: 'Unable to list the daemon file system folder.',
        severity: 'error',
    },
    REDIRECT_TO_ROOT_ERROR: {
        title: 'File System Listing Error',
        message: 'Unable to list the daemon file system folder. Tried to redirect to the daemon file system root ' +
            'folder and also failed.',
        severity: 'error',
    },
} as const;
