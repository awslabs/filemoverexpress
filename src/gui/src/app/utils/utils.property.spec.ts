import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import * as utils from './utils';

/**
 * Property-based tests for utility functions.
 * Validates: Requirements 8.1, 8.4
 */

describe('[utils] formatBytes - property tests', () => {
    it('should always return a non-empty string with a valid unit for any non-negative input', () => {
        fc.assert(
            fc.property(fc.nat(), (bytes) => {
                const result = utils.formatBytes(bytes);
                expect(result.length).toBeGreaterThan(0);
                expect(result).toMatch(/(Bytes|KiB|MiB|GiB|TiB|PiB|EiB|ZiB|YiB)/);
            }),
        );
    });

    it('should return "0 Bytes" for any negative input', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -2147483648, max: -1 }),
                (bytes) => {
                    expect(utils.formatBytes(bytes)).toBe('0 Bytes');
                },
            ),
        );
    });

    it('should be monotonically non-decreasing when inputs share the same unit', () => {
        fc.assert(
            fc.property(fc.nat(), fc.nat(), (a, b) => {
                if (a <= b) {
                    const resultA = utils.formatBytes(a);
                    const resultB = utils.formatBytes(b);
                    const unitA = resultA.split(' ').slice(1).join(' ');
                    const unitB = resultB.split(' ').slice(1).join(' ');
                    // Only compare numeric values when the unit is the same
                    if (unitA === unitB) {
                        const valA = parseFloat(resultA);
                        const valB = parseFloat(resultB);
                        expect(valA).toBeLessThanOrEqual(valB);
                    }
                }
            }),
        );
    });

    it('should always produce a parseable numeric value followed by a space and unit', () => {
        fc.assert(
            fc.property(fc.nat({ max: Number.MAX_SAFE_INTEGER }), (bytes) => {
                const result = utils.formatBytes(bytes);
                const parts = result.split(' ');
                expect(parts.length).toBe(2);
                const numericPart = parseFloat(parts[0]);
                expect(numericPart).toBeGreaterThanOrEqual(0);
                expect(Number.isNaN(numericPart)).toBe(false);
            }),
        );
    });
});

describe('[utils] dirName - property tests', () => {
    it('result should end with delimiter when input contains the delimiter and is not empty', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{1,5}$/), { minLength: 1, maxLength: 5 }),
                (segments) => {
                    const path = segments.join('/');
                    const result = utils.dirName(path);
                    if (result !== '' && path.includes('/')) {
                        expect(result.endsWith('/')).toBe(true);
                    }
                },
            ),
        );
    });

    it('should return the input unchanged if input already ends with the delimiter', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{1,5}$/), { minLength: 1, maxLength: 5 }),
                (segments) => {
                    const path = segments.join('/') + '/';
                    expect(utils.dirName(path)).toBe(path);
                },
            ),
        );
    });

    it('should return empty string for empty input', () => {
        expect(utils.dirName('')).toBe('');
    });
});

describe('[utils] basename - property tests', () => {
    it('result should never contain the separator for paths with at least one separator', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e1-3]{1,5}$/), { minLength: 2, maxLength: 6 }),
                (segments) => {
                    const path = segments.join('/');
                    const result = utils.basename(path);
                    expect(result).not.toContain('/');
                },
            ),
        );
    });

    it('result should be the last segment of the path', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-e]{1,5}$/), { minLength: 2, maxLength: 5 }),
                (segments) => {
                    const path = segments.join('/');
                    const result = utils.basename(path);
                    expect(result).toBe(segments[segments.length - 1]);
                },
            ),
        );
    });

    it('result should strip trailing delimiter before extracting base name', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-d]{1,5}$/), { minLength: 2, maxLength: 5 }),
                (segments) => {
                    const pathWithTrailing = segments.join('/') + '/';
                    const pathWithout = segments.join('/');
                    expect(utils.basename(pathWithTrailing)).toBe(utils.basename(pathWithout));
                },
            ),
        );
    });
});

describe('[utils] trimPrefixSuffix - property tests', () => {
    it('should be idempotent - applying twice gives same result as once', () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), fc.string(), (full, prefix, suffix) => {
                const once = utils.trimPrefixSuffix(full, prefix, suffix);
                const twice = utils.trimPrefixSuffix(once, prefix, suffix);
                expect(twice).toBe(once);
            }),
        );
    });

    it('should return the original string when prefix and suffix do not match', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1 }),
                (str) => {
                    // Use a prefix/suffix that cannot possibly match
                    const impossiblePrefix = str + '$$NOMATCH$$';
                    const impossibleSuffix = '$$NOMATCH$$' + str;
                    expect(utils.trimPrefixSuffix(str, impossiblePrefix, impossibleSuffix)).toBe(str);
                },
            ),
        );
    });

    it('should produce a result that is shorter or equal to the original', () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), fc.string(), (full, prefix, suffix) => {
                const result = utils.trimPrefixSuffix(full, prefix, suffix);
                expect(result.length).toBeLessThanOrEqual(full.length);
            }),
        );
    });

    it('trimming with empty prefix and suffix returns the original string', () => {
        fc.assert(
            fc.property(fc.string(), (str) => {
                expect(utils.trimPrefixSuffix(str, '', '')).toBe(str);
            }),
        );
    });
});
