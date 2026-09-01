import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

import { BookmarksService } from './bookmarks.service';
import { LocalStorageService } from '../local-storage/local-storage.service';
import { Bookmark } from './bookmarks.classes';
import { BookmarkStorage } from './bookmarks.interfaces';
import {
    BOOKMARK_LIST_STORAGE_KEY,
    CURRENT_BOOKMARK_STORAGE_KEY,
    DEFAULT_BOOKMARK_NAME,
    DEFAULT_HOST_NAME,
} from './bookmarks.constants';
import { StorageServiceError, StorageServiceErrorType } from '@app/classes/errors';
import { PanelLevel } from '../notifications/notifications.constants';

// ---------------------------------------------------------------------------
// Controllable LocalStorageService fake.
//
// BookmarksService reads its store from LocalStorageService in the constructor
// (getObject(BOOKMARK_LIST_STORAGE_KEY, ...) and getString(CURRENT_BOOKMARK_
// STORAGE_KEY, ...)) and persists via set(...). The real service is a thin
// wrapper over window.localStorage; we replace it with an in-memory fake so
// each test can seed initial state deterministically and assert what was saved
// without touching the DOM Storage API.
//
// getObject / getString honour the NoSuchKey -> defaultValue contract of the
// real service so an unseeded key falls back exactly as production does.
// ---------------------------------------------------------------------------
class FakeLocalStorageService {
    store = new Map<string, unknown>();
    setSpy = vi.fn();

    seedObject(key: string, value: unknown): void {
        this.store.set(key, value);
    }

    set(key: string, value: unknown): void {
        this.setSpy(key, value);
        this.store.set(key, value);
    }

    getObject<T>(key: string, defaultValue?: T): T {
        if (!this.store.has(key)) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new StorageServiceError('No such key has been set', StorageServiceErrorType.NoSuchKey);
        }
        return this.store.get(key) as T;
    }

    getString(key: string, defaultValue?: string): string {
        if (!this.store.has(key)) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new StorageServiceError('No such key has been set', StorageServiceErrorType.NoSuchKey);
        }
        return this.store.get(key) as string;
    }
}

function makeBookmark(name: string, overrides: Partial<Bookmark> = {}): Bookmark {
    return new Bookmark({
        name,
        host: 'example.com',
        port: 50006,
        encryption: true,
        pre_shared_key: '',
        favoritePaths: [],
        onConnectStartingPath: null,
        ...overrides,
    });
}

