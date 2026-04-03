import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {ProtobufBuilder} from './protobuf-builder';

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
        getProtobufDir: vi.fn(() => '/mock/project/root/protobuf'),
    },
}));

describe('ProtobufBuilder', () => {
    beforeEach(async () => {
        // Reset all mocks before each test
        const {rm} = await import('node:fs/promises');
        const {CommandRunner} = await import('../utils/command-runner');
        const {Logger} = await import('../utils/logger');

        vi.mocked(rm).mockReset();
        vi.mocked(CommandRunner.run).mockReset();
        vi.mocked(Logger.debug).mockReset();
        vi.mocked(Logger.error).mockReset();
        vi.mocked(Logger.info).mockReset();
        vi.mocked(Logger.warn).mockReset();
        vi.mocked(Logger.success).mockReset();

        // Mock CommandRunner.run to succeed by default
        vi.mocked(CommandRunner.run).mockResolvedValue({
            exitCode: 0,
            stdout: '',
            stderr: '',
        });

        // Mock rm to succeed by default
        vi.mocked(rm).mockResolvedValue(undefined);
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('build', () => {
        describe('successful protobuf generation', () => {
            it('should execute npx buf generate in protobuf directory', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'Generated protobuf files',
                    stderr: '',
                });

                // Act
                await builder.build();

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'npx',
                    ['buf', 'generate'],
                    expect.objectContaining({
                        cwd: '/mock/project/root/protobuf',
                        verbose: true,
                    }),
                );
            });

            it('should log info message before generation', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build();

                // Assert
                expect(Logger.info).toHaveBeenCalledWith(
                    'Generating protobuf clients and interfaces...',
                );
            });

            it('should log success message after successful generation', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build();

                // Assert
                expect(Logger.success).toHaveBeenCalledWith(
                    'Protobuf clients and interfaces generated successfully',
                );
            });

            it('should use correct working directory', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {PathResolver} = await import('../utils/path-resolver');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build();

                // Assert
                expect(PathResolver.getProtobufDir).toHaveBeenCalled();
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'npx',
                    ['buf', 'generate'],
                    expect.objectContaining({
                        cwd: '/mock/project/root/protobuf',
                    }),
                );
            });

            it('should enable verbose mode for command execution', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act
                await builder.build();

                // Assert
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'npx',
                    ['buf', 'generate'],
                    expect.objectContaining({
                        verbose: true,
                    }),
                );
            });

            it('should handle generation with stdout output', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'Generating TypeScript files...\nGeneration completed',
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should handle generation with warnings in stderr', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'Generation successful',
                    stderr: 'Warning: Deprecated field usage',
                });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should accept arbitrary arguments without error', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.build('arg1', {option: 'value'})).resolves.not.toThrow();
            });
        });

        describe('error handling', () => {
            it('should throw error when buf generate returns non-zero exit code', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'protobuf compilation error',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow(
                    'Protobuf generation failed with exit code 1',
                );
            });

            it('should include stderr in error message when generation fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 2,
                    stdout: '',
                    stderr: 'fatal error: cannot find proto files',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow(
                    'fatal error: cannot find proto files',
                );
            });

            it('should include command in error message when generation fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'error',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow(/Command: npx buf generate/);
            });

            it('should log error message when generation fails', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'error',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow();
                expect(Logger.error).toHaveBeenCalledWith('Protobuf generation failed');
            });

            it('should handle npx command not found error', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 127,
                    stdout: '',
                    stderr: 'npx: command not found',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow(
                    'Protobuf generation failed with exit code 127',
                );
            });

            it('should handle buf not installed error', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'buf: command not found',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow('buf: command not found');
            });

            it('should handle permission denied error', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'EACCES: permission denied',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow('EACCES: permission denied');
            });

            it('should handle invalid proto file syntax error', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'syntax error: unexpected token at line 10',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow(
                    'syntax error: unexpected token at line 10',
                );
            });

            it('should throw error when CommandRunner.run throws', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockRejectedValue(new Error('Command execution failed'));

                // Act & Assert
                await expect(builder.build()).rejects.toThrow('Command execution failed');
            });
        });

        describe('edge cases', () => {
            it('should handle empty stdout from successful generation', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should handle large stdout from generation', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                const largeOutput = 'Generating file...\n'.repeat(1000);
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: largeOutput,
                    stderr: '',
                });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should handle special characters in error messages', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 1,
                    stdout: '',
                    stderr: 'Error: "message" not found at /path/to/file.proto',
                });

                // Act & Assert
                await expect(builder.build()).rejects.toThrow(
                    'Error: "message" not found at /path/to/file.proto',
                );
            });

            it('should handle multiple warnings in stderr with exit code 0', async () => {
                // Arrange
                const {CommandRunner} = await import('../utils/command-runner');

                const builder = new ProtobufBuilder();

                const warnings = 'Warning: deprecated field\nWarning: unused import\nWarning: style issue';
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'Generation successful',
                    stderr: warnings,
                });

                // Act & Assert
                await expect(builder.build()).resolves.not.toThrow();
            });
        });
    });

    describe('cleanupPaths', () => {
        it('should return correct cleanup paths for protobuf generated files', () => {
            // Arrange
            const builder = new ProtobufBuilder();

            // Act
            const paths = (builder as any).cleanupPaths;

            // Assert
            expect(paths).toEqual([
                'src/cli/types/pbtypes/pbtypesconnect',
                'src/cli/types/pbtypes/*.pb.go',
                'src/gui/src/connect/gen',
            ]);
        });

        it('should return array with three paths', () => {
            // Arrange
            const builder = new ProtobufBuilder();

            // Act
            const paths = (builder as any).cleanupPaths;

            // Assert
            expect(Array.isArray(paths)).toBe(true);
            expect(paths).toHaveLength(3);
        });

        it('should include CLI protobuf types path', () => {
            // Arrange
            const builder = new ProtobufBuilder();

            // Act
            const paths = (builder as any).cleanupPaths;

            // Assert
            expect(paths).toContain('src/cli/types/pbtypes/pbtypesconnect');
        });

        it('should include CLI Go protobuf files pattern', () => {
            // Arrange
            const builder = new ProtobufBuilder();

            // Act
            const paths = (builder as any).cleanupPaths;

            // Assert
            expect(paths).toContain('src/cli/types/pbtypes/*.pb.go');
        });

        it('should include GUI generated connect path', () => {
            // Arrange
            const builder = new ProtobufBuilder();

            // Act
            const paths = (builder as any).cleanupPaths;

            // Assert
            expect(paths).toContain('src/gui/src/connect/gen');
        });
    });
});
