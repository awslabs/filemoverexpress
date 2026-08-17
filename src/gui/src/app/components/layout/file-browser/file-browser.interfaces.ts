export type FileBrowserType = 'darwin' | 'linux' | 'windows' | 's3' | 'unknown';
export type FileBrowserObjectValue = string | bigint | Date | null;
export type FileBrowserContextMenuTrigger = 'folder' | 'file' | 'previousDirectory' | 'emptySpace';
export type IconColor = 'inherit' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'white' | 'gray';

export enum FileBrowserObjectType {
    FILE,
    FOLDER,
    UNKNOWN
}

export interface FileBrowserObject {
    name: string;
    size: bigint | null;
    dateModified: Date | null;
    type: FileBrowserObjectType;
    isFavorite?: boolean;
    isHotFolder?: boolean;
    storageClass?: string;
    isStartingPath?: boolean;
}

export interface FileBrowserDropResult {
    fromExternalSource: boolean;
    sourceContainerID: string | null;
    sources: FileBrowserObject[];
    destinationContainerID: string;
    destination: string;
    dragOriginSourceName: string;
}

export interface DragData {
    numDraggedObjects: number;
    dragSourceObject: FileBrowserObject | null;
}

export interface DragOverData {
    overTable: boolean,
    overTableCounter: number,
    overRow: FileBrowserObject | null,
    overRowCounter: number,
    overPreviousDirectory: boolean,
    overPreviousDirectoryCounter: number,
}

export interface FileBrowserFilter {
    name: string | null;
}

export enum FileBrowserState {
    ERROR,
    LOADED,
    LOADING
}

export interface FileBrowserData {
    state: FileBrowserState;
    error: FileBrowserError | null;
    list: FileBrowserObject[];
}

export interface FileBrowserError {
    title?: string;
    message: string;
    // 'error' renders a red warning icon + red title (real failures); undefined/'info'
    // stays neutral grey (benign empty states like not-connected, sign-in-required).
    severity?: 'error' | 'info';
    actionButtons?: FileBrowserErrorActionButton[];
}

export interface FileBrowserErrorActionButton {
    buttonIcon?: string;
    buttonText: string;
    buttonClickHandler: () => void;
}

// Stores anchor and focus indices to determine what range a SHIFT-click should select and un-select
export interface ClickSelectionData {
    // last click location
    anchor: {
        index: number,
        object: FileBrowserObject | null,
    },
    // will only be different from anchor if the last click was a SHIFT-click
    focus: {
        index: number,
        object: FileBrowserObject | null,
    },
}

export interface DomElementPosition {
    x: string,
    y: string,
}

export interface FileBrowserAutoRefreshData {
    lastRefreshTime: Date | null;
    hasPendingChanges: boolean;
    delayRefresh: boolean;
}

export interface FileBrowserContextMenu {
    triggerType: FileBrowserContextMenuTrigger | null;
    triggerObject: FileBrowserObject | null;
    rows: FileBrowserContextMenuRow[];
}

export interface FileBrowserContextMenuRow {
    label: string;
    icon: string | null;
    iconColor?: IconColor;
    triggers: Map<FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null>;
    action: FileBrowserContextMenuClickHandler;
    hasTrailingSeparator?: boolean;
    // Optional uppercase section label rendered above this item (mockup grouped menus).
    sectionHeader?: string;
}

export type FileBrowserContextMenuClickHandler = (triggerType: FileBrowserContextMenuTrigger | null, triggerObject: FileBrowserObject | null, currentDirectory: string) => void;

export type FileBrowserContextMenuTriggerCondition = (triggerObject: FileBrowserObject) => boolean;
