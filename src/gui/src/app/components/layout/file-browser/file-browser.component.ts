import { DatePipe, NgClass } from '@angular/common';
import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    inject,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/list';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
    MatCell,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatTable,
    MatTableDataSource,
} from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { TypeSafeMatCellDefDirective } from '@app/directives/type-safe-mat-cell-def.directive';
import { BasenamePipe } from '@app/pipes/basename.pipe';
import { FileBrowserIconPipe } from '@app/pipes/file-browser-icon.pipe';
import { FormatBytesPipe } from '@app/pipes/format-bytes.pipe';
import { TruncateStringPipe } from '@app/pipes/truncate-string.pipe';
import { dirname } from '@app/utils/utils';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { FileBrowserService } from '@services/file-browser/file-browser.service';
import { PreferencesService } from '@services/preferences/preferences.service';
import { interval, Subscription } from 'rxjs';
import {
    AUTO_REFRESH_INTERVAL_MSECS,
    COLUMNS,
    DRAG_EVENT_DATA_SOURCE_CONTAINER,
    EMPTY_CLICK_SELECTION_DATA,
    EMPTY_DRAG_DATA,
    EMPTY_DRAGOVER_DATA,
    EMPTY_FILTER_DATA,
    FILE_BROWSER_GENERIC_ERROR,
    FILE_BROWSER_INITIAL_DATA,
    MIN_AUTO_REFRESH_INTERVAL_MSECS,
    PREVIOUS_FOLDER_NAME,
    PREVIOUS_FOLDER_OBJECT,
} from './file-browser.constants';
import {
    ClickSelectionData,
    DomElementPosition,
    DragData,
    DragOverData,
    FileBrowserAutoRefreshData,
    FileBrowserContextMenu,
    FileBrowserContextMenuRow,
    FileBrowserContextMenuTrigger,
    FileBrowserData,
    FileBrowserDropResult,
    FileBrowserFilter,
    FileBrowserObject,
    FileBrowserObjectType,
    FileBrowserState,
    FileBrowserType,
} from './file-browser.interfaces';
import {
    browserFilterPredicate,
    buildBrowserFilterString,
    cleanPath,
    destinationPathToFileBrowserPath,
    getUppermostParentDirectory,
    sortFileBrowserRows,
} from './file-browser.utils';

