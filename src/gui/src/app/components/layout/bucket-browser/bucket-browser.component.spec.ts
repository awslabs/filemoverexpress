import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BucketBrowserComponent } from './bucket-browser.component';
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
import { FileBrowserObjectType, FileBrowserState } from '../file-browser/file-browser.interfaces';
import * as UiContextActions from '@state/ui-context/actions/ui-context.actions';
import { Code, ConnectError } from '@connectrpc/connect';

describe('BucketBrowserComponent', () => {
    let component: BucketBrowserComponent;
    let fixture: ComponentFixture<BucketBrowserComponent>;
    let store: MockStore<AppState>;

    // Controllable streams the component subscribes to in its constructor.
    let connectionState$: BehaviorSubject<ConnectionState>;
    let transferProfileState$: BehaviorSubject<{ currentTransferProfile: string | null; transferProfileList: string[] | null }>;
    let transferProfileEdited$: Subject<string>;
    let bookmarkCurrent$: BehaviorSubject<{ name: string }>;
    let metadataUpdate$: Subject<void>;

    let fmeClient: {
        connectionState: BehaviorSubject<ConnectionState>;
        listS3Prefix: ReturnType<typeof vi.fn>;
        uploadPrefixes: ReturnType<typeof vi.fn>;
        getConfiguration: ReturnType<typeof vi.fn>;
        setConfiguration: ReturnType<typeof vi.fn>;
        createS3Prefix: ReturnType<typeof vi.fn>;
        renameS3Path: ReturnType<typeof vi.fn>;
        deleteS3Path: ReturnType<typeof vi.fn>;
    };
    let notifications: Record<string, ReturnType<typeof vi.fn>>;
    let dialogOpen: ReturnType<typeof vi.fn>;
    let metadata: { permissions: Record<string, boolean>; transferProfiles: Record<string, { remote: string; local: string }>; onUpdate: Subject<void> };

    const PROFILE = 'my-profile';

    beforeEach(() => {
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
        transferProfileState$ = new BehaviorSubject({currentTransferProfile: null as string | null, transferProfileList: null as string[] | null});
        transferProfileEdited$ = new Subject<string>();
        bookmarkCurrent$ = new BehaviorSubject({name: 'Local File System'});
        metadataUpdate$ = new Subject<void>();

        fmeClient = {
            connectionState: connectionState$,
            listS3Prefix: vi.fn(() => of({folders: [], files: []})),
            uploadPrefixes: vi.fn(() => of({})),
            getConfiguration: vi.fn(() => of({protocols: {s3: {transferProfiles: {}}}})),
            setConfiguration: vi.fn(() => of({})),
            createS3Prefix: vi.fn(() => of({success: true, message: ''})),
            renameS3Path: vi.fn(() => of({})),
            deleteS3Path: vi.fn(() => of({})),
        };
        notifications = {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn(),
            open: vi.fn(),
        };
        dialogOpen = vi.fn();
        metadata = {
            permissions: {allowUiConfiguration: true, allowRemoteRenameDelete: true},
            transferProfiles: {},
            onUpdate: metadataUpdate$,
        };

        const transferProfileServiceStub: Partial<TransferProfileService> = {
            transferProfileState: transferProfileState$.asObservable() as never,
            transferProfileEdited: transferProfileEdited$.asObservable() as never,
            add: vi.fn(),
            edit: vi.fn(),
        };
        const bookmarksStub: Partial<BookmarksService> = {
            current: bookmarkCurrent$.asObservable() as never,
        };
        const wailsStub: Partial<WailsService> = {
            onEvent: vi.fn(),
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
                {provide: BookmarksService, useValue: bookmarksStub},
                {provide: WailsService, useValue: wailsStub},
                {provide: MatDialog, useValue: {open: dialogOpen}},
            ],
        });
        store = TestBed.inject(MockStore);
        store.dispatch = vi.fn();
        fixture = TestBed.createComponent(BucketBrowserComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('connection state', () => {
        it('shows the no-active-session error while disconnected', () => {
            expect(component.connectionState).toBe(ConnectionState.DISCONNECTED);
            expect(component.fileBrowserData.state).toBe(FileBrowserState.ERROR);
            expect(component.fileBrowserData.error?.title).toBe('No Active Session');
        });

        it('maps file-browser state to the s3 connection pill', () => {
            component.fileBrowserData = {state: FileBrowserState.LOADED, list: [], error: null};
            expect(component.s3ConnectionState).toBe(ConnectionState.CONNECTED);
            component.fileBrowserData = {state: FileBrowserState.LOADING, list: [], error: null};
            expect(component.s3ConnectionState).toBe(ConnectionState.CONNECTING);
            component.fileBrowserData = {state: FileBrowserState.ERROR, list: [], error: null};
            expect(component.s3ConnectionState).toBe(ConnectionState.DISCONNECTED);
        });
    });

    describe('navigateToPath', () => {
        beforeEach(() => {
            component.selectedTransferProfile = PROFILE;
        });

        it('lists the prefix and maps folders/files into the browser list', () => {
            fmeClient.listS3Prefix.mockReturnValueOnce(of({
                folders: ['photos'],
                files: [{path: 'clip.mov', size: 100n, lastModified: new Date(), storageClass: 'STANDARD'}],
            }));
            component.navigateToPath('/media');
            expect(fmeClient.listS3Prefix).toHaveBeenCalledWith(PROFILE, '/media');
            expect(component.fileBrowserData.state).toBe(FileBrowserState.LOADED);
            expect(component.fileBrowserData.list.map((o) => o.name)).toEqual(['photos', 'clip.mov']);
            expect(component.currentDirectory).toBe('/media');
            expect(store.dispatch).toHaveBeenCalledWith(UiContextActions.setBucketBrowserPath({path: '/media'}));
        });

        it('prepends a leading slash to a relative path', () => {
            component.navigateToPath('media');
            expect(fmeClient.listS3Prefix).toHaveBeenCalledWith(PROFILE, '/media');
        });

        it('does nothing when no transfer profile is selected', () => {
            component.selectedTransferProfile = null;
            component.navigateToPath('/x');
            expect(fmeClient.listS3Prefix).not.toHaveBeenCalled();
        });

        it('surfaces a listing error state', () => {
            fmeClient.listS3Prefix.mockReturnValueOnce(throwError(() => new Error('access denied')));
            component.navigateToPath('/media');
            expect(component.fileBrowserData.state).toBe(FileBrowserState.ERROR);
            expect(component.fileBrowserData.error?.title).toBe('S3 Bucket Listing Error');
            expect(store.dispatch).toHaveBeenCalled();
        });

        it('routes an unauthenticated OIDC profile to Sign-in-required', () => {
            component.currentProfileIsOIDC = true;
            component.oidcAuthenticated = false;
            fmeClient.listS3Prefix.mockReturnValueOnce(throwError(() => new ConnectError('nope', Code.Unauthenticated)));
            component.navigateToPath('/media');
            expect(component.fileBrowserData.error?.title).toBe('Sign in to continue');
            expect(component.oidcAuthenticated).toBe(false);
        });

        it('ignores a silent-refresh failure', () => {
            component.fileBrowserData = {state: FileBrowserState.LOADED, list: [], error: null};
            fmeClient.listS3Prefix.mockReturnValueOnce(throwError(() => new Error('flaky')));
            component.navigateToPath('/media', {silentRefreshNavigation: true});
            expect(component.fileBrowserData.state).toBe(FileBrowserState.LOADED);
        });
    });

    describe('getStartingDirectory', () => {
        it('returns the configured remote path for the profile', () => {
            component.selectedTransferProfile = PROFILE;
            metadata.transferProfiles[PROFILE] = {remote: '/incoming', local: ''};
            expect(component.getStartingDirectory()).toBe('/incoming');
        });

        it('falls back to root when no remote path is configured', () => {
            component.selectedTransferProfile = PROFILE;
            metadata.transferProfiles[PROFILE] = {remote: '', local: ''};
            expect(component.getStartingDirectory()).toBe('/');
        });

        it('returns root when there is no selected profile', () => {
            component.selectedTransferProfile = null;
            expect(component.getStartingDirectory()).toBe('/');
        });
    });

    describe('uploadPrefixes', () => {
        it('starts an upload and notifies success', () => {
            component.uploadPrefixes(PROFILE, false, ['/a/b/c.mov'], '/dest', 'job1');
            expect(fmeClient.uploadPrefixes).toHaveBeenCalled();
            expect(notifications.success).toHaveBeenCalledWith('Started upload.');
        });

        it('notifies an error when the upload RPC fails', () => {
            fmeClient.uploadPrefixes.mockReturnValueOnce(throwError(() => 'boom'));
            component.uploadPrefixes(PROFILE, false, ['/a/b/c.mov'], '/dest', 'job1');
            expect(notifications.error).toHaveBeenCalled();
        });
    });

    describe('onOidcAuthChange', () => {
        it('navigates on successful authentication', () => {
            const spy = vi.spyOn(component, 'navigateToPath');
            component.onOidcAuthChange(true);
            expect(component.oidcAuthenticated).toBe(true);
            expect(spy).toHaveBeenCalledWith(component.getStartingDirectory());
        });

        it('shows the sign-in-required error on sign-out', () => {
            component.onOidcAuthChange(false);
            expect(component.oidcAuthenticated).toBe(false);
            expect(component.fileBrowserData.error?.title).toBe('Sign in to continue');
        });
    });

    describe('dragDropUpload', () => {
        it('blocks external drag when connected to a non-default (remote) daemon', () => {
            bookmarkCurrent$.next({name: 'Remote Daemon'});
            component.dragDropUpload({
                fromExternalSource: true,
                sourceContainerID: null,
                sources: [{name: 'a', size: 0n, dateModified: new Date(), type: FileBrowserObjectType.FILE}],
                destinationContainerID: component.fileBrowserID,
                destination: '/dest',
                dragOriginSourceName: 'a',
            });
            expect(notifications.error).toHaveBeenCalled();
        });
    });

    describe('deleteS3Path via context handler', () => {
        it('reports success after deleting all targets', () => {
            component.selectedTransferProfile = PROFILE;
            dialogOpen.mockReturnValue({afterClosed: () => of(true)});
            component.fileBrowser = {getSelectedObjects: () => []} as never;
            const handler = (component as unknown as {
                deleteS3Path: () => (t: unknown, o: unknown, d: string) => void;
            }).deleteS3Path();
            handler(null, {name: 'old.mov', type: FileBrowserObjectType.FILE, size: 1n, dateModified: new Date()}, '/');
            expect(fmeClient.deleteS3Path).toHaveBeenCalled();
            expect(notifications.success).toHaveBeenCalledWith('Successfully deleted old.mov');
        });
    });

    describe('re-list on profile edit', () => {
        it('re-resolves the selected profile when it is edited', () => {
            component.selectedTransferProfile = PROFILE;
            const spy = vi.spyOn(component, 'navigateToPath');
            transferProfileEdited$.next(PROFILE);
            expect(fmeClient.getConfiguration).toHaveBeenCalled();
            expect(spy).toHaveBeenCalled();
        });
    });
});
