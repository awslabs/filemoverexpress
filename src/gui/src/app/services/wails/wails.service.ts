import { Injectable } from '@angular/core';
import {
    AppVersion,
    ExternalLink,
    FatalShutdown,
    FirstLaunchComplete,
    StartDaemon,
    SystemOpen,
    SystemShowItemInFolder,
} from '@wailsApp/App';
import { EventsEmit, EventsOn, Quit } from '@wailsRuntime/runtime';
import { EMPTY, from, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class WailsService {

    // region IPC Handlers

    /**
     * Starts the FME daemon process if it is not already running.
     */
    startDaemon(): Observable<void> {
        try {
            return from(StartDaemon());
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Emits a fatal-shutdown event to the frontend via the Wails event system.
     */
    fatalShutdown(): Observable<void> {
        try {
            return from(FatalShutdown());
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Opens a file at the specified path using the OS default application.
     */
    systemOpen(path: string): Observable<void> {
        try {
            return from(SystemOpen(path));
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Reveals a file in the OS file manager.
     */
    systemShowItemInFolder(path: string): Observable<void> {
        try {
            return from(SystemShowItemInFolder(path));
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Opens a URL in the OS default browser.
     */
    externalLink(url: string): Observable<void> {
        try {
            return from(ExternalLink(url));
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Returns the normalized application version string.
     * Returns empty string in development mode.
     */
    appVersion(): Observable<string> {
        try {
            return from(AppVersion());
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Checks whether this is the first launch of the application.
     * Returns true if the marker file already existed, false if this is the first launch.
     */
    firstLaunchComplete(): Observable<boolean> {
        try {
            return from(FirstLaunchComplete());
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    // endregion

    // region Wails Events
    send(eventName: string, data?: any) {
        try {
            EventsEmit(eventName, data);
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return;
        }
    }

    /**
     * Registers a listener for a Wails runtime event.
     * The callback is executed inside Angular's zone to trigger change detection.
     *
     * @returns A cleanup function that removes the listener when called.
     */
    onEvent(eventName: string, callback: (...data: unknown[]) => void) {
        try {
            EventsOn(eventName, callback);
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return;
        }
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
        try {
            Quit();
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
        }
    }

    // endregion
}
