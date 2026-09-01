import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, of } from 'rxjs';
import { BrowseButtonComponent } from './browse-button.component';
import { BookmarksService } from '@services/bookmarks/bookmarks.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { WailsService } from '@services/wails/wails.service';
import { Bookmark } from '@services/bookmarks/bookmarks.classes';
import { DEFAULT_BOOKMARK_NAME } from '@services/bookmarks/bookmarks.constants';
import { ConnectionState } from '@state/models/connection-state-model';

function makeBookmark(name: string): Bookmark {
    return new Bookmark({
        name,
        host: name === DEFAULT_BOOKMARK_NAME ? '127.0.0.1' : 'remote.example',
        port: 9999,
        encryption: false,
        pre_shared_key: '',
        favoritePaths: [],
        onConnectStartingPath: null,
    });
}

describe('BrowseButtonComponent', () => {
    let component: BrowseButtonComponent;
    let fixture: ComponentFixture<BrowseButtonComponent>;

    let current$: BehaviorSubject<Bookmark>;
    let connectionState$: BehaviorSubject<ConnectionState>;
    let openDirectory: ReturnType<typeof vi.fn>;
    let openFile: ReturnType<typeof vi.fn>;

    const local = makeBookmark(DEFAULT_BOOKMARK_NAME);
    const remote = makeBookmark('Studio NAS');

    function build() {
        openDirectory = vi.fn(() => of('/picked/dir'));
        openFile = vi.fn(() => of('/picked/file.pem'));

        TestBed.configureTestingModule({
            imports: [MatIconModule, MatTooltipModule],
            providers: [
                {provide: WailsService, useValue: {openDirectory, openFile}},
                {provide: BookmarksService, useValue: {current: current$.asObservable()}},
                {provide: FmeClientService, useValue: {connectionState: connectionState$.asObservable()}},
            ],
        });
        fixture = TestBed.createComponent(BrowseButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    beforeEach(() => {
        current$ = new BehaviorSubject<Bookmark>(local);
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.CONNECTED);
    });

    it('should create', () => {
        build();
        expect(component).toBeTruthy();
    });

    it('renders the button only when connected to a local daemon', () => {
        build();
        expect(fixture.nativeElement.querySelector('button.fme-browse-btn')).toBeTruthy();
    });

    it('hides the button when connected to a remote daemon', () => {
        current$ = new BehaviorSubject<Bookmark>(remote);
        build();
        expect(fixture.nativeElement.querySelector('button.fme-browse-btn')).toBeNull();
    });

    it('hides the button when disconnected', () => {
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
        build();
        expect(fixture.nativeElement.querySelector('button.fme-browse-btn')).toBeNull();
    });

    it('opens a directory dialog and emits the chosen path in directory mode', () => {
        build();
        fixture.componentRef.setInput('dialogTitle', 'Choose logs directory');
        fixture.componentRef.setInput('startPath', '/var/log');
        const picked = vi.fn();
        component.pathPicked.subscribe(picked);

        fixture.nativeElement.querySelector('button.fme-browse-btn').click();

        expect(openDirectory).toHaveBeenCalledWith('Choose logs directory', '/var/log');
        expect(openFile).not.toHaveBeenCalled();
        expect(picked).toHaveBeenCalledWith('/picked/dir');
    });

    it('opens a file dialog with the filter in file mode', () => {
        build();
        fixture.componentRef.setInput('mode', 'file');
        fixture.componentRef.setInput('dialogTitle', 'Choose CA bundle');
        fixture.componentRef.setInput('fileFilterName', 'PEM certificate');
        fixture.componentRef.setInput('fileFilterPattern', '*.pem');
        const picked = vi.fn();
        component.pathPicked.subscribe(picked);

        fixture.nativeElement.querySelector('button.fme-browse-btn').click();

        expect(openFile).toHaveBeenCalledWith('Choose CA bundle', '', 'PEM certificate', '*.pem');
        expect(picked).toHaveBeenCalledWith('/picked/file.pem');
    });

    it('does not emit when the user cancels (empty selection)', () => {
        build();
        openDirectory.mockReturnValue(of(''));
        const picked = vi.fn();
        component.pathPicked.subscribe(picked);

        fixture.nativeElement.querySelector('button.fme-browse-btn').click();

        expect(picked).not.toHaveBeenCalled();
    });
});
