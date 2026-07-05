import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FormatBytesPipe } from './format-bytes.pipe';
import { TruncateStringPipe } from './truncate-string.pipe';
import { PascalCaseToSpacesPipe } from './pascal-case-to-spaces.pipe';
import { TextEllipsesPipe } from './text-ellipses.pipe';
import { BasenamePipe } from './basename.pipe';

/**
 * Property-based tests for Angular pipe transform functions.
 * Validates: Requirements 8.1, 8.4
 */

describe('[Pipes] FormatBytesPipe - property tests', () => {
    const pipe = new FormatBytesPipe();

    it('should be monotonically non-decreasing when inputs share the same unit (wraps formatBytes)', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
                fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
                (a, b) => {
                    const [small, large] = a <= b ? [a, b] : [b, a];
                    const resultSmall = pipe.transform(small, 2);
                    const resultLarge = pipe.transform(large, 2);
                    const unitSmall = resultSmall.split(' ').slice(1).join(' ');
                    const unitLarge = resultLarge.split(' ').slice(1).join(' ');
                    // Only compare numeric values when the unit is the same
                    if (unitSmall === unitLarge) {
                        const valSmall = parseFloat(resultSmall);
                        const valLarge = parseFloat(resultLarge);
                        expect(valSmall).toBeLessThanOrEqual(valLarge);
                    }
                },
            ),
        );
    });

    it('should return fallback or "Unknown" for zero/falsy values', () => {
        fc.assert(
            fc.property(fc.string({ minLength: 1 }), (fallback) => {
                const result = pipe.transform(0, 2, undefined, fallback);
                expect(result).toBe(fallback);
            }),
        );
    });
});

describe('[Pipes] TruncateStringPipe - property tests', () => {
    const pipe = new TruncateStringPipe();

    it('result length should be <= limit for any input with limit >= 3', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 200 }),
                fc.integer({ min: 3, max: 100 }),
                (value, limit) => {
                    const result = pipe.transform(value, limit);
                    // When truncation occurs (value.length > limit):
                    //   result = floor(limit/2) chars + '…' + (ceil(limit/2)-1) chars = limit chars total
                    // When no truncation (value.length <= limit):
                    //   result = value unchanged, so result.length <= limit
                    // In both cases, result.length <= limit
                    expect(result.length).toBeLessThanOrEqual(limit);
                },
            ),
        );
    });

    it('should preserve the original string if it is shorter than or equal to the limit', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 100 }),
                fc.integer({ min: 100, max: 200 }),
                (value, limit) => {
                    // Ensure limit is >= string length
                    const effectiveLimit = Math.max(value.length, limit);
                    const result = pipe.transform(value, effectiveLimit);
                    expect(result).toBe(value);
                },
            ),
        );
    });

    it('should always preserve original string when length equals the limit', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 100 }),
                (value) => {
                    const result = pipe.transform(value, value.length);
                    expect(result).toBe(value);
                },
            ),
        );
    });
});

describe('[Pipes] PascalCaseToSpacesPipe - property tests', () => {
    const pipe = new PascalCaseToSpacesPipe();

    it('output length should be >= input length (spaces are only added, never removed)', () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^[a-zA-Z]{0,50}$/),
                (value) => {
                    const result = pipe.transform(value);
                    expect(result.length).toBeGreaterThanOrEqual(value.length);
                },
            ),
        );
    });

    it('should not have consecutive uppercase letters without a space between them in output', () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^[a-zA-Z]{0,50}$/),
                (value) => {
                    const result = pipe.transform(value);
                    // After transformation, any uppercase letter preceded by another letter
                    // should have a space before it
                    const hasConsecutiveUpperWithoutSpace = /[a-zA-Z][A-Z]/.test(result);
                    expect(hasConsecutiveUpperWithoutSpace).toBe(false);
                },
            ),
        );
    });

    it('should not alter strings that are already all lowercase', () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^[a-z]{0,50}$/),
                (value) => {
                    const result = pipe.transform(value);
                    expect(result).toBe(value);
                },
            ),
        );
    });
});

