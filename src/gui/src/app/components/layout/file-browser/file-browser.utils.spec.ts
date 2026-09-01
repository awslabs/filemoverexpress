import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { MatSort } from '@angular/material/sort';
import { displayPathToGrpcPath } from '@app/utils/path-utils';
import { PREVIOUS_FOLDER_NAME } from './file-browser.constants';
import {
    FileBrowserFilter,
    FileBrowserObject,
    FileBrowserObjectType,
    FileBrowserType,
} from './file-browser.interfaces';
import {
    browserFilterPredicate,
    buildBrowserFilterString,
    cleanPath,
    destinationPathToFileBrowserPath,
    getOSFileBrowserName,
    getUppermostParentDirectory,
    sortFileBrowserRows,
    stringToFileBrowserType,
} from './file-browser.utils';

/**
 * Unit and property-based tests for the pure file-browser path/helper functions.
 * These are pure functions, so no TestBed is required.
 */

function makeObject(
    name: string,
    type: FileBrowserObjectType = FileBrowserObjectType.FILE,
    size: bigint | null = null,
    dateModified: Date | null = null,
): FileBrowserObject {
    return { name, type, size, dateModified };
}

function makeSort(active: string, direction: '' | 'asc' | 'desc'): MatSort {
    return { active, direction } as MatSort;
}

const ALL_TYPES: FileBrowserType[] = ['darwin',
    'linux',
    'windows',
    's3',
    'unknown'];

describe('[file-browser.utils] cleanPath', () => {
    it('should return an empty string unchanged', () => {
        expect(cleanPath('')).toBe('');
    });

    it('should strip leading and trailing delimiters', () => {
        expect(cleanPath('/folderA/folderB/')).toBe('folderA/folderB');
    });

    it('should collapse consecutive delimiters', () => {
        expect(cleanPath('folderA///folderB//file.txt')).toBe('folderA/folderB/file.txt');
    });

    it('should leave an already-clean path unchanged', () => {
        expect(cleanPath('folderA/folderB/file.txt')).toBe('folderA/folderB/file.txt');
    });

    it('should reduce a path of only delimiters to an empty string', () => {
        expect(cleanPath('///')).toBe('');
    });

    it('should honour a custom delimiter', () => {
        expect(cleanPath('\\folderA\\\\folderB\\', '\\')).toBe('folderA\\folderB');
    });
});

describe('[file-browser.utils] cleanPath - property tests', () => {
    it('should be idempotent - cleaning a cleaned path is a no-op', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{0,4}$/), { minLength: 0, maxLength: 6 }),
                (segments) => {
                    const raw = '/' + segments.join('//') + '/';
                    const once = cleanPath(raw);
                    const twice = cleanPath(once);
                    expect(twice).toBe(once);
                },
            ),
        );
    });

    it('should never start or end with the delimiter', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{0,4}$/), { minLength: 0, maxLength: 6 }),
                (segments) => {
                    const raw = '/' + segments.join('//') + '/';
                    const result = cleanPath(raw);
                    if (result.length > 0) {
                        expect(result.startsWith('/')).toBe(false);
                        expect(result.endsWith('/')).toBe(false);
                    }
                },
            ),
        );
    });

    it('should never contain consecutive delimiters', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{0,4}$/), { minLength: 0, maxLength: 6 }),
                (segments) => {
                    const raw = segments.join('//');
                    const result = cleanPath(raw);
                    expect(result).not.toContain('//');
                },
            ),
        );
    });

    it('should preserve the non-empty segments and their order', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{1,4}$/), { minLength: 1, maxLength: 6 }),
                (segments) => {
                    const raw = '/' + segments.join('/') + '/';
                    expect(cleanPath(raw)).toBe(segments.join('/'));
                },
            ),
        );
    });
});

describe('[file-browser.utils] getUppermostParentDirectory', () => {
    it('should return the uppermost parent for a nested path', () => {
        expect(getUppermostParentDirectory('folderA/folderB/file.txt')).toBe('folderA');
    });

    it('should return an empty string for a single segment', () => {
        expect(getUppermostParentDirectory('abcde')).toBe('');
    });

    it('should return an empty string for an empty path', () => {
        expect(getUppermostParentDirectory('')).toBe('');
    });

    it('should return an empty string when the path is just the delimiter', () => {
        expect(getUppermostParentDirectory('/')).toBe('');
    });

    it('should ignore leading delimiters when finding the parent', () => {
        expect(getUppermostParentDirectory('/folderA/folderB')).toBe('folderA');
    });

    it('should honour a custom delimiter', () => {
        expect(getUppermostParentDirectory('folderA\\folderB\\file', '\\')).toBe('folderA');
    });
});

