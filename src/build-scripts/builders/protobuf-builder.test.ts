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

// Helper: builds a CommandRunner.run mock that handles the full call sequence:
//   1. `go env GOPATH`  → returns /mock/gopath
//   2. plugin --version checks → exitCode 0 means already installed
//   3. `npx buf generate` → configurable
function mockRunSequence({
    pluginsInstalled = true,
    bufExitCode = 0,
    bufStderr = '',
}: {
    pluginsInstalled?: boolean;
    bufExitCode?: number;
    bufStderr?: string;
} = {}) {
    return vi.fn().mockImplementation(async (cmd: string, args: string[]) => {
        // go env GOPATH
        if (cmd === 'go' && args[0] === 'env') {
            return {exitCode: 0, stdout: '/mock/gopath\n', stderr: ''};
        }
        // plugin version checks (called with full path to binary)
        if (args[0] === '--version') {
            return {exitCode: pluginsInstalled ? 0 : 1, stdout: '', stderr: ''};
        }
        // go install
        if (cmd === 'go' && args[0] === 'install') {
            return {exitCode: 0, stdout: '', stderr: ''};
        }
        // npx buf generate
        if (cmd === 'npx') {
            return {exitCode: bufExitCode, stdout: '', stderr: bufStderr};
        }
        return {exitCode: 0, stdout: '', stderr: ''};
    });
}

