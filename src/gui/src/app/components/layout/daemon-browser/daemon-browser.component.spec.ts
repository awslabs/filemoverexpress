import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DaemonBrowserComponent } from './daemon-browser.component';
import { AppState } from '@app/state';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { initialTestState } from '@state/test.state';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { MetadataService } from '@services/metadata/metadata.service';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { WailsService } from '@services/wails/wails.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { FileBrowserObject, FileBrowserObjectType, FileBrowserState } from '../file-browser/file-browser.interfaces';
import * as UiContextActions from '@state/ui-context/actions/ui-context.actions';

describe('DaemonBrowserComponent', () => {
    let component: DaemonBrowserComponent;
    let fixture: ComponentFixture<DaemonBrowserComponent>;
    let store: MockStore<AppState>;

    let connectionState$: BehaviorSubject<ConnectionState>;
    let transferProfileState$: BehaviorSubject<{ currentTransferProfile: string | null; transferProfileList: string[] | null }>;
    let bookmarkCurrent$: BehaviorSubject<{ name: string; onConnectStartingPath: string | null }>;
    let allBookmarks$: Subject<unknown>;
    let metadataUpdate$: Subject<void>;

    let fmeClient: {
        connectionState: BehaviorSubject<ConnectionState>;
        listDaemonFolder: ReturnType<typeof vi.fn>;
        downloadPrefixes: ReturnType<typeof vi.fn>;
        getConfiguration: ReturnType<typeof vi.fn>;
        setConfiguration: ReturnType<typeof vi.fn>;
        createLocalFolder: ReturnType<typeof vi.fn>;
        renameLocalPath: ReturnType<typeof vi.fn>;
        deleteLocalPath: ReturnType<typeof vi.fn>;
        cancelConnection: ReturnType<typeof vi.fn>;
    };
    let notifications: Record<string, ReturnType<typeof vi.fn>>;
    let bookmarks: Record<string, unknown>;
    let metadata: {
        permissions: Record<string, boolean>;
        transferProfiles: Record<string, { remote: string; local: string }>;
        hotFolderSourceDirectories: string[];
        daemonOS: string;
        onUpdate: Subject<void>;
    };

    const PROFILE = 'my-profile';

    function makeFolder(name: string): FileBrowserObject {
        return {name, size: null, dateModified: null, type: FileBrowserObjectType.FOLDER};
    }

    beforeEach(() => {
        vi.useFakeTimers();
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
        transferProfileState$ = new BehaviorSubject({currentTransferProfile: null as string | null, transferProfileList: null as string[] | null});
        bookmarkCurrent$ = new BehaviorSubject({name: 'Local File System', onConnectStartingPath: null as string | null});
        allBookmarks$ = new Subject<unknown>();
        metadataUpdate$ = new Subject<void>();

        fmeClient = {
            connectionState: connectionState$,
            listDaemonFolder: vi.fn(() => of({folders: [], files: []})),
            downloadPrefixes: vi.fn(() => of({})),
            getConfiguration: vi.fn(() => of({protocols: {s3: {transferProfiles: {}}}})),
            setConfiguration: vi.fn(() => of({})),
            createLocalFolder: vi.fn(() => of({success: true, message: ''})),
            renameLocalPath: vi.fn(() => of({})),
            deleteLocalPath: vi.fn(() => of({})),
            cancelConnection: vi.fn(),
        };
        notifications = {success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), open: vi.fn()};
        bookmarks = {
            current: bookmarkCurrent$.asObservable(),
            getAllBookmarks: allBookmarks$.asObservable(),
            hasFavoritePath: vi.fn(() => false),
            addFavoritePath: vi.fn(() => ({message: 'added', level: 'success'})),
            deleteFavoritePath: vi.fn(() => ({message: 'removed', level: 'success'})),
            edit: vi.fn(),
            setSelection: vi.fn(),
        };
        metadata = {
            permissions: {allowLocalRenameDelete: true},
            transferProfiles: {},
            hotFolderSourceDirectories: [],
            daemonOS: 'linux',
            onUpdate: metadataUpdate$,
        };

        const transferProfileServiceStub: Partial<TransferProfileService> = {
            transferProfileState: transferProfileState$.asObservable() as never,
        };
        const wailsStub: Partial<WailsService> = {
            systemOpen: vi.fn(() => of(void 0)) as never,
            systemShowItemInFolder: vi.fn(() => of(void 0)) as never,
        };

        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatSnackBarModule,
                MatTableModule,
                MatIconModule,
                MatMenuModule,
                FormsModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
                {provide: FmeClientService, useValue: fmeClient},
                {provide: TransferProfileService, useValue: transferProfileServiceStub},
                {provide: NotificationsService, useValue: notifications},
                {provide: MetadataService, useValue: metadata},
                {provide: BookmarksService, useValue: bookmarks},
                {provide: WailsService, useValue: wailsStub},
                {provide: MatDialog, useValue: {open: vi.fn()}},
            ],
        });
        store = TestBed.inject(MockStore);
        store.dispatch = vi.fn();
        fixture = TestBed.createComponent(DaemonBrowserComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('connection state transitions', () => {
        it('shows a no-session error state on the synchronous disconnected emission', () => {
            expect(component.fileBrowserData.state).toBe(FileBrowserState.ERROR);
            expect(component.fileBrowserData.error?.title).toBe('No Selected Daemon');
        });

        it('shows the connecting state with a cancel button while CONNECTING', () => {
            connectionState$.next(ConnectionState.CONNECTING);
            expect(component.fileBrowserData.error?.title).toBe('Connecting to Session');
            expect(component.fileBrowserData.error?.actionButtons?.[0].buttonText).toBe('Cancel');
        });

        it('treats a CONNECTING -> DISCONNECTED transition as a connection failure', () => {
            connectionState$.next(ConnectionState.CONNECTING);
            connectionState$.next(ConnectionState.DISCONNECTED);
            expect(component.fileBrowserData.error?.title).toBe('Connection Failed');
        });

        it('navigates to the starting directory after connecting (delayed)', () => {
            const spy = vi.spyOn(component, 'navigateToPath');
            connectionState$.next(ConnectionState.CONNECTED);
            expect(spy).not.toHaveBeenCalled();
            vi.advanceTimersByTime(500);
            expect(spy).toHaveBeenCalledWith(component.getStartingDirectory(), {initialNavigation: true});
        });
    });

    describe('navigateToPath', () => {
        beforeEach(() => {
            connectionState$.next(ConnectionState.CONNECTED);
            vi.advanceTimersByTime(500);
            fmeClient.listDaemonFolder.mockClear();
        });

        it('lists a folder and populates the browser data', () => {
            fmeClient.listDaemonFolder.mockReturnValueOnce(of({
                folders: ['sub'],
                files: [{path: 'a.mov', size: 5n, lastModified: new Date()}],
            }));
            component.navigateToPath('/data');
            expect(component.fileBrowserData.state).toBe(FileBrowserState.LOADED);
            expect(component.fileBrowserData.list.map((o) => o.name)).toEqual(['sub', 'a.mov']);
            expect(component.currentDirectory).toBe('/data');
            expect(store.dispatch).toHaveBeenCalledWith(UiContextActions.setDaemonBrowserPath({path: '/data'}));
        });

        it('shows a listing error when the same directory fails', () => {
            component.currentDirectory = '/data';
            fmeClient.listDaemonFolder.mockReturnValueOnce(throwError(() => new Error('permission denied')));
            component.navigateToPath('/data');
            expect(component.fileBrowserData.state).toBe(FileBrowserState.ERROR);
            expect(component.fileBrowserData.error?.title).toBe('File System Listing Error');
        });

        it('redirects to root when the initial navigation to a non-root path fails', () => {
            fmeClient.listDaemonFolder
                .mockReturnValueOnce(throwError(() => new Error('gone')))
                .mockReturnValueOnce(of({folders: [], files: []}));
            component.navigateToPath('/missing', {initialNavigation: true});
            expect(component.currentDirectory).toBe('/');
            expect(notifications.warning).toHaveBeenCalled();
        });
    });

    describe('refreshFileBrowser', () => {
        it('does nothing when disconnected', () => {
            component.connectionState = ConnectionState.DISCONNECTED;
            const spy = vi.spyOn(component, 'navigateToPath');
            component.refreshFileBrowser();
            expect(spy).not.toHaveBeenCalled();
        });

        it('re-navigates the current directory when connected', () => {
            component.connectionState = ConnectionState.CONNECTED;
            component.currentDirectory = '/here';
            const spy = vi.spyOn(component, 'navigateToPath');
            component.refreshFileBrowser(true);
            expect(spy).toHaveBeenCalledWith('/here', {silentRefreshNavigation: true});
        });
    });

    describe('getStartingDirectory', () => {
        it('prefers the configured local starting directory over the remembered on-connect path', () => {
            bookmarkCurrent$.next({name: 'Local File System', onConnectStartingPath: '/where/i/was'});
            component.selectedTransferProfile = PROFILE;
            metadata.transferProfiles[PROFILE] = {remote: '', local: '/home/dit'};
            expect(component.getStartingDirectory()).toBe('/home/dit');
        });

        it('uses the on-connect starting path when no local starting directory is configured', () => {
            bookmarkCurrent$.next({name: 'Local File System', onConnectStartingPath: '/fav'});
            expect(component.getStartingDirectory()).toBe('/fav');
        });

        it('falls back to the configured local path', () => {
            component.selectedTransferProfile = PROFILE;
            metadata.transferProfiles[PROFILE] = {remote: '', local: '/home/dit'};
            expect(component.getStartingDirectory()).toBe('/home/dit');
        });

        it('returns root when nothing is configured', () => {
            expect(component.getStartingDirectory()).toBe('/');
        });
    });

    describe('favorite path predicates', () => {
        it('isFavoritePath reflects the object flag', () => {
            expect(component.isFavoritePath({...makeFolder('x'), isFavorite: true})).toBe(true);
            expect(component.isNotFavoritePath({...makeFolder('x'), isFavorite: true})).toBe(false);
        });

        it('addFavoritePath handler adds via the bookmarks service', () => {
            component.selectedBookmark = {name: 'Local File System'} as never;
            component.addFavoritePath()(null, makeFolder('/media/fav'), '/');
            expect(bookmarks.addFavoritePath).toHaveBeenCalled();
            expect(notifications.open).toHaveBeenCalledWith('added', 'success');
        });

        it('removeFavoritePath handler removes via the bookmarks service', () => {
            component.selectedBookmark = {name: 'Local File System'} as never;
            component.removeFavoritePath()(null, makeFolder('/media/fav'), '/');
            expect(bookmarks.deleteFavoritePath).toHaveBeenCalled();
            expect(notifications.open).toHaveBeenCalledWith('removed', 'success');
        });
    });

    describe('dragDropDownload', () => {
        it('rejects an external-source drop', () => {
            component.dragDropDownload({
                fromExternalSource: true,
                sourceContainerID: 'bucket-browser',
                sources: [],
                destinationContainerID: component.fileBrowserID,
                destination: '/x',
                dragOriginSourceName: '',
            });
            expect(notifications.error).toHaveBeenCalled();
        });

        it('errors when no transfer profile is selected for a valid drop', () => {
            component.selectedTransferProfile = null;
            component.dragDropDownload({
                fromExternalSource: false,
                sourceContainerID: 'bucket-browser',
                sources: [makeFolder('a')],
                destinationContainerID: component.fileBrowserID,
                destination: '/x',
                dragOriginSourceName: 'a',
            });
            expect(notifications.error).toHaveBeenCalled();
        });
    });

    describe('metadata update', () => {
        it('derives hot folders and browser type from metadata', () => {
            metadata.hotFolderSourceDirectories = ['/watch/incoming/'];
            metadata.daemonOS = 'linux';
            metadataUpdate$.next();
            expect(component.hotFolderList).toEqual(['/watch/incoming']);
            expect(component.fileBrowserType).toBe('linux');
            expect(component.allowLocalRenameDelete).toBe(true);
        });
    });
});
