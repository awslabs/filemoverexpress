import { VersionUpdateData } from './version.interfaces';

export const CACHE_KEY = 'updates';

export const defaultOptions: VersionUpdateData = {
    updatesIgnored: [],
    nextVersion: '',
    releaseNotes: [],
};

export enum VersionNumber {
    VERSION_EMPTY = '',
    VERSION_DEV = '0.0.0-local-dev',
    VERSION_DEFAULT = '0.0.0'
}