describe('[file-browser.utils] getUppermostParentDirectory - property tests', () => {
    it('result should never contain the delimiter', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{1,4}$/), { minLength: 0, maxLength: 6 }),
                (segments) => {
                    const result = getUppermostParentDirectory(segments.join('/'));
                    expect(result).not.toContain('/');
                },
            ),
        );
    });

    it('should equal the first segment when there is more than one segment', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{1,4}$/), { minLength: 2, maxLength: 6 }),
                (segments) => {
                    expect(getUppermostParentDirectory(segments.join('/'))).toBe(segments[0]);
                },
            ),
        );
    });

    it('should return an empty string for a single non-empty segment', () => {
        fc.assert(
            fc.property(fc.stringMatching(/^[a-e]{1,8}$/), (segment) => {
                expect(getUppermostParentDirectory(segment)).toBe('');
            }),
        );
    });
});

describe('[file-browser.utils] stringToFileBrowserType', () => {
    it('should map each known OS string to its type', () => {
        expect(stringToFileBrowserType('darwin')).toBe('darwin');
        expect(stringToFileBrowserType('linux')).toBe('linux');
        expect(stringToFileBrowserType('windows')).toBe('windows');
        expect(stringToFileBrowserType('s3')).toBe('s3');
    });

    it('should map an unrecognised string to "unknown"', () => {
        expect(stringToFileBrowserType('beos')).toBe('unknown');
        expect(stringToFileBrowserType('')).toBe('unknown');
    });

    it('property: known types round-trip, all else is "unknown"', () => {
        fc.assert(
            fc.property(fc.string(), (input) => {
                const result = stringToFileBrowserType(input);
                if (input === 'darwin' || input === 'linux' || input === 'windows' || input === 's3') {
                    expect(result).toBe(input);
                } else {
                    expect(result).toBe('unknown');
                }
            }),
        );
    });
});

describe('[file-browser.utils] getOSFileBrowserName', () => {
    it('should return the native browser name for each OS', () => {
        expect(getOSFileBrowserName('darwin')).toBe('Finder');
        expect(getOSFileBrowserName('windows')).toBe('File Explorer');
        expect(getOSFileBrowserName('linux')).toBe('File Manager');
    });

    it('should return a generic name for non-native types', () => {
        expect(getOSFileBrowserName('s3')).toBe('OS File Browser');
        expect(getOSFileBrowserName('unknown')).toBe('OS File Browser');
    });

    it('property: always returns a non-empty string for any known type', () => {
        fc.assert(
            fc.property(fc.constantFrom(...ALL_TYPES), (type) => {
                expect(getOSFileBrowserName(type).length).toBeGreaterThan(0);
            }),
        );
    });
});

describe('[file-browser.utils] buildBrowserFilterString', () => {
    it('should lowercase and trim a non-empty name', () => {
        expect(buildBrowserFilterString({ name: '  MyFile.TXT  ' })).toBe(JSON.stringify({ name: 'myfile.txt' }));
    });

    it('should produce a null name for blank/whitespace input', () => {
        expect(buildBrowserFilterString({ name: '   ' })).toBe(JSON.stringify({ name: null }));
        expect(buildBrowserFilterString({ name: null })).toBe(JSON.stringify({ name: null }));
    });

    it('property: output is always valid JSON with a name field', () => {
        fc.assert(
            fc.property(fc.option(fc.string(), { nil: null }), (name) => {
                const result = buildBrowserFilterString({ name });
                const parsed: FileBrowserFilter = JSON.parse(result);
                expect('name' in parsed).toBe(true);
                if (parsed.name !== null) {
                    expect(parsed.name).toBe(parsed.name.trim().toLowerCase());
                }
            }),
        );
    });
});