describe('BookmarksService', () => {
    let fakeStorage: FakeLocalStorageService;

    function createService(seed?: { store?: BookmarkStorage | Bookmark[]; current?: string }): BookmarksService {
        fakeStorage = new FakeLocalStorageService();
        if (seed?.store !== undefined) {
            fakeStorage.seedObject(BOOKMARK_LIST_STORAGE_KEY, seed.store);
        }
        if (seed?.current !== undefined) {
            fakeStorage.seedObject(CURRENT_BOOKMARK_STORAGE_KEY, seed.current);
        }

        TestBed.configureTestingModule({
            providers: [
                BookmarksService, { provide: LocalStorageService, useValue: fakeStorage },
            ],
        });
        return TestBed.inject(BookmarksService);
    }

    afterEach(() => {
        TestBed.resetTestingModule();
        vi.clearAllMocks();
    });

    describe('construction and defaults', () => {
        it('should be created', () => {
            const service = createService();
            expect(service).toBeTruthy();
        });

        it('seeds the default local daemon bookmark when storage is empty', async () => {
            const service = createService();
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks).toHaveLength(1);
            expect(bookmarks[0].name).toBe(DEFAULT_BOOKMARK_NAME);
            expect(bookmarks[0].host).toBe(DEFAULT_HOST_NAME);
        });

        it('selects the default bookmark as current when storage is empty', async () => {
            const service = createService();
            const current = await firstValueFrom(service.current);
            expect(current.name).toBe(DEFAULT_BOOKMARK_NAME);
        });

        it('persists the store and current selection on construction', () => {
            createService();
            expect(fakeStorage.setSpy).toHaveBeenCalledWith(BOOKMARK_LIST_STORAGE_KEY, expect.anything());
            expect(fakeStorage.setSpy).toHaveBeenCalledWith(CURRENT_BOOKMARK_STORAGE_KEY, DEFAULT_BOOKMARK_NAME);
        });

        it('loads a persisted BookmarkStorage object and rehydrates Bookmark instances', async () => {
            const service = createService({
                store: {
                    version: 1,
                    bookmarks: [
                        makeBookmark(DEFAULT_BOOKMARK_NAME, { host: DEFAULT_HOST_NAME, encryption: false }), makeBookmark('Remote'),
                    ],
                },
                current: 'Remote',
            });
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.map((b) => b.name)).toEqual([DEFAULT_BOOKMARK_NAME, 'Remote']);
            expect(bookmarks[1]).toBeInstanceOf(Bookmark);
            const current = await firstValueFrom(service.current);
            expect(current.name).toBe('Remote');
        });

        it('migrates a legacy array-shaped store into the versioned store', async () => {
            const service = createService({
                store: [
                    makeBookmark(DEFAULT_BOOKMARK_NAME, { host: DEFAULT_HOST_NAME, encryption: false }), makeBookmark('Legacy'),
                ] as unknown as Bookmark[],
            });
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.map((b) => b.name)).toContain('Legacy');
            const current = await firstValueFrom(service.current);
            expect(current.name).toBe(DEFAULT_BOOKMARK_NAME);
        });

        it('clears any persisted onConnectStartingPath at load time', async () => {
            const service = createService({
                store: {
                    version: 1,
                    bookmarks: [
                        makeBookmark(DEFAULT_BOOKMARK_NAME, { host: DEFAULT_HOST_NAME, encryption: false }), makeBookmark('Remote', { onConnectStartingPath: '/some/path' }),
                    ],
                },
            });
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.every((b) => b.onConnectStartingPath === null)).toBe(true);
        });

        it('falls back to default selection when the persisted current name is unknown', async () => {
            const service = createService({
                store: {
                    version: 1,
                    bookmarks: [makeBookmark(DEFAULT_BOOKMARK_NAME, { host: DEFAULT_HOST_NAME, encryption: false })],
                },
                current: 'DoesNotExist',
            });
            const current = await firstValueFrom(service.current);
            expect(current.name).toBe(DEFAULT_BOOKMARK_NAME);
        });
    });

    describe('validation', () => {
        it('re-inserts the default daemon when it is missing from the store', async () => {
            const service = createService({
                store: {
                    version: 1,
                    bookmarks: [makeBookmark('Remote')],
                },
                current: 'Remote',
            });
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.some((b) => b.name === DEFAULT_BOOKMARK_NAME)).toBe(true);
        });

        it('forces the default daemon host and non-default encryption during validation', async () => {
            const service = createService({
                store: {
                    version: 1,
                    bookmarks: [
                        makeBookmark(DEFAULT_BOOKMARK_NAME, { host: 'tampered.example', encryption: true }), makeBookmark('Remote', { encryption: false }),
                    ],
                },
            });
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            const def = bookmarks.find((b) => b.name === DEFAULT_BOOKMARK_NAME)!;
            const remote = bookmarks.find((b) => b.name === 'Remote')!;
            expect(def.host).toBe(DEFAULT_HOST_NAME);
            expect(remote.encryption).toBe(true);
        });
    });

    describe('getByName / isDefaultLocalDaemon', () => {
        it('returns the matching bookmark or undefined', () => {
            const service = createService({
                store: { version: 1, bookmarks: [makeBookmark(DEFAULT_BOOKMARK_NAME, { host: DEFAULT_HOST_NAME }), makeBookmark('Remote')] },
            });
            expect(service.getByName('Remote')?.name).toBe('Remote');
            expect(service.getByName('Nope')).toBeUndefined();
        });

        it('identifies the default local daemon bookmark', () => {
            const service = createService();
            expect(service.isDefaultLocalDaemon(makeBookmark(DEFAULT_BOOKMARK_NAME))).toBe(true);
            expect(service.isDefaultLocalDaemon(makeBookmark('Remote'))).toBe(false);
        });
    });

    describe('setSelection', () => {
        it('updates the current observable and persists the selection', async () => {
            const service = createService({
                store: { version: 1, bookmarks: [makeBookmark(DEFAULT_BOOKMARK_NAME, { host: DEFAULT_HOST_NAME }), makeBookmark('Remote')] },
            });
            fakeStorage.setSpy.mockClear();
            service.setSelection('Remote');
            const current = await firstValueFrom(service.current);
            expect(current.name).toBe('Remote');
            expect(fakeStorage.setSpy).toHaveBeenCalledWith(CURRENT_BOOKMARK_STORAGE_KEY, 'Remote');
        });

        it('throws when selecting a bookmark that does not exist', () => {
            const service = createService();
            expect(() => service.setSelection('Ghost')).toThrowError(/No such bookmark found: Ghost/);
        });

        it('emits the new selection to current subscribers', async () => {
            const service = createService({
                store: { version: 1, bookmarks: [makeBookmark(DEFAULT_BOOKMARK_NAME, { host: DEFAULT_HOST_NAME }), makeBookmark('Remote')] },
            });
            const emissions = firstValueFrom(service.current.pipe(take(2), toArray()));
            service.setSelection('Remote');
            const names = (await emissions).map((b) => b.name);
            expect(names).toEqual([DEFAULT_BOOKMARK_NAME, 'Remote']);
        });
    });

    describe('add', () => {
        it('adds a new bookmark and emits the updated list', async () => {
            const service = createService();
            const added = service.add(makeBookmark('Remote'));
            expect(added).toBe(true);
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.map((b) => b.name)).toContain('Remote');
        });

        it('returns false and does not duplicate an existing name', async () => {
            const service = createService();
            expect(service.add(makeBookmark('Remote'))).toBe(true);
            expect(service.add(makeBookmark('Remote', { host: 'other.example' }))).toBe(false);
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.filter((b) => b.name === 'Remote')).toHaveLength(1);
        });

        it('persists the store when a bookmark is added', () => {
            const service = createService();
            fakeStorage.setSpy.mockClear();
            service.add(makeBookmark('Remote'));
            expect(fakeStorage.setSpy).toHaveBeenCalledWith(BOOKMARK_LIST_STORAGE_KEY, expect.anything());
        });
    });

    describe('edit', () => {
        it('replaces the bookmark with the matching name', async () => {
            const service = createService();
            service.add(makeBookmark('Remote', { port: 1111 }));
            service.edit(makeBookmark('Remote', { port: 2222 }));
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.find((b) => b.name === 'Remote')?.port).toBe(2222);
        });

        it('leaves other bookmarks untouched', async () => {
            const service = createService();
            service.add(makeBookmark('Remote', { port: 1111 }));
            service.edit(makeBookmark('Remote', { port: 2222 }));
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.find((b) => b.name === DEFAULT_BOOKMARK_NAME)).toBeDefined();
        });
    });

    describe('delete', () => {
        it('refuses to delete the default daemon and returns an ERROR result', async () => {
            const service = createService();
            const result = service.delete(DEFAULT_BOOKMARK_NAME);
            expect(result?.level).toBe(PanelLevel.ERROR);
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.some((b) => b.name === DEFAULT_BOOKMARK_NAME)).toBe(true);
        });

        it('removes a non-default bookmark and returns an INFO result', async () => {
            const service = createService();
            service.add(makeBookmark('Remote'));
            const result = service.delete('Remote');
            expect(result?.level).toBe(PanelLevel.INFO);
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.some((b) => b.name === 'Remote')).toBe(false);
        });

        it('reassigns the current selection to the default when the active bookmark is deleted', async () => {
            const service = createService({
                store: { version: 1, bookmarks: [makeBookmark(DEFAULT_BOOKMARK_NAME, { host: DEFAULT_HOST_NAME }), makeBookmark('Remote')] },
                current: 'Remote',
            });
            const result = service.delete('Remote');
            expect(result?.level).toBe(PanelLevel.INFO);
            const current = await firstValueFrom(service.current);
            expect(current.name).toBe(DEFAULT_BOOKMARK_NAME);
        });
    });

    describe('favorite paths', () => {
        it('adds a favorite path to an existing bookmark and returns SUCCESS', async () => {
            const service = createService();
            const remote = makeBookmark('Remote');
            service.add(remote);
            const result = service.addFavoritePath(remote, '/media/clips');
            expect(result?.level).toBe(PanelLevel.SUCCESS);
            const bookmarks = await firstValueFrom(service.getAllBookmarks);
            expect(bookmarks.find((b) => b.name === 'Remote')?.favoritePaths).toContain('/media/clips');
        });

        it('strips a trailing slash when storing a favorite path', () => {
            const service = createService();
            const remote = makeBookmark('Remote');
            service.add(remote);
            service.addFavoritePath(remote, '/media/clips/');
            expect(remote.favoritePaths).toContain('/media/clips');
            expect(remote.favoritePaths).not.toContain('/media/clips/');
        });

        it('returns ERROR when adding a favorite path to a bookmark that does not exist', () => {
            const service = createService();
            const result = service.addFavoritePath(makeBookmark('Ghost'), '/media');
            expect(result?.level).toBe(PanelLevel.ERROR);
        });

        it('returns ERROR when the favorite path already exists', () => {
            const service = createService();
            const remote = makeBookmark('Remote', { favoritePaths: ['/media'] });
            service.add(remote);
            const result = service.addFavoritePath(remote, '/media');
            expect(result?.level).toBe(PanelLevel.ERROR);
        });

        it('reports whether a bookmark has a favorite path (slash-normalized)', () => {
            const service = createService();
            const remote = makeBookmark('Remote', { favoritePaths: ['/media'] });
            expect(service.hasFavoritePath(remote, '/media/')).toBe(true);
            expect(service.hasFavoritePath(remote, '/other')).toBe(false);
        });

        it('deletes an existing favorite path and returns SUCCESS', () => {
            const service = createService();
            const remote = makeBookmark('Remote', { favoritePaths: ['/media', '/keep'] });
            service.add(remote);
            const result = service.deleteFavoritePath(remote, '/media');
            expect(result?.level).toBe(PanelLevel.SUCCESS);
            expect(remote.favoritePaths).toEqual(['/keep']);
        });

        it('returns null when deleting a favorite path that is not present', () => {
            const service = createService();
            const remote = makeBookmark('Remote', { favoritePaths: ['/keep'] });
            service.add(remote);
            const result = service.deleteFavoritePath(remote, '/missing');
            expect(result).toBeNull();
            expect(remote.favoritePaths).toEqual(['/keep']);
        });

        it('returns ERROR when deleting a favorite path from a bookmark that does not exist', () => {
            const service = createService();
            const result = service.deleteFavoritePath(makeBookmark('Ghost'), '/media');
            expect(result?.level).toBe(PanelLevel.ERROR);
        });
    });
});
