import {
    Checksums,
    ConfigGeneral,
    ConfigLogging,
    ConfigProtocols,
    ConfigReports,
    ConfigS3,
    Paths,
} from '../interfaces/config';

export const DEFAULT_S3_CONFIG: ConfigS3 = {
    transferProfiles: {},
};

export const DEFAULT_PATHS: Paths = {
    local: '',
    remote: '',
};

export const DEFAULT_CHECKSUMS: Checksums = {
    enabled: false,
    algorithm: 'none',
};

export const DEFAULT_GENERAL_SETTINGS: ConfigGeneral = {
    noSleep: false,
    retryCount: 3,
    maxActiveChecksums: 10,
    maxActiveTransfers: 100,
    autoMaxActiveTransfers: false,
    targetBandwidth: 0,
    // Only used when the daemon sends no general settings at all. These match the daemon's
    // defaults (buildDefaultsMap in src/cli/config/config.go), except sendBufferBytes: the
    // daemon uses 2 MB on macOS, but the GUI can't know which OS the daemon runs on (it may
    // be remote), so it falls back to 0, meaning the OS default.
    maxConnectionsPerHost: 0,
    sendBufferBytes: 0,
    adaptiveConcurrency: true,
};

export const DEFAULT_LOGGING_SETTINGS: ConfigLogging = {
    directory: '',
    severity: '',
    maxSize: 0,
    maxAge: 0,
    compress: false,
};

export const DEFAULT_REPORTS_SETTINGS: ConfigReports = {
    directory: '',
};

export const DEFAULT_PROTOCOLS_SETTINGS: ConfigProtocols = {
    s3: DEFAULT_S3_CONFIG,
};
