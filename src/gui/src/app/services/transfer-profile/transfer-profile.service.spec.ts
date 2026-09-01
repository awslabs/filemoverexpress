import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, firstValueFrom } from 'rxjs';
import { TransferProfileService } from './transfer-profile.service';
import { MetadataService } from '../metadata/metadata.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationsService } from '../notifications/notifications.service';

// TransferProfileService injects MetadataService, FmeClientService, NotificationsService
// and MatDialog. init() subscribes to metadata.onUpdateTransferProfileNames and rebuilds
// its sorted profile list from metadata.transferProfiles. The mutating ops (select,
// delete, edit, add) gate on the cached list and drive dialogs + config RPCs. We stub
// every collaborator via useValue so no real dialog/snackbar/store is needed. The client
// getConfiguration/setConfiguration observables are BehaviorSubject/of-backed here and
// emit synchronously, so no queueMicrotask deferral is required.

describe('TransferProfileService', () => {
    let service: TransferProfileService;
    let onUpdateNames$: Subject<boolean>;
    let transferProfiles: Record<string, unknown>;
    let notifications: {success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>};
    let dialogOpen: ReturnType<typeof vi.fn>;
    let afterClosed$: Subject<unknown>;

    beforeEach(() => {
        onUpdateNames$ = new Subject<boolean>();
        transferProfiles = {beta: {}, Alpha: {}};
        afterClosed$ = new Subject<unknown>();

        const metadataStub: Partial<MetadataService> = {
            get onUpdateTransferProfileNames() {
                return onUpdateNames$.asObservable();
            },
            get transferProfiles() {
                return transferProfiles as never;
            },
        };

        notifications = {success: vi.fn(), warning: vi.fn(), error: vi.fn()};

        const fmeClientStub: Partial<FmeClientService> = {
            getConfiguration: vi.fn(() => of({
                protocols: {s3: {transferProfiles: {Alpha: {}, beta: {}}}},
            })) as unknown as FmeClientService['getConfiguration'],
            setConfiguration: vi.fn(() => of({} as never)) as unknown as FmeClientService['setConfiguration'],
        };

        dialogOpen = vi.fn(() => ({afterClosed: () => afterClosed$.asObservable()}));

        TestBed.configureTestingModule({
            providers: [
                TransferProfileService,
                {provide: MetadataService, useValue: metadataStub},
                {provide: FmeClientService, useValue: fmeClientStub},
                {provide: NotificationsService, useValue: notifications},
                {provide: MatDialog, useValue: {open: dialogOpen}},
            ],
        });
        service = TestBed.inject(TransferProfileService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('init() builds a case-insensitively sorted profile list and selects the first', async () => {
        service.init();
        onUpdateNames$.next(true);
        const state = await firstValueFrom(service.transferProfileState);
        expect(state.transferProfileList).toEqual(['Alpha', 'beta']);
        expect(state.currentTransferProfile).toBe('Alpha');
    });

    it('init() resets state when metadata.transferProfiles throws (no active session)', async () => {
        Object.defineProperty(TestBed.inject(MetadataService), 'transferProfiles', {
            get() {
                throw new Error('metadata not loaded');
            },
            configurable: true,
        });
        service.init();
        onUpdateNames$.next(true);
        const state = await firstValueFrom(service.transferProfileState);
        expect(state.transferProfileList).toBeNull();
        expect(state.currentTransferProfile).toBeNull();
    });

    it('select() switches to an existing profile', async () => {
        service.init();
        onUpdateNames$.next(true);
        service.select('beta');
        const state = await firstValueFrom(service.transferProfileState);
        expect(state.currentTransferProfile).toBe('beta');
    });

    it('select() warns and no-ops for an unknown profile', async () => {
        service.init();
        onUpdateNames$.next(true);
        service.select('ghost');
        expect(notifications.warning).toHaveBeenCalledWith(expect.stringContaining('ghost'));
        const state = await firstValueFrom(service.transferProfileState);
        expect(state.currentTransferProfile).toBe('Alpha');
    });

    it('delete() warns and returns false for an unknown profile without opening a dialog', async () => {
        service.init();
        onUpdateNames$.next(true);
        const result = await firstValueFrom(service.delete('ghost'));
        expect(result).toBe(false);
        expect(dialogOpen).not.toHaveBeenCalled();
        expect(notifications.warning).toHaveBeenCalled();
    });

    it('delete() opens a confirmation dialog for an existing profile and removes it on confirm', () => {
        service.init();
        onUpdateNames$.next(true);
        const fme = TestBed.inject(FmeClientService);
        service.delete('beta').subscribe();
        expect(dialogOpen).toHaveBeenCalled();
        // Confirm the dialog -> triggers getConfiguration + setConfiguration.
        afterClosed$.next(true);
        expect(fme.getConfiguration).toHaveBeenCalled();
        expect(fme.setConfiguration).toHaveBeenCalled();
        expect(notifications.success).toHaveBeenCalledWith(expect.stringContaining('beta'));
    });

    it('delete() does nothing further when the dialog is cancelled', () => {
        service.init();
        onUpdateNames$.next(true);
        const fme = TestBed.inject(FmeClientService);
        service.delete('beta').subscribe();
        afterClosed$.next(false);
        expect(fme.setConfiguration).not.toHaveBeenCalled();
    });

    it('add() opens the editor dialog', () => {
        dialogOpen.mockReturnValue({
            afterClosed: () => afterClosed$.asObservable(),
            componentInstance: {transferProfileSaved: new Subject()},
        });
        service.add();
        expect(dialogOpen).toHaveBeenCalled();
    });

    it('ngOnDestroy unsubscribes so later metadata updates are ignored', async () => {
        service.init();
        onUpdateNames$.next(true);
        service.ngOnDestroy();
        transferProfiles = {Zulu: {}};
        onUpdateNames$.next(true);
        const state = await firstValueFrom(service.transferProfileState);
        // List is unchanged from before destroy.
        expect(state.transferProfileList).toEqual(['Alpha', 'beta']);
    });
});
