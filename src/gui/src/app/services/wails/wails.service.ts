import { Injectable, NgZone } from '@angular/core';
import {
    AppVersion,
    ExternalLink,
    FatalShutdown,
    FirstLaunchComplete,
    StartDaemon,
    SystemOpen,
    SystemShowItemInFolder,
} from '@wailsApp/App';
import { EventsOn, Quit, Quit as AppQuit } from '@wailsRuntime/runtime';
import { from, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class WailsService {
    constructor(private _zone: NgZone) {
    }

    // region IPC Handlers

    /**
     * Starts the FME daemon process if it is not already running.
     */
    startDaemon(): Observable<void> {
        return from(StartDaemon());
    }

    /**
     * Emits a fatal-shutdown event to the frontend via the Wails event system.
     */
    fatalShutdown(): Observable<void> {
        return from(FatalShutdown());
    }

    /**
     * Opens a file at the specified path using the OS default application.
     */
    systemOpen(path: string): Observable<void> {
        return from(SystemOpen(path));
    }

    /**
     * Reveals a file in the OS file manager.
     */
    systemShowItemInFolder(path: string): Observable<void> {
        return from(SystemShowItemInFolder(path));
    }

    /**
     * Opens a URL in the OS default browser.
     */
    externalLink(url: string): Observable<void> {
        return from(ExternalLink(url));
    }

    /**
     * Returns the normalized application version string.
     * Returns empty string in development mode.
     */
    appVersion(): Observable<string> {
        return from(AppVersion());
    }

    /**
     * Checks whether this is the first launch of the application.
     * Returns true if the marker file already existed, false if this is the first launch.
     */
    firstLaunchComplete(): Observable<boolean> {
        return from(FirstLaunchComplete());
    }

    // endregion

    // region Wails Event Listeners

    /**
     * Registers a listener for a Wails runtime event.
     * The callback is executed inside Angular's zone to trigger change detection.
     *
     * @returns A cleanup function that removes the listener when called.
     */
    onEvent(eventName: string, callback: (...data: unknown[]) => void) {
        const wrappedCallback = (ev: { data: unknown }) => {
            this._zone.run(() => callback(ev.data));
        };
        EventsOn(eventName, wrappedCallback);
    }

    /**
     * Registers a listener for the fatal-shutdown event emitted by the backend.
     *
     * @returns A cleanup function that removes the listener when called.
     */
    onFatalShutdown(callback: () => void) {
        this.onEvent('fatal-shutdown', callback);
    }

    quit() {
        Quit();
    }
    // endregion
}
