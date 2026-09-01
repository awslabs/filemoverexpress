import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DaemonSelectorDropdownComponent } from './daemon-selector-dropdown.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { Bookmark } from '@services/bookmarks/bookmarks.classes';
import { DEFAULT_BOOKMARK_NAME } from '@services/bookmarks/bookmarks.constants';
import { ConnectionState } from '@state/models/connection-state-model';

function makeBookmark(name: string, favoritePaths: string[] = []): Bookmark {
    return new Bookmark({
        name,
        host: name === DEFAULT_BOOKMARK_NAME ? '127.0.0.1' : 'remote.example',
        port: 9999,
        encryption: false,
        pre_shared_key: '',
        favoritePaths,
        onConnectStartingPath: null,
    });
}

describe('DaemonSelectorDropdownComponent', () => {
    let component: DaemonSelectorDropdownComponent;
    let fixture: ComponentFixture<DaemonSelectorDropdownComponent>;

    let allBookmarks$: BehaviorSubject<Bookmark[]>;
    let current$: BehaviorSubject<Bookmark | null>;
    let connectionState$: BehaviorSubject<ConnectionState>;
    let bookmarks: Record<string, unknown>;
    let notifications: Record<string, ReturnType<typeof vi.fn>>;
    let dialogOpen: ReturnType<typeof vi.fn>;

    const local = makeBookmark(DEFAULT_BOOKMARK_NAME, ['/media/fav']);
    const remote = makeBookmark('Studio NAS');

    beforeEach(() => {
        allBookmarks$ = new BehaviorSubject<Bookmark[]>([local, remote]);
        current$ = new BehaviorSubject<Bookmark | null>(local);
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);

        bookmarks = {
            getAllBookmarks: allBookmarks$.asObservable(),
            current: current$.asObservable(),
            hasFavoritePath: vi.fn(() => false),
            addFavoritePath: vi.fn(() => ({message: 'added', level: 'success'})),
            deleteFavoritePath: vi.fn(() => ({message: 'removed', level: 'success'})),
            setSelection: vi.fn(),
            add: vi.fn(() => true),
            edit: vi.fn(),
            delete: vi.fn(() => null),
        };
        notifications = {success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), open: vi.fn()};
        dialogOpen = vi.fn(() => ({afterClosed: () => of(false), componentInstance: {favoritePathSaved: new Subject(), bookmarkSaved: new Subject()}}));

        const fmeClientStub = {connectionState: connectionState$.asObservable(), shutdown: vi.fn(() => of(1))};

        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
                MatMenuModule,
                MatIconModule,
                MatDialogModule,
                MatTooltipModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
                {provide: BookmarksService, useValue: bookmarks},
                {provide: FmeClientService, useValue: fmeClientStub},
                {provide: NotificationsService, useValue: notifications},
                {provide: MatDialog, useValue: {open: dialogOpen}},
            ],
        });
        fixture = TestBed.createComponent(DaemonSelectorDropdownComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('getSelectedDaemon', () => {
        it('returns the current bookmark name', () => {
            expect(component.getSelectedDaemon()).toBe(DEFAULT_BOOKMARK_NAME);
        });

        it('returns null when nothing is selected', () => {
            current$.next(null);
            expect(component.getSelectedDaemon()).toBeNull();
        });
    });

    describe('setDropdownItems', () => {
        it('groups local and remote daemons with an add-daemon row', () => {
            const ids = component.dropdownItems.map((i) => i.id);
            expect(ids).toContain('this-computer-label');
            expect(ids).toContain('remote-daemons-label');
            expect(ids).toContain('add-daemon-row');
            expect(ids).toContain(`daemon-name-header-row-${DEFAULT_BOOKMARK_NAME}`);
            expect(ids).toContain('daemon-name-header-row-Studio NAS');
        });

        it('expands the local daemon favorites but not a disconnected remote daemon', () => {
            const ids = component.dropdownItems.map((i) => i.id);
            expect(ids).toContain(`favorite-path-sub-row-${DEFAULT_BOOKMARK_NAME}-/media/fav`);
            expect(ids.some((id) => id.startsWith('favorite-path-sub-row-Studio NAS'))).toBe(false);
        });

        it('expands a remote daemon favorites once it is the connected daemon', () => {
            const remoteWithFav = makeBookmark('Studio NAS', ['/plates']);
            allBookmarks$.next([local, remoteWithFav]);
            current$.next(remoteWithFav);
            connectionState$.next(ConnectionState.CONNECTED);
            const ids = component.dropdownItems.map((i) => i.id);
            expect(ids).toContain('favorite-path-sub-row-Studio NAS-/plates');
        });
    });

    describe('connection icon', () => {
        it('tracks the connection state transitions', () => {
            connectionState$.next(ConnectionState.CONNECTING);
            expect(component.connectionState).toBe(ConnectionState.CONNECTING);
            connectionState$.next(ConnectionState.CONNECTED);
            expect(component.connectionState).toBe(ConnectionState.CONNECTED);
        });
    });

    describe('daemon selection', () => {
        it('opens a confirmation dialog when switching to a different daemon', () => {
            const header = component.dropdownItems.find((i) => i.id === 'daemon-name-header-row-Studio NAS');
            header?.itemClickHandler?.();
            expect(dialogOpen).toHaveBeenCalled();
        });

        it('applies the selection when the confirmation resolves true', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(true)});
            const header = component.dropdownItems.find((i) => i.id === 'daemon-name-header-row-Studio NAS');
            header?.itemClickHandler?.();
            expect(bookmarks['setSelection']).toHaveBeenCalledWith('Studio NAS');
        });
    });

    describe('add favorite path', () => {
        it('adds the favorite via the bookmarks service when the modal emits a path', () => {
            const saved = new Subject<string>();
            dialogOpen.mockReturnValueOnce({afterClosed: () => new Subject(), componentInstance: {favoritePathSaved: saved}});
            const addRow = component.dropdownItems.find((i) => i.id === `add-favorite-path-sub-row-${DEFAULT_BOOKMARK_NAME}`);
            addRow?.itemClickHandler?.();
            saved.next('/new/fav');
            expect(bookmarks['addFavoritePath']).toHaveBeenCalled();
            expect(notifications['open']).toHaveBeenCalledWith('added', 'success');
        });
    });

    describe('delete favorite path', () => {
        it('removes the favorite when the confirmation resolves true', () => {
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(true)});
            const favRow = component.dropdownItems.find((i) => i.id === `favorite-path-sub-row-${DEFAULT_BOOKMARK_NAME}-/media/fav`);
            const del = favRow?.actionIcons?.find((a) => a.id === 'delete-action-icon') as {iconClickHandler?: () => void} | undefined;
            del?.iconClickHandler?.();
            expect(bookmarks['deleteFavoritePath']).toHaveBeenCalledWith(expect.objectContaining({name: DEFAULT_BOOKMARK_NAME}), '/media/fav');
        });
    });

    describe('stop local daemon', () => {
        it('shuts the daemon down when connected locally and confirmed', () => {
            connectionState$.next(ConnectionState.CONNECTED);
            dialogOpen.mockReturnValueOnce({afterClosed: () => of(true)});
            const localHeader = component.dropdownItems.find((i) => i.id === `daemon-name-header-row-${DEFAULT_BOOKMARK_NAME}`);
            const stop = localHeader?.actionIcons?.find((a) => a.id === 'stop-action-icon') as {iconClickHandler?: () => void} | undefined;
            expect(stop).toBeTruthy();
            stop?.iconClickHandler?.();
            expect(notifications['info']).toHaveBeenCalledWith('Stopped the running local daemon.');
        });
    });
});
