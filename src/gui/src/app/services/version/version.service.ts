import { EventEmitter, inject, Injectable } from '@angular/core';
import { CACHE_KEY, defaultOptions, VersionNumber } from './version.constants';
import { VersionUpdateData } from './version.interfaces';
import { LocalStorageService } from '../local-storage/local-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { compare } from 'semver-ts';
import { MetadataService } from '../metadata/metadata.service';
import { WailsService } from '@services/wails/wails.service';

@Injectable({
    providedIn: 'root',
})
export class VersionService {
    private storage = inject(LocalStorageService);
    private metadata = inject(MetadataService);
    private notifications = inject(NotificationsService);
    private wails = inject(WailsService);

    public onUpdate: EventEmitter<boolean>;
    private readonly versionUpdateData: VersionUpdateData;
    private skipUpdate = false;
    private appVersion: string | null = null;

    constructor() {
        this.onUpdate = new EventEmitter<boolean>();

        this.wails.appVersion().subscribe({
            next: (version) => {
                this.appVersion = version || VersionNumber.VERSION_DEV
            },
            error: () => {
                this.appVersion = VersionNumber.VERSION_DEV
            }
        })

        if (!this.storage.exists(CACHE_KEY)) {
            this.versionUpdateData = {...defaultOptions};
        } else {
            this.versionUpdateData = {
                ...defaultOptions,
                ...this.storage.getObject(CACHE_KEY) as VersionUpdateData,
            };
        }
    }

    getAllUpdates(): VersionUpdateData {
        return this.versionUpdateData;
    }

    private save() {
        this.storage.set(CACHE_KEY, this.versionUpdateData);
        this.onUpdate.emit(true);
    }

    set ignoreUpdate(update: string) {
        this.versionUpdateData.updatesIgnored.push(update);
        this.save();
    }

    get ignoredUpdates(): string[] {
        return this.versionUpdateData.updatesIgnored;
    }

    set nextVersion(version: string) {
        this.versionUpdateData.nextVersion = version;
        this.save();
    }

    get nextVersion(): string {
        return this.versionUpdateData.nextVersion;
    }

    skip() {
        this.skipUpdate = true;
    }

    get skipStatus() {
        return this.skipUpdate;
    }

    set releaseNotes(notes: string[]) {
        this.versionUpdateData.releaseNotes = notes;
        this.save();
    }

    get releaseNotes(): string[] {
        return this.versionUpdateData.releaseNotes;
    }

    get guiVersion(): string | null {
        return this.appVersion;
    }

    /**
     * Checks the daemon and GUI version to determine if a feature can be executed. Displays a notification warning message
     * if versions are incompatible.
     *
     * @param featureDescription Description of the feature, which will be displayed in a notification if versions aren't compatible
     * @param requiredApiVersion Minimum required daemon version for the feature to work. If empty version is provided, then the
     * minimum required version is the same as the GUI version.
     * @returns {boolean} - Returns true if the daemon version and GUI version are compatible and the feature should be executed
     */
    public requiredApiVersion(featureDescription: string, requiredApiVersion: VersionNumber = VersionNumber.VERSION_EMPTY): boolean {
        let daemonVersion: string;
        try {
            daemonVersion = this.metadata.daemonVersion;
        } catch (e) {
            console.error(`Error while retrieving daemon version: ${e}`);
            this.notifications.warning(`Unable to determine if the request to ${featureDescription} can be handled.`);
            return false;
        }
        const guiVersion = this.guiVersion;
        if (!guiVersion) {
            this.notifications.warning(`Unable to determine if the request to ${featureDescription} can be handled.`);
            return false;
        }
        const requiredApiVersionString = requiredApiVersion === VersionNumber.VERSION_EMPTY ? guiVersion : requiredApiVersion.toString();

        // allow for feature to always run during development
        if (this.runningInDevelopment(daemonVersion, guiVersion)) {
            this.notifications.warning(`You're running the application in development. Daemon version is ${daemonVersion}, GUI version is ${guiVersion}. Allowing feature to run: ${featureDescription}.`);
            return true;
        }
        if (this.runningDevBuilds(daemonVersion, guiVersion)) {
            this.notifications.warning(`You're running the application with development builds. Daemon version is ${daemonVersion}, GUI version is ${guiVersion}. Allowing feature to run: ${featureDescription}.`);
            return true;
        }

        let notificationMessage: string | null = null;

        try {
            if (compare(daemonVersion, requiredApiVersionString) === -1) {
                notificationMessage = `You’re using GUI version ${guiVersion} with daemon version ${daemonVersion}, which doesn’t support this feature. Upgrade the daemon to ${featureDescription}.`;
            } else if (compare(guiVersion, daemonVersion) === -1) {
                notificationMessage = `You’re using daemon version ${daemonVersion} with GUI version ${guiVersion}. Upgrade the GUI to ${featureDescription}.`;
            }
        } catch (e) {
            notificationMessage = `Invalid version detected. GUI version is ${guiVersion} and daemon version is ${daemonVersion}.
                Unable to determine if the request to ${featureDescription} can be handled.`;
            console.debug(`Invalid version detected: ${e}`);
        }

        if (notificationMessage) {
            this.notifications.warning(notificationMessage);
            return false;
        }
        return true;
    }

    /**
     * Checks if either the daemon or GUI is being run with development commands
     *
     * @param daemonVersion Daemon version
     * @param guiVersion GUI version
     */
    private runningInDevelopment(daemonVersion: string, guiVersion: string) {
        return daemonVersion === VersionNumber.VERSION_DEV || guiVersion === VersionNumber.VERSION_DEV;
    }

    /**
     * Checks if either the daemon or GUI is being run through builds made during development
     *
     * @param daemonVersion Daemon version
     * @param guiVersion GUI version
     */
    private runningDevBuilds(daemonVersion: string, guiVersion: string) {
        return daemonVersion.includes('.dev') || guiVersion.includes('.dev');
    }

}
