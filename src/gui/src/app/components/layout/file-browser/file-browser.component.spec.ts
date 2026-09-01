import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileBrowserComponent } from './file-browser.component';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import {
    FileBrowserContextMenuRow,
    FileBrowserContextMenuTrigger,
    FileBrowserContextMenuTriggerCondition,
    FileBrowserObject,
    FileBrowserObjectType,
    FileBrowserState,
} from './file-browser.interfaces';
import { PREVIOUS_FOLDER_NAME } from './file-browser.constants';

/** Build a FileBrowserObject with sensible defaults for the given name/type. */
function makeObject(name: string, type: FileBrowserObjectType = FileBrowserObjectType.FILE): FileBrowserObject {
    return {
        name: name,
        size: 10n,
        dateModified: new Date('2024-01-01T00:00:00Z'),
        type: type,
    };
}

/** A minimal context-menu row usable across trigger types. */
function makeMenuRow(
    label: string,
    triggers: [FileBrowserContextMenuTrigger, FileBrowserContextMenuTriggerCondition | null][],
): FileBrowserContextMenuRow {
    return {
        label: label,
        icon: null,
        triggers: new Map(triggers),
        action: vi.fn(),
    };
}

describe('FileBrowserComponent', () => {
    let component: FileBrowserComponent;
    let fixture: ComponentFixture<FileBrowserComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatTableModule,
                MatIconModule,
                MatSnackBarModule,
                MatMenuModule,
            ],
        });
        fixture = TestBed.createComponent(FileBrowserComponent);
        component = fixture.componentInstance;
        component.fileBrowserID = 'test-browser';
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('isPreviousDirectoryRow', () => {
        it('identifies the parent-directory row', () => {
            const parent = makeObject(PREVIOUS_FOLDER_NAME, FileBrowserObjectType.FOLDER);
            expect(component.isPreviousDirectoryRow(parent)).toBe(true);
        });

        it('returns false for a normal folder', () => {
            expect(component.isPreviousDirectoryRow(makeObject('data', FileBrowserObjectType.FOLDER))).toBe(false);
        });

        it('returns false when name matches but type is a file', () => {
            expect(component.isPreviousDirectoryRow(makeObject(PREVIOUS_FOLDER_NAME, FileBrowserObjectType.FILE))).toBe(false);
        });
    });

    describe('dropTargetId', () => {
        it('encodes a folder row into a decodable drop-target id', () => {
            const folder = makeObject('sub folder', FileBrowserObjectType.FOLDER);
            expect(component.dropTargetId(folder)).toBe('fbdt:test-browser:sub%20folder');
        });

        it('returns null for a file row', () => {
            expect(component.dropTargetId(makeObject('file.txt'))).toBeNull();
        });

        it('returns null for the parent-directory row', () => {
            const parent = makeObject(PREVIOUS_FOLDER_NAME, FileBrowserObjectType.FOLDER);
            expect(component.dropTargetId(parent)).toBeNull();
        });
    });

    describe('isDraggable', () => {
        it('is true for a glacier-tier object', () => {
            const glacier = {...makeObject('archived.mov'), storageClass: 'GLACIER'};
            expect(component.isDraggable(glacier)).toBe(true);
        });

        it('is true for a deep archive object', () => {
            const deep = {...makeObject('cold.mov'), storageClass: 'DEEP_ARCHIVE'};
            expect(component.isDraggable(deep)).toBe(true);
        });

        it('is true for the parent-directory row', () => {
            expect(component.isDraggable(makeObject(PREVIOUS_FOLDER_NAME, FileBrowserObjectType.FOLDER))).toBe(true);
        });

        it('is false for a standard-tier file', () => {
            const standard = {...makeObject('active.mov'), storageClass: 'STANDARD'};
            expect(component.isDraggable(standard)).toBe(false);
        });
    });

    describe('selection', () => {
        it('selects a single row on a plain click', () => {
            const row = makeObject('a.txt');
            component.renderedDataSource = [row];
            component.clickFileBrowserRow(new MouseEvent('click'), row);
            expect(component.isSelected(row)).toBe(true);
            expect(component.getSelectedObjects()).toEqual([row]);
        });

        it('does not select a draggable (glacier) row on click', () => {
            const glacier = {...makeObject('archived.mov'), storageClass: 'GLACIER'};
            component.renderedDataSource = [glacier];
            component.clickFileBrowserRow(new MouseEvent('click'), glacier);
            expect(component.isSelected(glacier)).toBe(false);
        });

        it('toggles selection on ctrl-click', () => {
            const row = makeObject('a.txt');
            component.renderedDataSource = [row];
            const ctrlEvent = new MouseEvent('click', {ctrlKey: true});
            component.clickFileBrowserRow(ctrlEvent, row);
            expect(component.isSelected(row)).toBe(true);
            component.clickFileBrowserRow(ctrlEvent, row);
            expect(component.isSelected(row)).toBe(false);
        });

        it('selects a contiguous range on shift-click', () => {
            const rows = [makeObject('a'),
                makeObject('b'),
                makeObject('c')];
            component.renderedDataSource = rows;
            component.clickFileBrowserRow(new MouseEvent('click'), rows[0]);
            component.clickFileBrowserRow(new MouseEvent('click', {shiftKey: true}), rows[2]);
            expect(component.getSelectedObjects()).toEqual(rows);
        });
    });

    describe('doubleClickRow', () => {
        it('navigates into a folder', () => {
            const emit = vi.spyOn(component.fileBrowserNavigate, 'emit');
            component.doubleClickRow(makeObject('nested', FileBrowserObjectType.FOLDER));
            expect(emit).toHaveBeenCalledWith('nested');
        });

        it('navigates to the parent directory on the ".." row', () => {
            component.currentDirectory = '/a/b';
            const emit = vi.spyOn(component.fileBrowserNavigate, 'emit');
            component.doubleClickRow(makeObject(PREVIOUS_FOLDER_NAME, FileBrowserObjectType.FOLDER));
            expect(emit).toHaveBeenCalledWith('/a/');
        });

        it('does nothing when double-clicking a file', () => {
            const emit = vi.spyOn(component.fileBrowserNavigate, 'emit');
            component.doubleClickRow(makeObject('file.txt'));
            expect(emit).not.toHaveBeenCalled();
        });
    });

    describe('right-click context menu', () => {
        it('renders folder-triggered rows and records the trigger object/type', () => {
            component.contextMenuData = [makeMenuRow('New Folder', [['folder', null]])];
            component.contextMenuTrigger = {openMenu: vi.fn()} as never;
            const folder = makeObject('dir', FileBrowserObjectType.FOLDER);
            component.rightClickFileBrowserRow(new MouseEvent('contextmenu'), folder);
            expect(component.contextMenuToRender.rows.map((r) => r.label)).toEqual(['New Folder']);
            expect(component.contextMenuToRender.triggerType).toBe('folder');
            expect(component.contextMenuToRender.triggerObject).toBe(folder);
        });

        it('filters out rows whose trigger condition is false', () => {
            const openMenu = vi.fn();
            component.contextMenuData = [makeMenuRow('Delete', [['file', () => false]])];
            component.contextMenuTrigger = {openMenu} as never;
            component.rightClickFileBrowserRow(new MouseEvent('contextmenu'), makeObject('a.txt'));
            expect(component.contextMenuToRender.rows).toEqual([]);
            expect(openMenu).not.toHaveBeenCalled();
        });

        it('opens the empty-space menu with only emptySpace-triggered rows', () => {
            const openMenu = vi.fn();
            component.contextMenuData = [
                makeMenuRow('Refresh', [['emptySpace', null]]), makeMenuRow('Rename', [['file', null]]),
            ];
            component.contextMenuTrigger = {openMenu} as never;
            component.openEmptySpaceMenu(10, 20);
            expect(component.contextMenuToRender.rows.map((r) => r.label)).toEqual(['Refresh']);
            expect(component.contextMenuToRender.triggerType).toBe('emptySpace');
            expect(component.contextMenuPosition).toEqual({x: '10px', y: '20px'});
            expect(openMenu).toHaveBeenCalled();
        });
    });

    describe('hidden-file filtering (ngOnChanges)', () => {
        function setData(list: FileBrowserObject[]) {
            component.isRoot = true;
            component.fileBrowserData = {state: FileBrowserState.LOADED, error: null, list};
            component.filter = {name: null};
            component.ngOnChanges({fileBrowserData: {} as never});
        }

        it('hides dotfiles by default', () => {
            setData([makeObject('.hidden'), makeObject('visible.txt')]);
            expect(component.datasource.data.map((o) => o.name)).toEqual(['visible.txt']);
        });

        it('drops degenerate entries with no basename', () => {
            setData([makeObject('/'), makeObject('real.txt')]);
            expect(component.datasource.data.map((o) => o.name)).toEqual(['real.txt']);
        });
    });

    describe('drag lifecycle', () => {
        it('populates drag state for a single unselected row on drag start', () => {
            const row = makeObject('a.txt');
            const dataTransfer = {setData: vi.fn(), setDragImage: vi.fn()};
            component.dragPreviewContainer = {nativeElement: document.createElement('div')} as never;
            component.onDragStart({dataTransfer} as unknown as DragEvent, row);
            expect(component.dragData.numDraggedObjects).toBe(1);
            expect(component.dragging).toBe(true);
            expect(dataTransfer.setData).toHaveBeenCalledWith('source-container', 'test-browser');
        });

        it('clears drag state on drag end', () => {
            component.dragging = true;
            component.onDragEnd();
            expect(component.dragging).toBe(false);
            expect(component.dragData.numDraggedObjects).toBe(0);
        });
    });
});
