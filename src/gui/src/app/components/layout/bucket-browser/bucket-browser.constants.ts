import { FileBrowserData, FileBrowserState } from '../file-browser/file-browser.interfaces';
import { DEFAULT_BOOKMARK_NAME } from '@services/bookmarks/bookmarks.constants';

export const notificationMessages = {
    REMOTE_DAEMON_EXTERNAL_UPLOAD_ERROR: `Unable to drop file. Externally dragged files from your local machine can only be uploaded when connected to the daemon ${DEFAULT_BOOKMARK_NAME}.`,
    NO_TRANSFER_PROFILE_SELECTED_ERROR: 'Can\'t upload because there is no Remote Configuration selected.',
    GRPC_UPLOAD_ERROR: 'Failed to start upload: ',
};

export const BUCKET_FILE_BROWSER_ID = 'bucket-browser';

export interface FileBrowserError {
    title: string;
    message: string;
    severity?: 'error' | 'info';
    actionButtons?: {
        buttonText: string,
        buttonClickHandler: () => void,
    }[],
}

export const fileBrowserErrors: Record<string, FileBrowserError> = {
    NO_ACTIVE_SESSION: {
        title: 'No Active Session',
        message: 'You are not connected to an active daemon session.',
    },
    LIST_FOLDER_ERROR: {
        title: 'S3 Bucket Listing Error',
        message: 'Unable to list S3 bucket.',
        severity: 'error',
    },
    EMPTY_TRANSFER_PROFILE_LIST: {
        title: 'No Remote Configurations',
        message: 'No Remote Configurations to display.',
    },
    EMPTY_TRANSFER_PROFILE_LIST_NO_ALLOW_UI_CONFIG: {
        title: 'No Remote Configurations',
        message: `No Remote Configurations to display.
        The configuration for this daemon doesn't allow editing it through the GUI.
        Update the configuration file on the daemon machine to add a Remote Configuration.`,
    },
    NO_TRANSFER_PROFILE_SELECTED: {
        title: 'No Remote Configuration Selected',
        message: 'Select a Remote Configuration from the Remote Configurations dropdown.',
    },
    SIGN_IN_REQUIRED: {
        title: 'Sign in to continue',
        message: 'Sign in to your identity provider to browse this bucket.',
        severity: 'info',
    },
    LOADING_TRANSFER_PROFILE_LIST: {
        title: 'Loading',
        message: 'Loading the Remote Configuration list.',
    },
} as const;

export const BUCKET_BROWSER_INITIAL_DATA: FileBrowserData = {
    state: FileBrowserState.ERROR,
    list: [],
    error: fileBrowserErrors['NO_ACTIVE_SESSION'],
};