describe('[file-browser.utils] browserFilterPredicate', () => {
    it('should keep every row for an empty filter term', () => {
        expect(browserFilterPredicate(makeObject('anything'), '')).toBe(true);
    });

    it('should always keep the previous-folder row regardless of filter', () => {
        const prev = makeObject(PREVIOUS_FOLDER_NAME, FileBrowserObjectType.FOLDER);
        expect(browserFilterPredicate(prev, buildBrowserFilterString({ name: 'zzz' }))).toBe(true);
    });

    it('should match rows whose basename contains the filter name', () => {
        const term = buildBrowserFilterString({ name: 'report' });
        expect(browserFilterPredicate(makeObject('folderA/Q3-Report.pdf'), term)).toBe(true);
        expect(browserFilterPredicate(makeObject('folderA/photo.png'), term)).toBe(false);
    });

    it('should keep all rows when the parsed filter has no name', () => {
        const term = buildBrowserFilterString({ name: '   ' });
        expect(browserFilterPredicate(makeObject('anything.txt'), term)).toBe(true);
    });

    it('property: an empty term always keeps the row', () => {
        fc.assert(
            fc.property(fc.string(), (name) => {
                expect(browserFilterPredicate(makeObject(name), '')).toBe(true);
            }),
        );
    });
});

describe('[file-browser.utils] sortFileBrowserRows', () => {
    it('should return the list untouched when there is no active column', () => {
        const rows = [makeObject('b'), makeObject('a')];
        expect(sortFileBrowserRows(rows, makeSort('', 'asc'))).toBe(rows);
    });

    it('should return the list untouched when the direction is empty', () => {
        const rows = [makeObject('b'), makeObject('a')];
        expect(sortFileBrowserRows(rows, makeSort('name', ''))).toBe(rows);
    });

    it('should sort by name case-insensitively ascending', () => {
        const rows = [makeObject('Banana'),
            makeObject('apple'),
            makeObject('Cherry')];
        const sorted = sortFileBrowserRows(rows, makeSort('name', 'asc'));
        expect(sorted.map((r) => r.name)).toEqual(['apple',
            'Banana',
            'Cherry']);
    });

    it('should reverse order for descending direction', () => {
        const rows = [makeObject('apple'),
            makeObject('Banana'),
            makeObject('Cherry')];
        const sorted = sortFileBrowserRows(rows, makeSort('name', 'desc'));
        expect(sorted.map((r) => r.name)).toEqual(['Cherry',
            'Banana',
            'apple']);
    });

    it('should keep the previous-folder row first regardless of direction', () => {
        const prev = makeObject(PREVIOUS_FOLDER_NAME, FileBrowserObjectType.FOLDER);
        const rows = [makeObject('apple'),
            prev,
            makeObject('zebra')];
        const asc = sortFileBrowserRows([...rows], makeSort('name', 'asc'));
        const desc = sortFileBrowserRows([...rows], makeSort('name', 'desc'));
        expect(asc[0].name).toBe(PREVIOUS_FOLDER_NAME);
        expect(desc[0].name).toBe(PREVIOUS_FOLDER_NAME);
    });

    it('should sort by size ascending, treating null as smallest', () => {
        const rows = [
            makeObject('big', FileBrowserObjectType.FILE, 100n),
            makeObject('none', FileBrowserObjectType.FILE, null),
            makeObject('small', FileBrowserObjectType.FILE, 10n),
        ];
        const sorted = sortFileBrowserRows(rows, makeSort('size', 'asc'));
        expect(sorted.map((r) => r.name)).toEqual(['none',
            'small',
            'big']);
    });

    it('should sort by dateModified ascending', () => {
        const rows = [
            makeObject('late', FileBrowserObjectType.FILE, null, new Date('2024-01-02')), makeObject('early', FileBrowserObjectType.FILE, null, new Date('2024-01-01')),
        ];
        const sorted = sortFileBrowserRows(rows, makeSort('dateModified', 'asc'));
        expect(sorted.map((r) => r.name)).toEqual(['early', 'late']);
    });

    it('property: sorting by name preserves the multiset of names', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-eA-E]{1,4}$/), { minLength: 0, maxLength: 8 }),
                fc.constantFrom<'asc' | 'desc'>('asc', 'desc'),
                (names, direction) => {
                    const rows = names.map((n) => makeObject(n));
                    const sorted = sortFileBrowserRows(rows, makeSort('name', direction));
                    expect([...sorted.map((r) => r.name)].sort()).toEqual([...names].sort());
                },
            ),
        );
    });
});

describe('[file-browser.utils] destinationPathToFileBrowserPath', () => {
    it('should delegate to displayPathToGrpcPath for each type', () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^[a-zA-Z0-9/\\.]{0,30}$/),
                fc.constantFrom(...ALL_TYPES),
                (destination, type) => {
                    expect(destinationPathToFileBrowserPath(destination, type)).toBe(
                        displayPathToGrpcPath(destination, type),
                    );
                },
            ),
        );
    });
});