describe('[Pipes] TextEllipsesPipe - property tests', () => {
    const pipe = new TextEllipsesPipe();
    const ellipsisLength = 3; // '...' is 3 characters

    it('result length should be <= limit + ellipsis length for any input', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 200 }),
                fc.integer({ min: 1, max: 100 }),
                (value, limit) => {
                    const result = pipe.transform(value, limit);
                    expect(result.length).toBeLessThanOrEqual(limit + ellipsisLength);
                },
            ),
        );
    });

    it('should preserve content unchanged if string length is <= limit', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 50 }),
                (value) => {
                    // Use a limit larger than any generated string
                    const limit = value.length + 10;
                    const result = pipe.transform(value, limit);
                    expect(result).toBe(value);
                },
            ),
        );
    });

    it('should end with "..." when string is truncated', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 10, maxLength: 200 }),
                fc.integer({ min: 1, max: 9 }),
                (value, limit) => {
                    const result = pipe.transform(value, limit);
                    expect(result.endsWith('...')).toBe(true);
                },
            ),
        );
    });
});

describe('[Pipes] BasenamePipe - property tests', () => {
    const pipe = new BasenamePipe();

    it('result should never contain a forward slash path separator', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { minLength: 1, maxLength: 6 }),
                (segments) => {
                    const pathStr = segments.join('/');
                    const result = pipe.transform(pathStr);
                    expect(result).not.toContain('/');
                },
            ),
        );
    });

    it('should return empty string for empty/falsy input', () => {
        expect(pipe.transform('')).toBe('');
    });

    it('result should be the last segment of the path', () => {
        fc.assert(
            fc.property(
                fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { minLength: 2, maxLength: 6 }),
                (segments) => {
                    const pathStr = segments.join('/');
                    const result = pipe.transform(pathStr);
                    expect(result).toBe(segments[segments.length - 1]);
                },
            ),
        );
    });
});

/**
 * Property 3: Syntax Conversion Completeness
 * Validates: Requirements 8.4
 *
 * Meta-property test verifying that no .spec.ts files contain
 * Jasmine-specific API references (post-cutover validation).
 */
describe('[Meta] Syntax Conversion Completeness - no Jasmine APIs in spec files', () => {
    const jasminePatterns = [
        /jasmine\.createSpy/,
        /jasmine\.createSpyObj/,
        /jasmine\.any\(/,
        /jasmine\.objectContaining\(/,
        /jasmine\.arrayContaining\(/,
        /\.and\.returnValue\(/,
        /\.and\.callFake\(/,
        /\.and\.throwError\(/,
        /\.calls\.reset\(\)/,
        /\.toBeTrue\(\)/,
        /\.toBeFalse\(\)/,
        /import\s+.*from\s+['"]jasmine['"]/,
        /jasmine\.DEFAULT_TIMEOUT_INTERVAL/,
        /import\s+Spy\s*=\s*jasmine\.Spy/,
    ];

    function findSpecFiles(dir: string): string[] {
        const results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'gen') {
                results.push(...findSpecFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
                results.push(fullPath);
            }
        }
        return results;
    }

    const srcDir = path.resolve(__dirname, '..');
    const specFiles = findSpecFiles(srcDir);

    it('should find at least one .spec.ts file to validate', () => {
        expect(specFiles.length).toBeGreaterThan(0);
    });

    it('no .spec.ts file should contain Jasmine-specific APIs', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...specFiles),
                (filePath) => {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    for (const pattern of jasminePatterns) {
                        const match = content.match(pattern);
                        if (match) {
                            throw new Error(
                                `File "${filePath}" contains Jasmine API: "${match[0]}"`,
                            );
                        }
                    }
                },
            ),
            { numRuns: Math.min(specFiles.length, 100) },
        );
    });
});
