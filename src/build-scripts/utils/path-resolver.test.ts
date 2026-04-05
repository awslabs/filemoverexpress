import * as path from 'path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {toPosix} from './normalize-path';
import {PathResolver} from './path-resolver';

// Mock the fs module
vi.mock('fs', () => ({
    existsSync: vi.fn(),
}));

describe('PathResolver', () => {
    let mockExistsSync: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        // Reset the cached project root before each test
        (PathResolver as any).projectRoot = null;

        // Get the mocked existsSync function
        const fs = await import('fs');
        mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
        mockExistsSync.mockClear();
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('getProjectRoot', () => {
        it('should find project root by detecting package.json, src, and src/build-scripts', () => {
            // Arrange
            // Mock fs.existsSync to return true for the expected structure
            mockExistsSync.mockReturnValue(true);

            // Act
            const result = PathResolver.getProjectRoot();

            // Assert
            expect(result).toBeTruthy();
            expect(path.isAbsolute(result)).toBe(true);
            expect(mockExistsSync).toHaveBeenCalled();
            // Verify it found a directory with the expected structure
            expect(result).toContain('build-scripts');
        });

        it('should cache project root after first call', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);

            // Act
            const result1 = PathResolver.getProjectRoot();
            const callCountAfterFirst = mockExistsSync.mock.calls.length;
            const result2 = PathResolver.getProjectRoot();
            const callCountAfterSecond = mockExistsSync.mock.calls.length;

            // Assert
            expect(result1).toBe(result2);
            expect(callCountAfterSecond).toBe(callCountAfterFirst); // No additional calls
        });

        it('should throw error when project root cannot be found', () => {
            // Arrange
            mockExistsSync.mockReturnValue(false);

            // Act & Assert
            expect(() => PathResolver.getProjectRoot()).toThrow('Could not find project root directory');
        });

        it('should traverse up directory tree until root is found', () => {
            // Arrange
            let callCount = 0;

            mockExistsSync.mockImplementation(() => {
                callCount++;
                // Only return true after a few calls to simulate traversal
                return callCount > 3;
            });

            // Act
            const result = PathResolver.getProjectRoot();

            // Assert
            expect(result).toBeTruthy();
            expect(path.isAbsolute(result)).toBe(true);
            expect(callCount).toBeGreaterThan(3);
        });
    });

    describe('getCLIDir', () => {
        it('should return correct CLI directory path', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);
            const projectRoot = PathResolver.getProjectRoot();
            const expectedPath = toPosix(path.join(projectRoot, 'src', 'cli'));

            // Act
            const result = PathResolver.getCLIDir();

            // Assert
            expect(result).toBe(expectedPath);
            expect(result).toContain('src');
            expect(result).toContain('cli');
        });

        it('should use cached project root', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);
            PathResolver.getProjectRoot(); // Prime the cache
            const callCountAfterPrime = mockExistsSync.mock.calls.length;

            // Act
            PathResolver.getCLIDir();
            const callCountAfterGetCLI = mockExistsSync.mock.calls.length;

            // Assert
            expect(callCountAfterGetCLI).toBe(callCountAfterPrime); // No additional calls
        });
    });

    describe('getGUIDir', () => {
        it('should return correct GUI directory path', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);
            const projectRoot = PathResolver.getProjectRoot();
            const expectedPath = toPosix(path.join(projectRoot, 'src', 'gui'));

            // Act
            const result = PathResolver.getGUIDir();

            // Assert
            expect(result).toBe(expectedPath);
            expect(result).toContain('src');
            expect(result).toContain('gui');
        });

        it('should use cached project root', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);
            PathResolver.getProjectRoot(); // Prime the cache
            const callCountAfterPrime = mockExistsSync.mock.calls.length;

            // Act
            PathResolver.getGUIDir();
            const callCountAfterGetGUI = mockExistsSync.mock.calls.length;

            // Assert
            expect(callCountAfterGetGUI).toBe(callCountAfterPrime); // No additional calls
        });
    });

    describe('getElectronDir', () => {
        it('should return correct Electron directory path', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);
            const projectRoot = PathResolver.getProjectRoot();
            const expectedPath = toPosix(path.join(projectRoot, 'src', 'electron'));

            // Act
            const result = PathResolver.getElectronDir();

            // Assert
            expect(result).toBe(expectedPath);
            expect(result).toContain('src');
            expect(result).toContain('electron');
        });
    });

    describe('getBuildScriptsDir', () => {
        it('should return correct build-scripts directory path', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);
            const projectRoot = PathResolver.getProjectRoot();
            const expectedPath = toPosix(path.join(projectRoot, 'src', 'build-scripts'));

            // Act
            const result = PathResolver.getBuildScriptsDir();

            // Assert
            expect(result).toBe(expectedPath);
            expect(result).toContain('src');
            expect(result).toContain('build-scripts');
        });
    });

    describe('getProtobufDir', () => {
        it('should return correct protobuf directory path', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);
            const projectRoot = PathResolver.getProjectRoot();
            const expectedPath = toPosix(path.join(projectRoot, 'src', 'protobuf'));

            // Act
            const result = PathResolver.getProtobufDir();

            // Assert
            expect(result).toBe(expectedPath);
            expect(result).toContain('src');
            expect(result).toContain('protobuf');
        });
    });

    describe('resolve', () => {
        it('should resolve single path segment', () => {
            // Arrange
            const segment = 'test-file.txt';

            // Act
            const result = PathResolver.resolve(segment);

            // Assert
            expect(path.isAbsolute(result)).toBe(true);
            expect(result).toContain('test-file.txt');
        });

        it('should resolve multiple path segments', () => {
            // Arrange
            const segments = ['src', 'utils', 'helper.ts'];

            // Act
            const result = PathResolver.resolve(...segments);

            // Assert
            expect(path.isAbsolute(result)).toBe(true);
            expect(result).toContain('src');
            expect(result).toContain('utils');
            expect(result).toContain('helper.ts');
        });

        it('should resolve absolute path', () => {
            // Arrange
            const absolutePath = toPosix(path.resolve('/absolute/path/to/file.txt'));

            // Act
            const result = PathResolver.resolve(absolutePath);

            // Assert
            expect(result).toBe(absolutePath);
            expect(path.isAbsolute(result)).toBe(true);
        });

        it('should resolve relative path from current directory', () => {
            // Arrange
            const relativePath = './relative/path.txt';

            // Act
            const result = PathResolver.resolve(relativePath);

            // Assert
            expect(path.isAbsolute(result)).toBe(true);
            expect(result).toContain('relative');
            expect(result).toContain('path.txt');
        });

        it('should handle empty segments', () => {
            // Act
            const result = PathResolver.resolve();

            // Assert
            expect(path.isAbsolute(result)).toBe(true);
        });

        it('should normalize path separators', () => {
            // Arrange
            const segments = ['src', 'utils', 'helper.ts'];

            // Act
            const result = PathResolver.resolve(...segments);

            // Assert
            expect(result).toBe(toPosix(path.resolve(...segments)));
        });

        it('should handle parent directory references', () => {
            // Arrange
            const segments = ['src', '..', 'dist', 'output.js'];

            // Act
            const result = PathResolver.resolve(...segments);

            // Assert
            expect(path.isAbsolute(result)).toBe(true);
            expect(result).toContain('dist');
            expect(result).toContain('output.js');
        });
    });

    describe('component directory resolution integration', () => {
        it('should return different paths for each component', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);

            // Act
            const cliDir = PathResolver.getCLIDir();
            const guiDir = PathResolver.getGUIDir();
            const electronDir = PathResolver.getElectronDir();
            const buildScriptsDir = PathResolver.getBuildScriptsDir();
            const protobufDir = PathResolver.getProtobufDir();

            // Assert
            expect(cliDir).not.toBe(guiDir);
            expect(cliDir).not.toBe(electronDir);
            expect(guiDir).not.toBe(electronDir);
            expect(buildScriptsDir).not.toBe(protobufDir);
        });

        it('should all share the same project root', () => {
            // Arrange
            mockExistsSync.mockReturnValue(true);
            const projectRoot = PathResolver.getProjectRoot();

            // Act
            const cliDir = PathResolver.getCLIDir();
            const guiDir = PathResolver.getGUIDir();
            const electronDir = PathResolver.getElectronDir();
            const buildScriptsDir = PathResolver.getBuildScriptsDir();
            const protobufDir = PathResolver.getProtobufDir();

            // Assert
            expect(cliDir.startsWith(projectRoot)).toBe(true);
            expect(guiDir.startsWith(projectRoot)).toBe(true);
            expect(electronDir.startsWith(projectRoot)).toBe(true);
            expect(buildScriptsDir.startsWith(projectRoot)).toBe(true);
            expect(protobufDir.startsWith(projectRoot)).toBe(true);
        });
    });
});