@Component({
    selector: 'fme-file-browser',
    templateUrl: './file-browser.component.html',
    styleUrls: ['./file-browser.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatTable,
        MatSort,
        MatSortHeader,
        MatColumnDef,
        MatHeaderCell,
        MatHeaderCellDef,
        MatCell,
        TypeSafeMatCellDefDirective,
        MatIcon,
        FileBrowserIconPipe,
        BasenamePipe,
        TruncateStringPipe,
        MatTooltip,
        FormatBytesPipe,
        DatePipe,
        MatHeaderRow,
        MatHeaderRowDef,
        MatRow,
        MatRowDef,
        MatProgressBar,
        ButtonComponent,
        MatMenuTrigger,
        MatMenu,
        MatMenuContent,
        MatMenuItem,
        NgClass,
        MatDivider,
    ],
})
export class FileBrowserComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
    protected fileBrowser = inject(FileBrowserService);
    private preferences = inject(PreferencesService);
    // Cached copy of the "Show hidden files" preference. When false (default) the browser
    // hides dotfiles; kept in sync via the preferences.onUpdate subscription below.
    private showHiddenFiles = false;

    @Input() fileBrowserType: FileBrowserType = 'unknown';
    @Input() fileBrowserID = '';
    @Input() allowExternalDragOver = false;
    @Input() isRoot = false;
    @Input() currentDirectory = '';
    @Input() fileBrowserData: FileBrowserData = {...FILE_BROWSER_INITIAL_DATA};
    @Input() filter: FileBrowserFilter = {...EMPTY_FILTER_DATA};
    @Input() contextMenuData: FileBrowserContextMenuRow[] = [];
    @Output() fileBrowserDrop = new EventEmitter<FileBrowserDropResult>();
    @Output() fileBrowserNavigate = new EventEmitter<string>();
    @Output() fileBrowserAutoRefresh = new EventEmitter<string>();
    @Output() fileBrowserHasChanges = new EventEmitter<boolean>();
    @ViewChild(MatSort) sort!: MatSort;
    @ViewChild('dragPreviewContainer') dragPreviewContainer!: ElementRef;
    @ViewChild(MatMenuTrigger) contextMenuTrigger!: MatMenuTrigger;
    datasource: MatTableDataSource<FileBrowserObject> = new MatTableDataSource<FileBrowserObject>([]);
    renderedDataSource: FileBrowserObject[] = [];
    selectedObjects: Map<string, FileBrowserObject> = new Map<string, FileBrowserObject>();
    clickSelectionData: ClickSelectionData = {...EMPTY_CLICK_SELECTION_DATA};
    contextMenuToRender: FileBrowserContextMenu = {
        triggerType: null,
        triggerObject: null,
        rows: [],
    };
    contextMenuPosition: DomElementPosition = {
        x: '0px',
        y: '0px',
    };
    dragging = false;
    dragData: DragData = {...EMPTY_DRAG_DATA};
    dragOverData: DragOverData = {...EMPTY_DRAGOVER_DATA};
    subscriptions: Subscription[] = [];
    autoRefreshData: FileBrowserAutoRefreshData = {
        lastRefreshTime: null,
        hasPendingChanges: false,
        delayRefresh: false,
    };
    protected readonly FileBrowserState = FileBrowserState;
    protected readonly FILE_BROWSER_GENERIC_ERROR = FILE_BROWSER_GENERIC_ERROR;
    protected readonly COLUMNS = COLUMNS;
    protected readonly FileBrowserObjectType = FileBrowserObjectType;
    readonly rgxGlacier = new RegExp(/glacier|snow|deep[\s|_]*archive/);

    constructor() {
        this.showHiddenFiles = this.preferences.showHiddenFiles;
        // Re-filter the listing when "Show hidden files" is toggled in Settings. Only act
        // on an actual change so unrelated preference updates don't reset the table.
        this.subscriptions.push(this.preferences.onUpdate.subscribe(() => {
            if (this.showHiddenFiles !== this.preferences.showHiddenFiles) {
                this.showHiddenFiles = this.preferences.showHiddenFiles;
                this.datasource.data = this.getFileBrowserList();
            }
        }));
        // check if the auto refresh request is relevant and update hasPendingChanges if so
        this.subscriptions.push(this.fileBrowser.autoRefreshRequests.subscribe({
            next: (refreshData) => {
                if (!this.autoRefreshData.hasPendingChanges) {
                    if (this.fileBrowserID && this.fileBrowserID === refreshData.fileBrowserID) {
                        if (this.shouldRefresh(this.currentDirectory, refreshData.destination)) {
                            this.autoRefreshData.hasPendingChanges = true;
                        }
                    }
                }
            },
        }));
        // attempts to auto refresh the file browser every AUTO_REFRESH_INTERVAL_MSECS milliseconds
        this.subscriptions.push(interval(AUTO_REFRESH_INTERVAL_MSECS).subscribe({
            next: () => {
                if (this.autoRefreshData.hasPendingChanges) {
                    const now = Date.now();
                    if (!this.autoRefreshData.lastRefreshTime || now - this.autoRefreshData.lastRefreshTime.getTime() > MIN_AUTO_REFRESH_INTERVAL_MSECS) {
                        if (this.selectedObjects.size || this.filter.name) {
                            // there are selections or a filter value
                            this.autoRefreshData.delayRefresh = true;
                            this.fileBrowserHasChanges.emit(true);
                            return;
                        }
                        this.fileBrowserAutoRefresh.emit(this.currentDirectory);
                    }
                }
            },
        }));
    }

    /**
     * Returns whether a file with the given taskDestination being updated should trigger an auto-refresh in the given
     * currentDirectory.
     *
     * @param {string} currentDirectory - Current directory of the file browser
     * @param {string} taskDestination - Path of the file that has been updated
     * @returns {boolean} Whether we should auto-refresh
     */
    private shouldRefresh(currentDirectory: string, taskDestination: string): boolean {
        // clean paths
        const destination = cleanPath(destinationPathToFileBrowserPath(taskDestination, this.fileBrowserType));
        const fileBrowserDirectory = cleanPath(currentDirectory);
        // check if it's the same path
        if (destination === fileBrowserDirectory) {
            // means destination is a file in the fileBrowserDirectory's parent with the same name as the fileBrowserDirectory
            return false;
        }
        // compare paths
        if (destination.startsWith(fileBrowserDirectory)) {
            const childPath = destination.substring(fileBrowserDirectory.length);
            const childUppermostParentDirectory = getUppermostParentDirectory(childPath);
            if (childUppermostParentDirectory) {
                const directoryToFind = [this.currentDirectory, childUppermostParentDirectory].join('/');
                const directoryIndex = this.fileBrowserData.list.findIndex(
                    (fileBrowserObject) => {
                        return fileBrowserObject.name === directoryToFind;
                    },
                );
                return directoryIndex === -1;
            } else {
                return true;
            }
        }
        return false;
    }

    /**
     * Set file browser data and filter
     */
    ngOnInit() {
        const fileBrowserList = this.getFileBrowserList();
        this.datasource = new MatTableDataSource<FileBrowserObject>(fileBrowserList);
        this.setFileBrowserError();
        // set initial click selection data if datasource is non-empty
        if (fileBrowserList.length) {
            this.clickSelectionData = {
                anchor: {
                    index: 0,
                    object: fileBrowserList[0],
                },
                focus: {
                    index: 0,
                    object: fileBrowserList[0],
                },
            };
        }
        // subscribe to the data list that is actually rendered after filters and sorting are applied
        this.subscriptions.push(this.datasource.connect().subscribe((renderedDataSource) => {
            // find new indices for clickSelectionData objects if sort or filter changed them
            if (!renderedDataSource.length) {
                this.clickSelectionData = {...EMPTY_CLICK_SELECTION_DATA};
            } else {
                if (this.clickSelectionData.anchor.object && this.clickSelectionData.focus.object) {
                    let newAnchorIndex = renderedDataSource.indexOf(this.clickSelectionData.anchor.object);
                    let newFocusIndex = renderedDataSource.indexOf(this.clickSelectionData.focus.object);
                    newAnchorIndex = Math.max(0, newAnchorIndex);
                    newFocusIndex = Math.max(0, newFocusIndex);
                    this.clickSelectionData = {
                        anchor: {
                            index: newAnchorIndex,
                            object: renderedDataSource[newAnchorIndex],
                        },
                        focus: {
                            index: newFocusIndex,
                            object: renderedDataSource[newFocusIndex],
                        },
                    };
                } else {
                    this.clickSelectionData = {
                        anchor: {
                            index: 0,
                            object: renderedDataSource[0],
                        },
                        focus: {
                            index: 0,
                            object: renderedDataSource[0],
                        },
                    };
                }
            }
            // update the renderedDataSource variable
            this.renderedDataSource = renderedDataSource;
        }));
        this.datasource.filterPredicate = browserFilterPredicate;
    }

    /**
     * Set file browser sorting algorithm
     */
    ngAfterViewInit() {
        this.datasource.sort = this.sort;
        this.datasource.sortData = sortFileBrowserRows;
    }

    /**
     * Update file browser data and filter on input changes
     */
    ngOnChanges(changes: SimpleChanges) {
        if (!this.filter.name) {
            if (!changes['fileBrowserData']) {
                // list data did not change, only filter changed
                if (this.autoRefreshData.delayRefresh) {
                    const now = Date.now();
                    if (!this.autoRefreshData.lastRefreshTime || now - this.autoRefreshData.lastRefreshTime.getTime() > MIN_AUTO_REFRESH_INTERVAL_MSECS) {
                        this.fileBrowserAutoRefresh.emit(this.currentDirectory);
                    }
                }
            } else {
                this.autoRefreshData = {
                    lastRefreshTime: new Date(),
                    hasPendingChanges: false,
                    delayRefresh: false,
                };
                this.fileBrowserHasChanges.emit(false);
            }
        }

        this.datasource.data = this.getFileBrowserList();
        this.setFileBrowserError();
        this.datasource.filter = buildBrowserFilterString(this.filter);
        this.resetClickSelectionData();
    }

    /**
     * Unsubscribe from all subscriptions
     */
    ngOnDestroy() {
        this.subscriptions.map((subscription) => subscription.unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Checks if a file browser row is selected
     * @param row
     */
    isSelected(row: FileBrowserObject) {
        return this.selectedObjects.has(row.name);
    }

    /**
     * The current multi-selection as an array (empty when nothing is selected).
     * Used by parent browsers to act on all selected rows (e.g. multi-delete).
     */
    getSelectedObjects(): FileBrowserObject[] {
        return Array.from(this.selectedObjects.values());
    }

    /**
     * Drop-target id for a folder row. Marking folder rows with a decodable id (+ the
     * data-file-drop-target attribute in the template) lets a native OS file drop report
     * WHICH folder it landed on, so external drops can target a subfolder instead of always
     * the current directory. Non-folders and the parent-directory row get null (their drop
     * resolves to the table = current directory).
     */
    dropTargetId(row: FileBrowserObject): string | null {
        if (row.type !== FileBrowserObjectType.FOLDER || this.isPreviousDirectoryRow(row)) {
            return null;
        }
        return `fbdt:${this.fileBrowserID}:${encodeURIComponent(row.name)}`;
    }

    /**
     * Checks if a row is the navigator to the parent directory
     * @param row
     */
    isPreviousDirectoryRow(row: FileBrowserObject) {
        return row.name === PREVIOUS_FOLDER_NAME && row.type === FileBrowserObjectType.FOLDER;
    }

    isDraggable(row: FileBrowserObject) {
        if (row.storageClass?.toLowerCase().match(this.rgxGlacier)) {
            return true;
        }
        return row.name === PREVIOUS_FOLDER_NAME && row.type === FileBrowserObjectType.FOLDER;
    }

    /**
     * Handles a right click on a file browser row to open the right click context menu.
     * @param event Right click MouseEvent
     * @param row Row that was right-clicked on
     */
    rightClickFileBrowserRow(event: MouseEvent, row: FileBrowserObject) {
        event.preventDefault();

        this.contextMenuToRender.rows = [];
        let rowType: FileBrowserContextMenuTrigger = 'file';
        if (row.type === FileBrowserObjectType.FOLDER) {
            rowType = this.isPreviousDirectoryRow(row) ? 'previousDirectory' : 'folder';
        }

        for (const menuRow of this.contextMenuData) {
            if (menuRow.triggers.has(rowType)) {
                const condition = menuRow.triggers.get(rowType);
                if (condition !== undefined && condition !== null && !condition(row)) {
                    continue;
                }
                this.contextMenuToRender.rows.push(menuRow);
            }
        }
        if (!this.contextMenuToRender.rows.length) {
            // don't do anything if there are no context menu rows to show
            return;
        }

        this.contextMenuToRender.triggerObject = row;
        this.contextMenuToRender.triggerType = rowType;

        this.contextMenuPosition.x = event.clientX + 'px';
        this.contextMenuPosition.y = event.clientY + 'px';
        this.contextMenuTrigger.openMenu();
    }

    /**
     * Handles a click event on a row in the file browser. Considers if COMMAND, CTRL, and/or SHIFT are pressed.
     * Ignores the click if the row represents 'cd ..'
     * @param event MouseEvent
     * @param row Row that was clicked on
     */
    clickFileBrowserRow(event: MouseEvent, row: FileBrowserObject) {
        if (this.isDraggable(row)) {
            return;
        }
        // order of precedence matters: CMD > SHIFT (matches Mac behavior)
        switch (true) {
            case (event.ctrlKey): // for windows
            case (event.metaKey): // for mac
                this.handleCmdClick(row);
                return;
            case (event.shiftKey):
                this.handleShiftClick(row);
                return;
        }
        // handle clicking without CMD/SHIFT
        const rowIndex = this.renderedDataSource.indexOf(row);
        // set the anchor & focus to click location so that if next click is SHIFT then selection range will start/end here
        this.clickSelectionData = {
            anchor: {
                index: rowIndex,
                object: row,
            },
            focus: {
                index: rowIndex,
                object: row,
            },
        };
        this.selectedObjects = new Map<string, FileBrowserObject>([
            [
                row.name, row,
            ],
        ]);
    }

    /**
     * Handles CTRL or CMD-clicking on a file browser row
     * @param row Row that was CMD-clicked on
     * @private
     */
    private handleCmdClick(row: FileBrowserObject) {
        const rowIndex = this.renderedDataSource.indexOf(row);
        if (this.selectedObjects.has(row.name)) {
            // de-select if already selected
            this.selectedObjects.delete(row.name);
            // move anchor and focus to beginning if no other item selected
            if (!this.selectedObjects.size) {
                this.resetClickSelectionData();
            }
            // need to move anchor and focus to another selected item if there are selections
            // so that if next click is SHIFT then selection range will start/end there
            for (let i = rowIndex + 1; i < this.renderedDataSource.length; i++) {
                if (this.selectedObjects.has(this.renderedDataSource[i].name)) {
                    this.clickSelectionData = {
                        anchor: {
                            index: i,
                            object: this.renderedDataSource[i],
                        },
                        focus: {
                            index: i,
                            object: this.renderedDataSource[i],
                        },
                    };
                    return;
                }
            }
            for (let i = rowIndex - 1; i > -1; i--) {
                if (this.selectedObjects.has(this.renderedDataSource[i].name)) {
                    this.clickSelectionData = {
                        anchor: {
                            index: i,
                            object: this.renderedDataSource[i],
                        },
                        focus: {
                            index: i,
                            object: this.renderedDataSource[i],
                        },
                    };
                    return;
                }
            }
        } else {
            // if not selected already, add selection and move anchor and focus here
            // so that if next click is SHIFT then selection range will start/end here
            this.clickSelectionData = {
                anchor: {
                    index: rowIndex,
                    object: this.renderedDataSource[rowIndex],
                },
                focus: {
                    index: rowIndex,
                    object: this.renderedDataSource[rowIndex],
                },
            };
            if (!this.isDraggable(row)) {
                this.selectedObjects.set(row.name, row);
            }
        }
    }

    /**
     * Handles SHIFT-clicking on a file browser row
     * @param row Row that was SHIFT-clicked on
     * @private
     */
    private handleShiftClick(row: FileBrowserObject) {
        // de-select items between anchor and focus (inclusive)
        let start = Math.min(this.clickSelectionData.anchor.index, this.clickSelectionData.focus.index);
        let end = Math.max(this.clickSelectionData.anchor.index, this.clickSelectionData.focus.index);
        const toRemoveFromSelection = this.renderedDataSource.slice(start, end + 1);
        for (const toRemove of toRemoveFromSelection) {
            this.selectedObjects.delete(toRemove.name);
        }
        // update focus to where clicked
        this.clickSelectionData.focus = {
            index: this.renderedDataSource.indexOf(row),
            object: row,
        };
        // select items between anchor and new focus (inclusive)
        start = Math.min(this.clickSelectionData.anchor.index, this.clickSelectionData.focus.index);
        end = Math.max(this.clickSelectionData.anchor.index, this.clickSelectionData.focus.index);
        const toAddToSelection = this.renderedDataSource.slice(start, end + 1);
        for (const toAdd of toAddToSelection) {
            if (!this.isDraggable(toAdd)) {
                this.selectedObjects.set(toAdd.name, toAdd);
            }
        }
    }

    /**
     * Handles a double click event on a row in the file browser and emits a directory to navigate to
     * @param row Row that was double-clicked on
     */
    doubleClickRow(row: FileBrowserObject) {
        if (this.isPreviousDirectoryRow(row)) {
            this.fileBrowserNavigate.emit(dirname(this.currentDirectory));
        } else if (row.type === FileBrowserObjectType.FOLDER) {
            this.fileBrowserNavigate.emit(row.name);
        }
    }

    /**
     * Clears the selection list when the empty space in a file browser table is clicked
     */
    clickEmptySpace() {
        this.resetClickSelectionData();
    }

    rightClickEmptySpace(event: MouseEvent) {
        event.preventDefault();
        this.openEmptySpaceMenu(event.clientX, event.clientY);
    }

    /**
     * Opens the panel-level (empty-space) context menu at the given viewport coordinates.
     * Shared by right-click-on-empty-space and the panel header "..." (overflow) button so
     * both surface the exact same menu, built from one definition — they can never drift.
     *
     * @param {number} x - Viewport x coordinate to anchor the menu at
     * @param {number} y - Viewport y coordinate to anchor the menu at
     */
    openEmptySpaceMenu(x: number, y: number) {
        this.contextMenuToRender.rows = [];

        for (const menuRow of this.contextMenuData) {
            if (menuRow.triggers.has('emptySpace')) {
                this.contextMenuToRender.rows.push(menuRow);
            }
        }
        if (!this.contextMenuToRender.rows.length) {
            // don't do anything if there are no context menu rows to show
            return;
        }

        this.contextMenuToRender.triggerObject = null;
        this.contextMenuToRender.triggerType = 'emptySpace';

        this.contextMenuPosition.x = x + 'px';
        this.contextMenuPosition.y = y + 'px';
        this.contextMenuTrigger.openMenu();
    }

    /**
     * Starts a file/folder drag and sets the drag data in the FileBrowserService. Sets the drag preview that follows the
     * cursor on drag.
     * @param event DragEvent
     * @param sourceRow FileBrowserObject that the drag started from
     */
    onDragStart(event: DragEvent, sourceRow: FileBrowserObject) {
        this.clearDragState();
        this.dragData.dragSourceObject = sourceRow;

        if (!event.dataTransfer) {
            console.warn('onDragStart called without dataTransfer object');
            return;
        }

        if (this.isSelected(sourceRow)) {
            this.fileBrowser.draggedObjects = Array.from(this.selectedObjects.values());
            this.dragData.numDraggedObjects = this.selectedObjects.size;
        } else {
            this.fileBrowser.draggedObjects = [sourceRow];
            this.dragData.numDraggedObjects = 1;
        }
        this.fileBrowser.dragOriginObject = sourceRow;

        this.fileBrowser.dragOriginID = this.fileBrowserID;
        event.dataTransfer.setData(DRAG_EVENT_DATA_SOURCE_CONTAINER, this.fileBrowserID);
        this.dragging = true;

        const dragPreviewElement = this.dragPreviewContainer.nativeElement as HTMLElement;
        if (dragPreviewElement) {
            event.dataTransfer.setDragImage(dragPreviewElement, 0, 0);
        }
    }

    /**
     * Handles setting the drag over data when DragEnter is fired on the file browser table
     */
    onDragEnterTable() {
        if (!this.allowExternalDragOver && !this.fileBrowser.dragOriginID) {
            return;
        }
        if (this.fileBrowserData.state === FileBrowserState.LOADED && this.fileBrowser.dragOriginID !== this.fileBrowserID) {
            this.dragOverData.overTable = true;
            this.dragOverData.overTableCounter++;
        }
    }

    /**
     * Handles setting the drag over data when DragLeave is fired on the file browser table
     */
    onDragLeaveTable() {
        if (!this.allowExternalDragOver && !this.fileBrowser.dragOriginID) {
            return;
        }
        if (this.fileBrowserData.state === FileBrowserState.LOADED && this.fileBrowser.dragOriginID !== this.fileBrowserID) {
            this.dragOverData.overTableCounter--;
            if (this.dragOverData.overTableCounter === 0) {
                this.dragOverData.overTable = false;
            }
        }
    }

    /**
     * Handles setting the drag over data when DragEnter is fired on a file browser row
     */
    onDragEnterRow(row: FileBrowserObject) {
        if (!this.allowExternalDragOver && !this.fileBrowser.dragOriginID) {
            return;
        }
        if (this.fileBrowser.dragOriginID !== this.fileBrowserID) {
            if (this.isPreviousDirectoryRow(row)) {
                this.dragOverData.overPreviousDirectory = true;
                this.dragOverData.overPreviousDirectoryCounter++;
            } else if (row.type === FileBrowserObjectType.FOLDER) {
                this.dragOverData.overRow = row;
                this.dragOverData.overRowCounter++;
            }
        }
    }

    /**
     * Handles setting the drag over data when DragLeave is fired on a file browser row
     */
    onDragLeaveRow(row: FileBrowserObject) {
        if (!this.allowExternalDragOver && !this.fileBrowser.dragOriginID) {
            return;
        }
        if (this.fileBrowser.dragOriginID !== this.fileBrowserID) {
            if (this.isPreviousDirectoryRow(row)) {
                this.dragOverData.overPreviousDirectoryCounter--;
                if (this.dragOverData.overPreviousDirectoryCounter === 0) {
                    this.dragOverData.overPreviousDirectory = false;
                }
            } else if (row.type === FileBrowserObjectType.FOLDER) {
                this.dragOverData.overRowCounter--;
                if (this.dragOverData.overRowCounter === 0) {
                    this.dragOverData.overRow = null;
                }
            }
        }
    }

    /**
     * Allows element to be dropped over a table row by preventing default behavior
     * @param event DragEvent
     * @param row FileBrowserObject that is dropped over
     */
    onDragOverRow(event: DragEvent, row: FileBrowserObject) {
        if (!this.isPreviousDirectoryRow(row) && (this.fileBrowser.dragOriginID !== this.fileBrowserID)) {
            event.preventDefault();
        }
    }

    /**
     * Allows element to be dropped over the empty space in a table container by preventing default behavior
     * @param event DragEvent
     */
    onDragOverTable(event: DragEvent) {
        if (this.fileBrowser.dragOriginID !== this.fileBrowserID && this.fileBrowserData.state === FileBrowserState.LOADED) {
            event.preventDefault();
        }
    }

    /**
     * Handles a drag that ends on a non-valid drop zone by clearing the drag state
     */
    onDragEnd() {
        this.clearDragState();
    }

    /**
     * Handles a drop on a file browser row item and sets the destination path to the row's path in the
     * FileBrowserDropResult that is emitted.
     * @param event
     * @param targetRow
     */
    onDropRow(event: DragEvent, targetRow: FileBrowserObject) {
        // event.preventDefault();
        // event.stopPropagation();
        if (this.isPreviousDirectoryRow(targetRow) || this.fileBrowserData.state !== FileBrowserState.LOADED) {
            return;
        }
        let destinationPath = targetRow.name;
        if (targetRow.type !== FileBrowserObjectType.FOLDER) {
            destinationPath = this.currentDirectory;
        }
        this.emitDropResult(event, destinationPath);
    }

    /**
     * Handles a drop event that happens on space on the table considered to be dropping in the current directory.
     * and sets the destination path to the current directory in the FileBrowserDropResult that is emitted.
     * @param event DragEvent
     */
    onDropTable(event: DragEvent) {
        // event.preventDefault();
        // event.stopPropagation();
        if (this.fileBrowserData.state === FileBrowserState.LOADED) {
            this.emitDropResult(event, this.currentDirectory);
        }
    }

    /**
     * Emits a FileBrowserDropResult containing the list of sources and the destination to transfer to.
     * @param event DragEvent
     * @param destinationPath Destination path to transfer to
     * @private
     */
    private emitDropResult(event: DragEvent, destinationPath: string) {
        this.dragging = false;
        if (!event.dataTransfer) {
            return;
        }

        const sourceContainer = event.dataTransfer.getData(DRAG_EVENT_DATA_SOURCE_CONTAINER);
        if (sourceContainer !== this.fileBrowserID) {
            const externalDropFiles = event.dataTransfer.files;
            const dropResult: FileBrowserDropResult = {
                fromExternalSource: false,
                sourceContainerID: null,
                sources: [],
                destinationContainerID: this.fileBrowserID,
                destination: destinationPath,
                dragOriginSourceName: '',
            };

            if (sourceContainer) {
                // drag source is within application
                dropResult.sourceContainerID = sourceContainer;
                dropResult.sources = this.fileBrowser.draggedObjects;
                dropResult.dragOriginSourceName = this.fileBrowser.dragOriginObject ? this.fileBrowser.dragOriginObject.name : '';
            } else {
                // drag source is outside of application
                if (externalDropFiles?.length) {
                    dropResult.fromExternalSource = true;
                    const sources: FileBrowserObject[] = [];

                    for (const externalDropItem of Array.from(event.dataTransfer.items)) {
                        const externalItem = externalDropItem.getAsFile();
                        // add the external item if it's non-null
                        if (externalItem) {
                            // get the object type
                            const externalEntry = externalDropItem.webkitGetAsEntry();
                            let objectType: FileBrowserObjectType = FileBrowserObjectType.UNKNOWN;
                            if (externalEntry) {
                                objectType = externalEntry.isFile ? FileBrowserObjectType.FILE : FileBrowserObjectType.FOLDER;
                            }

                            const name = externalItem.name;
                            const fo: FileBrowserObject = {
                                name: name,
                                size: BigInt(externalItem.size),
                                dateModified: new Date(externalItem.lastModified),
                                type: objectType,
                            };
                            sources.push(fo);
                            dropResult.sources.push(fo);
                        }
                    }

                    if (sources.length) {
                        dropResult.dragOriginSourceName = dropResult.sources[0].name;
                    }

                    dropResult.sources = sources;
                }
            }
            this.fileBrowserDrop.emit(dropResult);
        }
        this.clearDragState();
    }

    /**
     * Clears the component's and FileBrowserService's drag state to non-dragging.
     * @private
     */
    private clearDragState() {
        this.dragOverData = {...EMPTY_DRAGOVER_DATA};
        this.dragData = {...EMPTY_DRAG_DATA};
        this.fileBrowser.clearDragState();
        this.dragging = false;
    }

    /**
     * Gets the file browser table data based on the state and if the current directory is the root
     */
    private getFileBrowserList(): FileBrowserObject[] {
        if (this.isRoot || this.fileBrowserData.state !== FileBrowserState.LOADED) {
            return this.fileBrowserData.state === FileBrowserState.LOADED ? this.applyHiddenFilter([...this.fileBrowserData.list]) : [];
        } else {
            return [
                PREVIOUS_FOLDER_OBJECT, ...this.applyHiddenFilter(this.fileBrowserData.list),
            ];
        }
    }

    /**
     * Hides dotfiles (entries whose basename starts with '.') unless the user has enabled
     * "Show hidden files" in Settings > UI Preferences. The parent-directory ('..') row is
     * added separately by getFileBrowserList and is never passed through this filter.
     * @private
     */
    private applyHiddenFilter(list: FileBrowserObject[]): FileBrowserObject[] {
        return list.filter((obj) => {
            const basename = obj.name.split('/').filter(Boolean).pop() ?? '';
            // Drop degenerate entries with no display name — e.g. an S3 object/prefix
            // literally keyed "/". These can't be shown or navigated and otherwise render
            // as an invisible blank row, which also makes an otherwise-empty bucket fail to
            // show the empty-directory drop zone. Always filtered (not gated on hidden files).
            if (!basename) {
                return false;
            }
            // Dotfiles are hidden unless the user enabled "Show hidden files".
            if (!this.showHiddenFiles && basename.startsWith('.')) {
                return false;
            }
            return true;
        });
    }

    /**
     * Sets the file browser error to null or an error if an error exists
     */
    private setFileBrowserError() {
        if (this.fileBrowserData.state !== FileBrowserState.ERROR) {
            this.fileBrowserData.error = null;
        } else if (!this.fileBrowserData.error) {
            this.fileBrowserData.error = {...FILE_BROWSER_GENERIC_ERROR};
        }
    }

    /**
     * Removes all selections and resets the anchor and focus
     * @private
     */
    private resetClickSelectionData() {
        if (this.selectedObjects.size && this.autoRefreshData.delayRefresh) {
            const now = Date.now();
            if (!this.autoRefreshData.lastRefreshTime || now - this.autoRefreshData.lastRefreshTime.getTime() > MIN_AUTO_REFRESH_INTERVAL_MSECS) {
                if (!this.filter.name) {
                    this.fileBrowserAutoRefresh.emit(this.currentDirectory);
                }
            }
        }

        this.selectedObjects.clear();
        if (this.renderedDataSource.length) {
            this.clickSelectionData = {
                anchor: {
                    index: 0,
                    object: this.renderedDataSource[0],
                },
                focus: {
                    index: 0,
                    object: this.renderedDataSource[0],
                },
            };
        } else {
            this.clickSelectionData = {...EMPTY_CLICK_SELECTION_DATA};
        }
    }
}
