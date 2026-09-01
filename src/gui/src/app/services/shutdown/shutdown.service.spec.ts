import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { RendererFactory2 } from '@angular/core';import { Store } from '@ngrx/store';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { ShutdownService } from '@services/shutdown/shutdown.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { PreferencesService } from '@services/preferences/preferences.service';
import { ExportService } from '@services/export/export.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { WailsService } from '@services/wails/wails.service';
import { ConnectionState } from '@state/models/connection-state-model';

// ShutdownService wires up wails 'fatal-shutdown'/'app-close' handlers (only in packaged
// mode, which jsdom is not) and reacts to connectionState. We stub every collaborator via
// useValue: FmeClientService exposes controllable connectionState + a store selector via
// MockStore-like stub, WailsService records send/quit/onEvent, MatDialog records open and
// returns a controllable afterClosed. isPackagedApp() is false under jsdom so the wails
// event handlers do not register; we test the connection-drop dialog-close behavior and
// showDaemonCloseModal branches, which do not depend on packaging.

describe('ShutdownService', () => {
    let connectionState$: BehaviorSubject<ConnectionState>;
    let selectConnState$: BehaviorSubject<ConnectionState>;
    let dialogOpen: ReturnType<typeof vi.fn>;
    let dialogCloseAll: ReturnType<typeof vi.fn>;
    let wails: {send: ReturnType<typeof vi.fn>; quit: ReturnType<typeof vi.fn>; onEvent: ReturnType<typeof vi.fn>};
    let afterClosed$: Subject<unknown>;

    function build(): ShutdownService {
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);
        selectConnState$ = new BehaviorSubject<ConnectionState>(ConnectionState.CONNECTED);
        afterClosed$ = new Subject<unknown>();
        dialogOpen = vi.fn(() => ({afterClosed: () => afterClosed$.asObservable()}));
        dialogCloseAll = vi.fn();
        wails = {send: vi.fn(), quit: vi.fn(), onEvent: vi.fn()};

        const fmeClientStub: Partial<FmeClientService> = {
            get connectionState() {
                return connectionState$.asObservable();
            },
            shutdown: vi.fn(() => of(0 as never)) as unknown as FmeClientService['shutdown'],
            generateSupportFile: vi.fn(() => of({} as never)) as unknown as FmeClientService['generateSupportFile'],
            processStreamError: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                ShutdownService,
                {provide: FmeClientService, useValue: fmeClientStub},
                {provide: PreferencesService, useValue: {daemonClose: 'ask'}},
                {provide: ExportService, useValue: {exportJobs: vi.fn()}},
                {provide: NotificationsService, useValue: {success: vi.fn(), error: vi.fn(), warning: vi.fn()}},
                {provide: WailsService, useValue: wails},
                {provide: MatDialog, useValue: {open: dialogOpen, closeAll: dialogCloseAll}},
                {provide: Store, useValue: {select: () => selectConnState$.asObservable(), dispatch: vi.fn()}},
                {provide: RendererFactory2, useValue: {createRenderer: () => ({createElement: () => ({click: vi.fn(), remove: vi.fn()})})}},
            ],
        });
        return TestBed.inject(ShutdownService);
    }

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    });

    it('should be created', () => {
        expect(build()).toBeTruthy();
    });

    it('registers wails app-close and fatal-shutdown listeners are attempted via onEvent', () => {
        build();
        // app-close is always registered; fatal-shutdown only in packaged mode (not jsdom).
        expect(wails.onEvent).toHaveBeenCalledWith('app-close', expect.any(Function));
    });

    it('tracks connected state from connectionState', () => {
        const service = build();
        expect(service.connected).toBe(false);
        connectionState$.next(ConnectionState.CONNECTED);
        expect(service.connected).toBe(true);
    });

    it('closes open dialogs when an established connection drops abruptly', () => {
        build();
        connectionState$.next(ConnectionState.CONNECTED);
        connectionState$.next(ConnectionState.DISCONNECTED);
        expect(dialogCloseAll).toHaveBeenCalled();
    });

    it('does NOT close dialogs on a disconnect that was never preceded by a connection', () => {
        build();
        connectionState$.next(ConnectionState.DISCONNECTED);
        expect(dialogCloseAll).not.toHaveBeenCalled();
    });

    it('showDaemonCloseModal opens a confirmation dialog when connected', () => {
        const service = build();
        selectConnState$.next(ConnectionState.CONNECTED);
        service.showDaemonCloseModal().subscribe();
        expect(dialogOpen).toHaveBeenCalled();
    });

    it('showDaemonCloseModal resolves to true when the dialog is dismissed (undefined)', async () => {
        const service = build();
        selectConnState$.next(ConnectionState.CONNECTED);
        const result$ = service.showDaemonCloseModal();
        const p = new Promise<boolean>((resolve) => result$.subscribe((v) => resolve(v)));
        afterClosed$.next(undefined);
        expect(await p).toBe(true);
    });

    it('showDaemonCloseModal sends "closed" to wails when disconnected', () => {
        const service = build();
        selectConnState$.next(ConnectionState.DISCONNECTED);
        service.showDaemonCloseModal().subscribe();
        expect(wails.send).toHaveBeenCalledWith('closed');
        expect(dialogOpen).not.toHaveBeenCalled();
    });

    it('ngOnDestroy unsubscribes without throwing', () => {
        const service = build();
        expect(() => service.ngOnDestroy()).not.toThrow();
    });
});
