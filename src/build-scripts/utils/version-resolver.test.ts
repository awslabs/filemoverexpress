import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';

// Mock the fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
}));

// Mock the PathResolver module
vi.mock('./path-resolver', () => ({
    PathResolver: {
        getProjectRoot: vi.fn(),
    },
}));

describe('resolveVersion', () => {
    let mockReadFileSync: ReturnType<typeof vi.fn>;
    let mockGetProjectRoot: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        const fs = await import('fs');
        mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
        mockReadFileSync.mockClear();

        const {PathResolver} = await import('./path-resolver');
        mockGetProjectRoot = PathResolver.getProjectRoot as ReturnType<typeof vi.fn>;
        mockGetProjectRoot.mockClear();
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('undefined input (fallback to package.json)', () => {
        it('should return root package.json version when input is undefined', async () => {
            // Arrange
            mockGetProjectRoot.mockReturnValue('/fake/project/root');
            mockReadFileSync.mockReturnValue(JSON.stringify({version: '2.5.0'}));

            // Act
            const {resolveVersion} = await import('./version-resolver');
            const result = resolveVersion(undefined);

            // Assert
            expect(result).toBe('2.5.0');
            expect(mockGetProjectRoot).toHaveBeenCalled();
            expect(mockReadFileSync).toHaveBeenCalledWith(
                expect.stringContaining('package.json'),
                'utf-8',
            );
        });
    });

    describe('empty string input', () => {
        it('should throw when input is an empty string', async () => {
            // Arrange
            const {resolveVersion} = await import('./version-resolver');

            // Act & Assert
            expect(() => resolveVersion('')).toThrow(
                '--build-version cannot be an empty string',
            );
        });
    });

    describe('v/V prefix stripping', () => {
        it('should strip lowercase v prefix: v1.2.3 → 1.2.3', async () => {
            // Arrange
            const {resolveVersion} = await import('./version-resolver');

            // Act
            const result = resolveVersion('v1.2.3');

            // Assert
            expect(result).toBe('1.2.3');
        });

        it('should strip uppercase V prefix with pre-release: V2.0.0-beta.1 → 2.0.0-beta.1', async () => {
            // Arrange
            const {resolveVersion} = await import('./version-resolver');

            // Act
            const result = resolveVersion('V2.0.0-beta.1');

            // Assert
            expect(result).toBe('2.0.0-beta.1');
        });
    });

    describe('partial version coercion', () => {
        it('should coerce partial version 1.2 → 1.2.0', async () => {
            // Arrange
            const {resolveVersion} = await import('./version-resolver');

            // Act
            const result = resolveVersion('1.2');

            // Assert
            expect(result).toBe('1.2.0');
        });
    });

    describe('invalid version input', () => {
        it('should throw a descriptive error for invalid version string', async () => {
            // Arrange
            const {resolveVersion} = await import('./version-resolver');

            // Act & Assert
            expect(() => resolveVersion('not-a-version')).toThrow(
                'Invalid semantic version: "not-a-version". Expected format: MAJOR.MINOR.PATCH (e.g. 1.2.3)',
            );
        });
    });
});
