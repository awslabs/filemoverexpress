import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import { MetadataService } from './metadata.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { MetadataEvent } from '@events/core';
import { ConnectionState } from '@state/models/connection-state-model';
import { VersionNumber } from '../version/version.constants';
import { MetadataNotLoadedError } from './metadata.interfaces';

// MetadataService injects FmeClientService and only touches its `metadata` and
// `connectionState` observables. We stub it with controllable BehaviorSubjects so
// each test drives the metadata/connection sequence directly. Both are
// BehaviorSubject-backed and emit synchronously, so no queueMicrotask deferral is
// needed here (unlike the callback-driven RPC methods on the real client).

function makeMetadata(overrides: Partial<MetadataEvent> = {}): MetadataEvent {
    const md = new MetadataEvent();
    return Object.assign(md, overrides);
}

describe('MetadataService', () => {
    let service: MetadataService;
    let metadata$: BehaviorSubject<MetadataEvent>;
    let connectionState$: BehaviorSubject<ConnectionState>;

    beforeEach(() => {
        // The real client seeds metadata with a default (VERSION_DEFAULT) value.
        metadata$ = new BehaviorSubject<MetadataEvent>(makeMetadata({version: VersionNumber.VERSION_DEFAULT}));
        connectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);

        const fmeClientStub: Partial<FmeClientService> = {
            get metadata() {
                return metadata$.asObservable();
            },
            get connectionState() {
                return connectionState$.asObservable();
            },
        };

        TestBed.configureTestingModule({
            providers: [
                MetadataService, {provide: FmeClientService, useValue: fmeClientStub},
            ],
        });
        service = TestBed.inject(MetadataService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('ignores the initial default-version metadata before init and leaves allMetadata unloaded', () => {
        service.init();
        // Only the seeded default value has been emitted; the guard skips it.
        expect(() => service.allMetadata).toThrow(MetadataNotLoadedError);
    });

    it('stores real metadata once emitted after init', () => {
        service.init();
        const real = makeMetadata({version: '1.2.3', daemonMode: true, cpuCoreCount: 8, daemonOS: 'linux'});
        metadata$.next(real);
        expect(service.allMetadata).toBe(real);
        expect(service.daemonVersion).toBe('1.2.3');
        expect(service.daemonMode).toBe(true);
        expect(service.cpuCoreCount).toBe(8);
        expect(service.daemonOS).toBe('linux');
    });

    it('updates the metadata signal when real metadata arrives', () => {
        service.init();
        const real = makeMetadata({version: '2.0.0'});
        metadata$.next(real);
        expect(service.metadataSig().version).toBe('2.0.0');
    });

    it('emits on onUpdate when metadata arrives', async () => {
        service.init();
        const updates = firstValueFrom(service.onUpdate.pipe(take(2), toArray()));
        metadata$.next(makeMetadata({version: '1.0.0'}));
        expect((await updates).length).toBe(2);
    });

    it('emits on onUpdateTransferProfileNames when metadata arrives', async () => {
        service.init();
        const names = firstValueFrom(service.onUpdateTransferProfileNames.pipe(take(2), toArray()));
        metadata$.next(makeMetadata({version: '1.0.0'}));
        expect((await names).length).toBe(2);
    });

    it('exposes transferProfiles / permissions / homePath / awsProfiles from loaded metadata', () => {
        service.init();
        const real = makeMetadata({
            version: '1.0.0',
            transferProfiles: {default: {}} as never,
            permissions: {allowUiConfiguration: true} as never,
            homePath: '/home/dit',
            awsProfiles: ['default', 'prod'],
            hotFolderSourceDirectories: ['/hot'],
            connectionEvent: true,
        });
        metadata$.next(real);
        expect(service.transferProfiles).toEqual({default: {}});
        expect(service.permissions).toEqual({allowUiConfiguration: true});
        expect(service.homePath).toBe('/home/dit');
        expect(service.awsProfiles).toEqual(['default', 'prod']);
        expect(service.hotFolderSourceDirectories).toEqual(['/hot']);
        expect(service.connectionEvent).toBe(true);
    });

    it('nulls out metadata and fires an update on disconnect after being connected', () => {
        service.init();
        metadata$.next(makeMetadata({version: '1.0.0'}));
        expect(() => service.allMetadata).not.toThrow();

        connectionState$.next(ConnectionState.CONNECTED);
        connectionState$.next(ConnectionState.DISCONNECTED);

        expect(() => service.allMetadata).toThrow(MetadataNotLoadedError);
    });

    it('every getter throws MetadataNotLoadedError when metadata is null', () => {
        service.init();
        for (const getter of [
            () => service.allMetadata,
            () => service.daemonMode,
            () => service.transferProfiles,
            () => service.cpuCoreCount,
            () => service.daemonVersion,
            () => service.permissions,
            () => service.homePath,
            () => service.daemonOS,
            () => service.connectionEvent,
            () => service.awsProfiles,
            () => service.hotFolderSourceDirectories,
        ]) {
            expect(getter).toThrow(MetadataNotLoadedError);
        }
    });

    it('ngOnDestroy unsubscribes so later emissions are ignored', () => {
        service.init();
        service.ngOnDestroy();
        metadata$.next(makeMetadata({version: '9.9.9'}));
        // Subscription torn down: the null guard still holds and the sig keeps its default.
        expect(() => service.allMetadata).toThrow(MetadataNotLoadedError);
    });
});