describe('ProtobufBuilder', () => {
    beforeEach(async () => {
        const {rm} = await import('node:fs/promises');
        const {Logger} = await import('../utils/logger');

        vi.mocked(rm).mockReset();
        vi.mocked(Logger.debug).mockReset();
        vi.mocked(Logger.error).mockReset();
        vi.mocked(Logger.info).mockReset();
        vi.mocked(Logger.warn).mockReset();
        vi.mocked(Logger.success).mockReset();
        vi.mocked(rm).mockResolvedValue(undefined);
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('build', () => {
        describe('successful protobuf generation', () => {
            it('should execute npx buf generate in protobuf directory', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence());

                const builder = new ProtobufBuilder();
                await builder.build();

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
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence());

                const builder = new ProtobufBuilder();
                await builder.build();

                expect(Logger.info).toHaveBeenCalledWith(
                    'Generating protobuf clients and interfaces...',
                );
            });

            it('should log success message after successful generation', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence());

                const builder = new ProtobufBuilder();
                await builder.build();

                expect(Logger.success).toHaveBeenCalledWith(
                    'Protobuf clients and interfaces generated successfully',
                );
            });

            it('should use correct working directory', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                const {PathResolver} = await import('../utils/path-resolver');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence());

                const builder = new ProtobufBuilder();
                await builder.build();

                expect(PathResolver.getProtobufDir).toHaveBeenCalled();
                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'npx',
                    ['buf', 'generate'],
                    expect.objectContaining({cwd: '/mock/project/root/protobuf'}),
                );
            });

            it('should enable verbose mode for buf generate', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence());

                const builder = new ProtobufBuilder();
                await builder.build();

                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'npx',
                    ['buf', 'generate'],
                    expect.objectContaining({verbose: true}),
                );
            });

            it('should accept arbitrary arguments without error', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence());

                const builder = new ProtobufBuilder();
                await expect(builder.build('arg1', {option: 'value'})).resolves.not.toThrow();
            });
        });

        describe('plugin installation', () => {
            it('should skip installation when plugins are already present', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence({pluginsInstalled: true}));

                const builder = new ProtobufBuilder();
                await builder.build();

                expect(CommandRunner.run).not.toHaveBeenCalledWith(
                    'go', expect.arrayContaining(['install']), expect.anything(),
                );
                expect(Logger.warn).not.toHaveBeenCalled();
            });

            it('should prompt user when plugins are missing', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence({pluginsInstalled: false}));

                const builder = new ProtobufBuilder();
                // Stub promptUser to auto-confirm
                vi.spyOn(builder, 'promptUser').mockResolvedValue(true);

                await builder.build();

                expect(builder.promptUser).toHaveBeenCalledWith(
                    expect.stringContaining('Would you like for these to be installed?'),
                );
            });

            it('should install missing plugins when user confirms', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence({pluginsInstalled: false}));

                const builder = new ProtobufBuilder();
                vi.spyOn(builder, 'promptUser').mockResolvedValue(true);

                await builder.build();

                expect(CommandRunner.run).toHaveBeenCalledWith(
                    'go', expect.arrayContaining(['install']), expect.anything(),
                );
            });

            it('should throw with manual install instructions when user declines', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence({pluginsInstalled: false}));

                const builder = new ProtobufBuilder();
                vi.spyOn(builder, 'promptUser').mockResolvedValue(false);

                await expect(builder.build()).rejects.toThrow('go install');
            });
        });

        describe('error handling', () => {
            it('should throw when go env GOPATH fails', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockResolvedValue({exitCode: 1, stdout: '', stderr: ''});

                const builder = new ProtobufBuilder();
                await expect(builder.build()).rejects.toThrow('Could not determine GOPATH');
            });

            it('should throw when buf generate returns non-zero exit code', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(
                    mockRunSequence({bufExitCode: 1, bufStderr: 'protobuf compilation error'}),
                );

                const builder = new ProtobufBuilder();
                await expect(builder.build()).rejects.toThrow(
                    'Protobuf generation failed with exit code 1',
                );
            });

            it('should include stderr in error message when generation fails', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(
                    mockRunSequence({bufExitCode: 2, bufStderr: 'fatal error: cannot find proto files'}),
                );

                const builder = new ProtobufBuilder();
                await expect(builder.build()).rejects.toThrow('fatal error: cannot find proto files');
            });

            it('should include command in error message when generation fails', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(
                    mockRunSequence({bufExitCode: 1, bufStderr: 'error'}),
                );

                const builder = new ProtobufBuilder();
                await expect(builder.build()).rejects.toThrow(/Command: npx buf generate/);
            });

            it('should log error message when generation fails', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                const {Logger} = await import('../utils/logger');
                vi.mocked(CommandRunner.run).mockImplementation(
                    mockRunSequence({bufExitCode: 1, bufStderr: 'error'}),
                );

                const builder = new ProtobufBuilder();
                await expect(builder.build()).rejects.toThrow();
                expect(Logger.error).toHaveBeenCalledWith('Protobuf generation failed');
            });

            it('should throw when CommandRunner.run throws', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockRejectedValue(new Error('Command execution failed'));

                const builder = new ProtobufBuilder();
                await expect(builder.build()).rejects.toThrow('Command execution failed');
            });
        });

        describe('edge cases', () => {
            it('should handle empty stdout from successful generation', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence());

                const builder = new ProtobufBuilder();
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should handle warnings in stderr with exit code 0', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(mockRunSequence());

                const builder = new ProtobufBuilder();
                await expect(builder.build()).resolves.not.toThrow();
            });

            it('should handle special characters in error messages', async () => {
                const {CommandRunner} = await import('../utils/command-runner');
                vi.mocked(CommandRunner.run).mockImplementation(
                    mockRunSequence({bufExitCode: 1, bufStderr: 'Error: "message" not found at /path/to/file.proto'}),
                );

                const builder = new ProtobufBuilder();
                await expect(builder.build()).rejects.toThrow(
                    'Error: "message" not found at /path/to/file.proto',
                );
            });
        });
    });

    describe('cleanupPaths', () => {
        it('should return correct cleanup paths for protobuf generated files', () => {
            const builder = new ProtobufBuilder();
            const paths = (builder as any).cleanupPaths;

            expect(paths).toEqual([
                'src/cli/types/pbtypes/pbtypesconnect',
                'src/cli/types/pbtypes/*.pb.go',
                'src/gui/src/connect/gen',
            ]);
        });

        it('should return array with three paths', () => {
            const builder = new ProtobufBuilder();
            const paths = (builder as any).cleanupPaths;

            expect(Array.isArray(paths)).toBe(true);
            expect(paths).toHaveLength(3);
        });

        it('should include CLI protobuf types path', () => {
            const builder = new ProtobufBuilder();
            expect((builder as any).cleanupPaths).toContain('src/cli/types/pbtypes/pbtypesconnect');
        });

        it('should include CLI Go protobuf files pattern', () => {
            const builder = new ProtobufBuilder();
            expect((builder as any).cleanupPaths).toContain('src/cli/types/pbtypes/*.pb.go');
        });

        it('should include GUI generated connect path', () => {
            const builder = new ProtobufBuilder();
            expect((builder as any).cleanupPaths).toContain('src/gui/src/connect/gen');
        });
    });
});

