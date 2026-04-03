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
        title: 'No Active Session',
        message: 'You are not connected to an active daemon session. Verify your settings are correct for the daemon ' +
            'and retry the connection to start the daemon.',
    },
    NO_ACTIVE_SESSION_REMOTE: {
        title: 'No Active Session',
        message: 'You are not connected to an active daemon session. Verify your settings are correct for the daemon ' +
            'and start the daemon on the remote machine, then retry the connection.',
    },
    CONNECTING_TO_SESSION: {
        title: 'Connecting to Session',
        message: 'Attempting to connect to session...',
    },
    LIST_FOLDER_ERROR: {
        title: 'File System Listing Error',
        message: 'Unable to list the daemon file system folder.',
    },
    REDIRECT_TO_ROOT_ERROR: {
        title: 'File System Listing Error',
        message: 'Unable to list the daemon file system folder. Tried to redirect to the daemon file system root ' +
            'folder and also failed.',
    },
} as const;
