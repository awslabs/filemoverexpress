import { Injectable } from '@angular/core';
import { FileBrowserObject } from '@app/components/layout/file-browser/file-browser.interfaces';
import { FileBrowserRefreshData } from '@services/file-browser/file-browser.interfaces';
import { Observable, Subject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class FileBrowserService {

    private readonly refreshFileBrowserID$: Subject<FileBrowserRefreshData> = new Subject<FileBrowserRefreshData>();
    private _draggedObjects: FileBrowserObject[] = [];
    private _dragOriginObject: FileBrowserObject | null = null;
    private _dragOriginID: string | null = null;

    /**
     * Emits the given file browser ID with the destination path that was updated so listening file browsers can
     * determine if they should auto-refresh
     *
     * @param {string} fileBrowserID - File browser ID string
     * @param {string} destination - Destination path string
     */
    sendAutoRefreshRequest(fileBrowserID: string, destination: string) {
        if (fileBrowserID && destination) {
            const refreshData: FileBrowserRefreshData = {
                fileBrowserID: fileBrowserID,
                destination: destination,
            };
            this.refreshFileBrowserID$.next(refreshData);
        }
    }

    /**
     * Get observable for file browser auto refresh requests
     */
    get autoRefreshRequests(): Observable<FileBrowserRefreshData> {
        return this.refreshFileBrowserID$ as Observable<FileBrowserRefreshData>;
    }

    /**
     * Clears the drag state to be non-dragging
     */
    clearDragState() {
        this._draggedObjects = [];
        this._dragOriginObject = null;
        this._dragOriginID = null;
    }

    /**
     * Gets the list of dragged objects
     */
    get draggedObjects(): FileBrowserObject[] {
        return this._draggedObjects;
    }

    /**
     * Sets the list of dragged objects
     */
    set draggedObjects(objects: FileBrowserObject[]) {
        this._draggedObjects = objects;
    }

    /**
     * Gets the object that the drag started from
     */
    get dragOriginObject(): FileBrowserObject | null {
        return this._dragOriginObject;
    }

    /**
     * Sets the object that the drag started from
     */
    set dragOriginObject(object: FileBrowserObject | null) {
        this._dragOriginObject = object;
    }

    /**
     * Gets the container ID that the current drag started from
     */
    get dragOriginID(): string | null {
        return this._dragOriginID;
    }

    /**
     * Sets the container ID that the current drag started from
     */
    set dragOriginID(ID: string | null) {
        this._dragOriginID = ID;
    }

}
