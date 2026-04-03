import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {BaseBuilder} from './base-builder';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
    rm: vi.fn(),
}));

vi.mock('../utils/command-runner', () => ({
    CommandRunner: {
        run: vi.fn(),
    },
}));

vi.mock('../utils/logger', () => ({
    Logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock('../utils/path-resolver', () => ({
    PathResolver: {
        getProjectRoot: vi.fn(() => '/mock/project/root'),
    },
}));

// Concrete implementation for testing
class TestBuilder extends BaseBuilder {
    cleanupPaths: string[];

    constructor(paths: string[]) {
        super();
        this.cleanupPaths = paths;
    }

    async build(): Promise<void> {
        // No-op for testing
    }
}

describe('BaseBuilder', () => {
    beforeEach(async () => {
        // Reset all mocks before each test
        const {rm} = await import('node:fs/promises');
        const {CommandRunner} = await import('../utils/command-runner');
        const {Logger} = await import('../utils/logger');

        vi.mocked(rm).mockReset();
        vi.mocked(CommandRunner.run).mockReset();
        vi.mocked(Logger.debug).mockReset();
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('clean', () => {
        describe('successful cleanup', () => {
            it('should remove all specified paths when no files are tracked in git', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const paths = ['dist', 'build', 'temp'];
                const builder = new TestBuilder(paths);

                // Mock git ls-files to return empty (no tracked files)
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Mock rm to succeed
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'git',
                    ['ls-files', ...paths],
                    {cwd: '/mock/project/root'},
                );

                expect(rm).toHaveBeenCalledTimes(3);
                expect(rm).toHaveBeenCalledWith('dist', {recursive: true, force: true});
                expect(rm).toHaveBeenCalledWith('build', {recursive: true, force: true});
                expect(rm).toHaveBeenCalledWith('temp', {recursive: true, force: true});
            });

            it('should call git ls-files with correct arguments', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const paths = ['output'];
                const builder = new TestBuilder(paths);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'git',
                    ['ls-files', 'output'],
                    {cwd: '/mock/project/root'},
                );
            });

            it('should use project root as cwd for git command', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');
                const {PathResolver} = await import('../utils/path-resolver');

                const builder = new TestBuilder(['dist']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(PathResolver.getProjectRoot).toHaveBeenCalled();
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'git',
                    expect.any(Array),
                    {cwd: '/mock/project/root'},
                );
            });

            it('should remove paths with recursive and force options', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['nested/path/to/remove']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(rm).toHaveBeenCalledWith(
                    'nested/path/to/remove',
                    {recursive: true, force: true},
                );
            });

            it('should log debug message for each successfully removed path', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const paths = ['dist', 'build'];
                const builder = new TestBuilder(paths);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Wait for all promises to resolve
                await new Promise(resolve => setTimeout(resolve, 0));

                // Assert
                expect(Logger.debug).toHaveBeenCalledWith('Successfully removed dist');
                expect(Logger.debug).toHaveBeenCalledWith('Successfully removed build');
            });
        });

        describe('git tracking check', () => {
            it('should throw error when git ls-files returns tracked files', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['dist']);

                // Mock git ls-files to return tracked files
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'dist/tracked-file.js\ndist/another-file.js',
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow(
                    'One or more files tracked in git, aborting removal',
                );
            });

            it('should throw error when git ls-files returns non-zero exit code', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['dist']);

                // Mock git ls-files to fail
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 128,
                    stdout: '',
                    stderr: 'fatal: not a git repository',
                });

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow(
                    'git ls-files failed: fatal: not a git repository',
                );
            });

            it('should not remove any files when tracked files are detected', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['dist', 'build']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'dist/tracked.js',
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow();
                expect(rm).not.toHaveBeenCalled();
            });

            it('should handle whitespace in git ls-files output', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['dist']);

                // Mock git ls-files with whitespace-only output (no tracked files)
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '   \n  \t  ',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert - should succeed because trimmed output is empty
                expect(rm).toHaveBeenCalledWith('dist', {recursive: true, force: true});
            });

            it('should throw error when git command rejects', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['dist']);

                // Mock git ls-files to reject
                vi.mocked(CommandRunner.run).mockRejectedValue(
                    new Error('Command execution failed'),
                );

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow(
                    'Failed to clean dist: Error: Command execution failed',
                );
            });
        });

        describe('error handling', () => {
            it('should throw error when rm fails', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['dist']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Mock rm to fail
                vi.mocked(rm).mockRejectedValue(new Error('EACCES: permission denied'));

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow(
                    'Failed to remove dist: Error: EACCES: permission denied',
                );
            });

            it('should throw error with path context when removal fails', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['protected/path']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                vi.mocked(rm).mockRejectedValue(new Error('Permission denied'));

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow(
                    'Failed to remove protected/path',
                );
            });

            it('should include original error message in thrown error', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['dist']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                const originalError = new Error('ENOSPC: no space left on device');
                vi.mocked(rm).mockRejectedValue(originalError);

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow(
                    'ENOSPC: no space left on device',
                );
            });

            it('should handle EACCES permission errors', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['dist']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                const eaccesError: any = new Error('Permission denied');
                eaccesError.code = 'EACCES';
                vi.mocked(rm).mockRejectedValue(eaccesError);

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow('Permission denied');
            });

            it('should handle ENOENT missing file errors', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['nonexistent']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                const enoentError: any = new Error('File not found');
                enoentError.code = 'ENOENT';
                vi.mocked(rm).mockRejectedValue(enoentError);

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow('File not found');
            });
        });

        describe('edge cases', () => {
            it('should handle empty cleanup paths array', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder([]);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.clean();

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'git',
                    ['ls-files'],
                    {cwd: '/mock/project/root'},
                );
                expect(rm).not.toHaveBeenCalled();
            });

            it('should handle single cleanup path', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['single-path']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(rm).toHaveBeenCalledTimes(1);
                expect(rm).toHaveBeenCalledWith('single-path', {recursive: true, force: true});
            });

            it('should handle paths with special characters', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const specialPath = 'path with spaces/and-dashes_underscores';
                const builder = new TestBuilder([specialPath]);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'git',
                    ['ls-files', specialPath],
                    {cwd: '/mock/project/root'},
                );
                expect(rm).toHaveBeenCalledWith(specialPath, {recursive: true, force: true});
            });

            it('should handle non-existent paths gracefully with force option', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new TestBuilder(['non-existent-path']);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // rm with force: true should succeed even if path doesn't exist
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(rm).toHaveBeenCalledWith(
                    'non-existent-path',
                    {recursive: true, force: true},
                );
            });

            it('should handle multiple paths with mixed results', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const paths = ['path1', 'path2', 'path3'];
                const builder = new TestBuilder(paths);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // First two succeed, third fails
                vi.mocked(rm)
                    .mockResolvedValueOnce(undefined)
                    .mockResolvedValueOnce(undefined)
                    .mockRejectedValueOnce(new Error('Failed to remove'));

                // Act & Assert
                await expect(builder.clean()).rejects.toThrow('Failed to remove path3');
            });

            it('should handle absolute paths', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const absolutePath = '/absolute/path/to/remove';
                const builder = new TestBuilder([absolutePath]);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(rm).toHaveBeenCalledWith(absolutePath, {recursive: true, force: true});
            });

            it('should handle relative paths with parent directory references', async () => {
                // Arrange
                const {rm} = await import('node:fs/promises');
                const {CommandRunner} = await import('../utils/command-runner');

                const relativePath = '../parent/path';
                const builder = new TestBuilder([relativePath]);

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });
                vi.mocked(rm).mockResolvedValue(undefined);

                // Act
                await builder.clean();

                // Assert
                expect(rm).toHaveBeenCalledWith(relativePath, {recursive: true, force: true});
            });
        });
    });
});
