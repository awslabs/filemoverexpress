import { EventEmitter, inject, Injectable } from '@angular/core';
import { LocalStorageService } from '../local-storage/local-storage.service';
import { NotificationPosition, PreferenceDaemonClose, Preferences, PreferenceTransferExport } from './preferences.interfaces';
import { CACHE_KEY, defaultOptions } from './preferences.constants';

@Injectable({
    providedIn: 'root',
})
export class PreferencesService {
    private storage = inject(LocalStorageService);

    public onUpdate: EventEmitter<boolean>;
    private readonly preferences: Preferences;

    constructor() {
        this.onUpdate = new EventEmitter<boolean>();

        if (!this.storage.exists(CACHE_KEY)) {
            this.preferences = {...defaultOptions};
        } else {
            this.preferences = {
                ...defaultOptions,
                ...this.storage.getObject(CACHE_KEY) as Partial<Preferences>,
            };
        }
    }

    getAllPreferences(): Preferences {
        return this.preferences;
    }

    private save() {
        this.storage.set(CACHE_KEY, this.preferences);
        this.onUpdate.emit(true);
    }

    get notificationPosition(): NotificationPosition {
        return this.preferences.notificationPosition;
    }

    set notificationPosition(position: NotificationPosition) {
        this.preferences.notificationPosition = position;
        this.save();
    }

    get notificationHideDelay(): number {
        return this.preferences.notificationAutoHideDelay;
    }

    set notificationHideDelay(delay: number) {
        this.preferences.notificationAutoHideDelay = delay;
        this.save();
    }

    get transferExport(): PreferenceTransferExport {
        return this.preferences.transferExport;
    }

    set transferExport(value: PreferenceTransferExport) {
        this.preferences.transferExport = value;
        this.save();
    }

    get transferPageSize(): number {
        return this.preferences.transferPageSize;
    }

    set transferPageSize(value: number) {
        this.preferences.transferPageSize = value;
        this.save();
    }

    get daemonClose(): PreferenceDaemonClose {
        return this.preferences.daemonClose;
    }

    set daemonClose(value: PreferenceDaemonClose) {
        this.preferences.daemonClose = value;
        this.save();
    }

    get trayHeight(): number {
        return this.preferences.trayHeight;
    }

    set trayHeight(value: number) {
        this.preferences.trayHeight = value;
        this.save();
    }

    get showHiddenFiles(): boolean {
        return this.preferences.showHiddenFiles;
    }

    set showHiddenFiles(value: boolean) {
        this.preferences.showHiddenFiles = value;
        this.save();
    }

}
