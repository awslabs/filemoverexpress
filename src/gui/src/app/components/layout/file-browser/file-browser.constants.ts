import {
    ClickSelectionData,
    DragData,
    DragOverData,
    FileBrowserData,
    FileBrowserError,
    FileBrowserFilter,
    FileBrowserObject,
    FileBrowserObjectType,
    FileBrowserState,
} from './file-browser.interfaces';

export const AUTO_REFRESH_INTERVAL_MSECS = 8000;
export const MIN_AUTO_REFRESH_INTERVAL_MSECS = 3000;

export const COLUMNS: string[] = [
    'name',
    'size',
    'dateModified',
];

export const EMPTY_DRAG_DATA: DragData = {
    numDraggedObjects: 0,
    dragSourceObject: null,
};

export const EMPTY_DRAGOVER_DATA: DragOverData = {
    overTable: false,
    overTableCounter: 0,
    overRow: null,
    overRowCounter: 0,
    overPreviousDirectory: false,
    overPreviousDirectoryCounter: 0,
};

export const PREVIOUS_FOLDER_NAME = '..';

export const PREVIOUS_FOLDER_OBJECT: FileBrowserObject = {
    name: PREVIOUS_FOLDER_NAME,
    size: null,
    dateModified: null,
    type: FileBrowserObjectType.FOLDER,
    isFavorite: false,
    isHotFolder: false,
};

export const EMPTY_FILTER_DATA: FileBrowserFilter = {
    name: null,
};

export const DRAG_EVENT_DATA_SOURCE_CONTAINER = 'source-container';

export const FILE_BROWSER_INITIAL_DATA: FileBrowserData = {
    state: FileBrowserState.LOADED,
    error: null,
    list: [],
};

export const fileBrowserObjectIcon = {
    FILE: 'text_snippet',
    FOLDER: 'folder',
    PREVIOUS_DIRECTORY: 'drive_file_move_rtl',
    UNKNOWN: 'note',
};

export const FILE_BROWSER_GENERIC_ERROR: FileBrowserError = {
    title: 'File Browser Error',
    message: 'An error occurred. Verify that you can access the file system and try refreshing.',
};

export const EMPTY_CLICK_SELECTION_DATA: ClickSelectionData = {
    anchor: {
        index: -1,
        object: null,
    },
    focus: {
        index: -1,
        object: null,
    },
};


