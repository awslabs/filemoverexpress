import { Injectable } from '@angular/core';
import {
    AppVersion,
    ExternalLink,
    FatalShutdown,
    FirstLaunchComplete,
    GenerateCsvReport,
    GenerateExcelReport,
    GenerateJsonReport,
    SaveFile,
    StartDaemon,
    SystemOpen,
    SystemShowItemInFolder,
    ValidateOIDCIssuer,
} from '@wailsApp/fmeapp';
import { ExportJobList } from '@wailsApp/models';
import { EMPTY, from, Observable } from 'rxjs';
import { Application, Clipboard, Events } from '@wailsio/runtime';

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
     * Prompts the user with a native "Save As" dialog seeded with the given default
     * filename and writes the base64-encoded data to the chosen path. Emits the saved
     * path, or an empty string if the user canceled the dialog.
     */
    saveFile(defaultFilename: string, base64Data: string): Observable<string> {
        try {
            // Note: this try/catch only guards a synchronous throw (e.g. the binding being
            // unavailable). A rejected promise from SaveFile surfaces as an Observable error
            // to the subscriber, not as an exception here.
            return from(SaveFile(defaultFilename, base64Data));
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

    /**
     * Generates a base64-encoded CSV report via the Go backend.
     */
    generateCsvReport(data: ExportJobList): Observable<string> {
        try {
            return from(GenerateCsvReport(data));
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Generates a base64-encoded JSON report via the Go backend.
     */
    generateJsonReport(data: ExportJobList): Observable<string> {
        try {
            return from(GenerateJsonReport(data));
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Generates a base64-encoded XLSX report via the Go backend.
     */
    generateExcelReport(data: ExportJobList): Observable<string> {
        try {
            return from(GenerateExcelReport(data));
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Validates an OIDC Issuer URL by fetching its .well-known/openid-configuration
     * endpoint from native Go code (bypasses CORS). Returns an empty string on success
     * or an error key ('invalidUrl', 'oidcUnreachable', 'oidcInvalidDoc') on failure.
     */
    validateOIDCIssuer(issuerUrl: string): Observable<string> {
        try {
            return from(ValidateOIDCIssuer(issuerUrl));
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    /**
     * Writes text to the OS clipboard via the Wails runtime. The webview's
     * navigator.clipboard is unavailable (non-secure context) and silently no-ops,
     * so clipboard copies must go through the native runtime binding instead.
     */
    setClipboardText(text: string): Observable<void> {
        try {
            return from(Clipboard.SetText(text));
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
            return EMPTY;
        }
    }

    // endregion

    // region Wails Events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send(eventName: string, data?: any) {
        try {
            Events.Emit(eventName, data).then();
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
    onEvent(eventName: string, callback: (event: Events.WailsEvent) => void) {
        try {
            Events.On(eventName, callback);
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
            Application.Quit().then();
        } catch (error) {
            console.debug(`Failed to call wails: ${error}`);
        }
    }

    // endregion
}
