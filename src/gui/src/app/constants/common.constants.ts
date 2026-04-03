export const sectionTitles = {
    CONFIGURATION: 'Settings',
    PREFERENCES: 'Preferences',
    HOT_FOLDERS: 'Hot Folders',
};

export const tooltipMessages = {
    START_SESSION: 'The session status displays when an Active connection to the CLI application is running on this host. To run uploads from the interface, select Activate to start your session.',
    STOP_SESSION: 'The session status displays when an Active connection to the CLI application is running on this host. Select Stop end your session.',
    DARK_MODE: 'Select to enable Light theme.',
    LIGHT_MODE: 'Select to enable Dark theme.',
    FILE_ORDER_LIST: 'Defines a priority of files to transfer',
    REPORTS_DIRECTORY: 'Defines a directory to output reports to. Defaults to a folder called "reports" in the configuration folder.',
    RETRY_COUNT: 'Maximum number of retry attempts if a transfer fails',
    FILE_BROWSER_REFRESH_NOTIFICATION: 'There are updates in the current directory. You can click here to refresh, but you will lose your current filter and selections.',
};

export const formErrorMessages = {
    severity: {
        required: 'Log severity is required.',
        oneOf: 'Log severity must be one of the following: info, warn, error, fatal',
    },
    loggingMaxSize: {
        minValue: 'Max size must be at least 0.',
    },
    threads: {
        required: 'Threads count is required.',
        minValue: 'Threads count must be at least 1.',
        integer: 'Threads count must be an integer',
        minValueWarn: 'The recommended minimum value for threads count is greater than or equal to 4',
        maxValueWarn: 'The recommended maximum value for threads count is less than 100',
    },
    chunkSize: {
        required: 'Chunk size is required.',
        minValue: 'Chunk size must be at least 5.',
        integer: 'Chunk size must be an integer',
        minValueWarn: 'The recommended minimum value for chunk size is greater than or equal to 5.',
        maxValueWarn: 'The recommended maximum value for chunk size is less than 100.',
    },
    maxActiveChecksums: {
        required: 'Max active checksums is required.',
        minValue: 'Max active checksums must be at least 1.',
        maxValue: 'Max active checksums value can\'t be greater than CPU cores.',
    },
    maxActiveTransfer: {
        required: 'Max active transfers is required.',
        minValue: 'Max active transfers must be at least 1.',
        maxValueWarn: 'The recommended maximum value for max active checksums is less than or equal to 20',
    },
    targetBandwidth: {
        required: 'Target Bandwidth is required.',
        minValue: 'Target Bandwidth cannot be negative.',
        maxValue: 'Target Bandwidth cannot exceed 1TB.',
    },
    s3MaxAge: {
        pattern: 'Invalid format.',
    },
    loggingMaxAge: {
        minValue: 'Max age must be a whole number greater than or equal to 0.',
    },
    transferProfileName: {
        required: 'Remote Configuration name is required.',
        hasSpaces: 'Remote Configuration name can\'t contain spaces.',
    },
    transferProfileBucket: {
        required: 'S3 bucket is required.',
    },
    transferProfileRegion: {
        required: 'AWS Region is required.',
    },
    transferProfilePrefix: {
        prefixIsURI: 'Remove leading <code>s3://</code> and S3 bucket name.',
    },
    transferProfileAccelerated: {
        bucketWithPeriods: 'S3 buckets used with Amazon S3 Transfer Acceleration can\'t have dots (.) in their names. Change the S3 bucket you are using or turn off S3 transfer acceleration.',
    },
    transferProfileFileOrderList: {
        invalidFileOrder: 'Extensions must begin with a dot and can only contain letters and numbers.',
    },
    transferProfileUploadHotFolder: {
        hotFolderDirectoryRequired: 'Local source folder is required when upload hot folder is enabled.',
        notAbsolutePath: 'Local source folder must be an absolute path.',
        notDarwinAbsolutePath: 'Local source folder must be a MacOS absolute path.',
        notLinuxAbsolutePath: 'Local source folder must be a Linux absolute path.',
        notWindowsAbsolutePath: 'Local source folder must be a Windows absolute path.',
    },
    retryCount: {
        required: 'Retry count is required.',
        minValue: 'Retry count must be at least 1.',
    },
    checksumAlgorithm: {
        oneOf: 'Checksum algorithm must be one of the following: MD5-Hex, XXHash, XXHash64, HHH3',
    },
    hotFolders: {
        name: {
            required: 'Name is required',
            duplicateName: 'Hot Folders cannot have duplicate names',
        },
        localSourceFolder: {
            required: 'Local source folder is required',
        },
        destinations: {
            required: 'You must have at least one destination. Add one with the "+" icon.',
            remoteConfiguration: {
                required: 'Remote configuration selection is required',
            },
        },
    },
};

export const bookmarkFormMessages = {
    name: {
        required: 'Name is required.',
    },
    host: {
        required: 'Host is required.',
    },
    portNumber: {
        required: 'Port number is required.',
    },
    preSharedKey: {
        required: 'Key is required for remote daemon.',
    },
    encryption: {
        hint: 'Remote daemon requires TLS connections, and cannot be disabled.',
    },
};

export const favoritePathFormMessages = {
    required: 'Favorite path is required.',
    pathAlreadyExists: 'This favorite path already exists for this daemon.',
};

export const NotificationMessages = {
    SET_CONFIG_SUCCESS: 'Successfully saved Settings.',
    SET_CONFIG_FAILURE: 'Error occurred while saving Settings.',
    GET_CONFIG_FAILURE: 'Error occurred while attempting to get configure information.',
    NO_FILE_FOLDER_TO_DOWNLOAD: 'No file(s)/folder(s) selected to download.',
    SET_TRANSFER_PROFILE_SUCCESS: 'Successfully added a the Remote Configuration to the Remote Configuration list. Save the configuration file to add it to list of active Remote Configurations.',
    SET_TRANSFER_PROFILE_FAILURE: 'Error occurred while adding Remote Configuration. Please review any errors.',
    TRANSFER_PROFILE_FORM_OPEN: 'Remote Configuration form is currently open. Choose "Save Remote Configuration" to save your changes. Choose "Close Remote Configuration form" to close the page without saving your changes.',
    METADATA_ERROR: 'Error occurred while getting data from Daemon application.',
    EXPORT_ERROR: 'Error occurred while exporting transfers.',
    ADD_BOOKMARK_ERROR: 'Exception occurred while adding daemon.',
    EDIT_BOOKMARK_ERROR: 'Error occurred while editing daemon.',
    DELETE_BOOKMARK_ERROR: 'Error occurred while deleting daemon.',
    ADD_TRANSFER_PROFILE_ERROR: 'Error occurred while adding Remote Configuration.',
    EDIT_TRANSFER_PROFILE_ERROR: 'Error occurred while editing Remote Configuration.',
    DELETE_TRANSFER_PROFILE_ERROR: 'Error occurred while deleting Remote Configuration.',
    BUCKET_BROWSE_ERROR: 'Error occurred while browsing S3 bucket.',
    DAEMON_BROWSE_ERROR: 'Error occurred while browsing file system.',
    DOWNLOAD_ERROR: 'Error occurred while downloading files.',
    UPLOAD_ERROR: 'Error occurred while uploading files.',
    BOOKMARK_CONNECT_ERROR: 'Error occurred while connecting to daemon.',
    SETUP_WIZARD_DISCONNECT_ERROR: 'Your session was disconnected, so the setup tutorial can\'t be completed. Reconnect to the session with the Manage Bookmarks icon in the toolbar.',
    SETUP_WIZARD_GET_CONFIG_FAILURE: `Choose ${sectionTitles.CONFIGURATION} from the toolbar dropdown to set up required settings to start using File Mover Express.`,
    SETUP_WIZARD_SET_CONFIG_SUCCESS: `${sectionTitles.CONFIGURATION} saved successfully.`,
    SETUP_WIZARD_SET_CONFIG_FAILURE: `Error occurred while saving your settings. Choose ${sectionTitles.CONFIGURATION} from the toolbar dropdown to set your configuration values again.`,
};

export const GRPC_PATH_SEPARATOR = '/';
