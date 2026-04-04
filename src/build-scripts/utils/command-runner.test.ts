import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks, createMockChildProcess} from '../test-utils';
import {CommandRunner} from './command-runner';

// Mock cross-spawn module
vi.mock('cross-spawn', () => {
    const fn = vi.fn();
    fn.spawn = fn;
    fn.sync = vi.fn();
    return {default: fn};
});

// Mock Logger module
vi.mock('./logger', () => ({
    Logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        success: vi.fn(),
    },
}));

describe('CommandRunner', () => {
    beforeEach(async () => {
        // Import mocked modules
        const crossSpawn = await import('cross-spawn');
        const {Logger} = await import('./logger');

        // Reset mocks before each test
        vi.mocked(crossSpawn.default).mockReset();
        vi.mocked(Logger.error).mockReset();
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('run', () => {
        describe('successful command execution', () => {
            it('should capture stdout for commands that exit with code 0', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const expectedStdout = 'test output from command';
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                    stdout: expectedStdout,
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('echo', ['test']);

                // Assert
                expect(result.exitCode).toBe(0);
                expect(result.stdout).toBe(expectedStdout);
                expect(result.stderr).toBe('');
            });

            it('should return exit code 0 for successful commands', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                    stdout: 'success',
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('ls', []);

                // Assert
                expect(result.exitCode).toBe(0);
            });

            it('should handle commands with no output', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('true', []);

                // Assert
                expect(result.exitCode).toBe(0);
                expect(result.stdout).toBe('');
                expect(result.stderr).toBe('');
            });
        });

        describe('failed command execution', () => {
            it('should capture stderr for commands that fail', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const expectedStderr = 'error: command not found';
                const mockProcess = createMockChildProcess({
                    exitCode: 1,
                    stderr: expectedStderr,
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('invalid-command', []);

                // Assert
                expect(result.exitCode).toBe(1);
                expect(result.stderr).toBe(expectedStderr);
            });

            it('should return non-zero exit code for failed commands', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const mockProcess = createMockChildProcess({
                    exitCode: 127,
                    stderr: 'command not found',
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('nonexistent', []);

                // Assert
                expect(result.exitCode).toBe(127);
            });

            it('should handle commands with both stdout and stderr', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const mockProcess = createMockChildProcess({
                    exitCode: 1,
                    stdout: 'partial output',
                    stderr: 'error occurred',
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('test', ['arg']);

                // Assert
                expect(result.exitCode).toBe(1);
                expect(result.stdout).toBe('partial output');
                expect(result.stderr).toBe('error occurred');
            });

            it('should handle process error events', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const {Logger} = await import('./logger');

                // Create a mock that triggers the error event
                const mockProcess = {
                    stdout: {
                        on: vi.fn((event: string, handler: any) => mockProcess.stdout),
                    },
                    stderr: {
                        on: vi.fn((event: string, handler: any) => mockProcess.stderr),
                    },
                    on: vi.fn((event: string, handler: any) => {
                        if (event === 'error') {
                            // Trigger the error handler immediately
                            handler(new Error('Command failed'));
                        }
                        return mockProcess;
                    }),
                };
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('test', []);

                // Assert
                expect(result.exitCode).toBe(1);
                expect(result.stderr).toContain('Command failed');
                expect(Logger.error).toHaveBeenCalled();
            });

            it('should default to exit code 1 when close event returns null', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const mockProcess = {
                    stdout: {
                        on: vi.fn((event: string, handler: any) => mockProcess.stdout),
                    },
                    stderr: {
                        on: vi.fn((event: string, handler: any) => mockProcess.stderr),
                    },
                    on: vi.fn((event: string, handler: any) => {
                        if (event === 'close') {
                            handler(null); // Simulate null exit code
                        }
                        return mockProcess;
                    }),
                };
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('test', []);

                // Assert
                expect(result.exitCode).toBe(1);
            });
        });

        describe('environment variable passing', () => {
            it('should pass custom environment variables to spawned process', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const spawn = crossSpawn.default;
                const customEnv = {
                    CUSTOM_VAR: 'custom_value',
                    ANOTHER_VAR: 'another_value',
                };
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                    stdout: 'success',
                });
                vi.mocked(spawn).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', [], {env: customEnv});

                // Assert
                expect(spawn).toHaveBeenCalledWith(
                    'test',
                    [],
                    expect.objectContaining({
                        env: expect.objectContaining(customEnv),
                    }),
                );
            });

            it('should merge custom env with process.env', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const spawn = crossSpawn.default;
                const originalPath = process.env.PATH;
                const customEnv = {CUSTOM_VAR: 'value'};
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                });
                vi.mocked(spawn).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', [], {env: customEnv});

                // Assert
                const spawnCall = vi.mocked(spawn).mock.calls[0];
                const spawnOptions = spawnCall[2];
                expect(spawnOptions?.env).toHaveProperty('CUSTOM_VAR', 'value');
                expect(spawnOptions?.env).toHaveProperty('PATH', originalPath);
            });

            it('should allow custom env to override process.env variables', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const spawn = crossSpawn.default;
                const customEnv = {PATH: '/custom/path'};
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                });
                vi.mocked(spawn).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', [], {env: customEnv});

                // Assert
                const spawnCall = vi.mocked(spawn).mock.calls[0];
                const spawnOptions = spawnCall[2];
                expect(spawnOptions?.env).toHaveProperty('PATH', '/custom/path');
            });

            it('should work without custom environment variables', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const spawn = crossSpawn.default;
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                });
                vi.mocked(spawn).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', []);

                // Assert
                const spawnCall = vi.mocked(spawn).mock.calls[0];
                const spawnOptions = spawnCall[2];
                expect(spawnOptions?.env).toEqual(process.env);
            });
        });

        describe('verbose output mode', () => {
            it('should stream stdout to process.stdout when verbose is true', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
                const testOutput = 'verbose output';
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                    stdout: testOutput,
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', [], {verbose: true});

                // Assert
                expect(stdoutSpy).toHaveBeenCalledWith(testOutput);
            });

            it('should stream stderr to process.stderr when verbose is true', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
                const testError = 'verbose error';
                const mockProcess = createMockChildProcess({
                    exitCode: 1,
                    stderr: testError,
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', [], {verbose: true});

                // Assert
                expect(stderrSpy).toHaveBeenCalledWith(testError);
            });

            it('should not stream output when verbose is false', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
                const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                    stdout: 'output',
                    stderr: 'error',
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', [], {verbose: false});

                // Assert
                expect(stdoutSpy).not.toHaveBeenCalled();
                expect(stderrSpy).not.toHaveBeenCalled();
            });

            it('should not stream output when verbose is undefined', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
                const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                    stdout: 'output',
                    stderr: 'error',
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', []);

                // Assert
                expect(stdoutSpy).not.toHaveBeenCalled();
                expect(stderrSpy).not.toHaveBeenCalled();
            });

            it('should still capture output when verbose is true', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
                const testOutput = 'captured output';
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                    stdout: testOutput,
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('test', [], {verbose: true});

                // Assert
                expect(result.stdout).toBe(testOutput);
            });
        });

        describe('working directory option', () => {
            it('should pass cwd option to spawn', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const spawn = crossSpawn.default;
                const customCwd = '/custom/working/directory';
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                });
                vi.mocked(spawn).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', [], {cwd: customCwd});

                // Assert
                expect(spawn).toHaveBeenCalledWith(
                    'test',
                    [],
                    expect.objectContaining({
                        cwd: customCwd,
                    }),
                );
            });
        });

        describe('command arguments', () => {
            it('should pass command arguments correctly', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const spawn = crossSpawn.default;
                const args = ['arg1', 'arg2', '--flag'];
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                });
                vi.mocked(spawn).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', args);

                // Assert
                expect(spawn).toHaveBeenCalledWith(
                    'test',
                    args,
                    expect.any(Object),
                );
            });

            it('should handle empty arguments array', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const spawn = crossSpawn.default;
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                });
                vi.mocked(spawn).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', []);

                // Assert
                expect(spawn).toHaveBeenCalledWith(
                    'test',
                    [],
                    expect.any(Object),
                );
            });
        });

        describe('shell option', () => {
            it('should spawn without shell option for security', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const spawn = crossSpawn.default;
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                });
                vi.mocked(spawn).mockReturnValue(mockProcess as any);

                // Act
                await CommandRunner.run('test', []);

                // Assert
                expect(spawn).toHaveBeenCalledWith(
                    'test',
                    [],
                    expect.not.objectContaining({
                        shell: expect.anything(),
                    }),
                );
            });
        });

        describe('promise rejection handling', () => {
            it('should handle promise rejection in async operations', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const mockProcess = {
                    stdout: {
                        on: vi.fn((event: string, handler: any) => mockProcess.stdout),
                    },
                    stderr: {
                        on: vi.fn((event: string, handler: any) => mockProcess.stderr),
                    },
                    on: vi.fn((event: string, handler: any) => {
                        if (event === 'error') {
                            handler(new Error('Async operation failed'));
                        }
                        return mockProcess;
                    }),
                };
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('test', []);

                // Assert
                expect(result.exitCode).toBe(1);
                expect(result.stderr).toContain('Async operation failed');
            });
        });

        describe('large output handling', () => {
            it('should handle commands with large output', async () => {
                // Arrange
                const crossSpawn = await import('cross-spawn');
                const largeOutput = 'x'.repeat(10000); // 10KB of output
                const mockProcess = createMockChildProcess({
                    exitCode: 0,
                    stdout: largeOutput,
                });
                vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

                // Act
                const result = await CommandRunner.run('test', []);

                // Assert
                expect(result.exitCode).toBe(0);
                expect(result.stdout).toBe(largeOutput);
                expect(result.stdout.length).toBe(10000);
            });
        });
    });

    describe('runWithLiveOutput', () => {
        it('should return exit code 0 for successful commands', async () => {
            // Arrange
            const crossSpawn = await import('cross-spawn');
            const mockProcess = {
                on: vi.fn((event: string, handler: any) => {
                    if (event === 'close') {
                        handler(0);
                    }
                    return mockProcess;
                }),
            };
            vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

            // Act
            const exitCode = await CommandRunner.runWithLiveOutput('test', []);

            // Assert
            expect(exitCode).toBe(0);
        });

        it('should return non-zero exit code for failed commands', async () => {
            // Arrange
            const crossSpawn = await import('cross-spawn');
            const mockProcess = {
                on: vi.fn((event: string, handler: any) => {
                    if (event === 'close') {
                        handler(1);
                    }
                    return mockProcess;
                }),
            };
            vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

            // Act
            const exitCode = await CommandRunner.runWithLiveOutput('test', []);

            // Assert
            expect(exitCode).toBe(1);
        });

        it('should spawn with stdio: inherit and without shell', async () => {
            // Arrange
            const crossSpawn = await import('cross-spawn');
            const spawn = crossSpawn.default;
            const mockProcess = {
                on: vi.fn((event: string, handler: any) => {
                    if (event === 'close') {
                        handler(0);
                    }
                    return mockProcess;
                }),
            };
            vi.mocked(spawn).mockReturnValue(mockProcess as any);

            // Act
            await CommandRunner.runWithLiveOutput('test', ['arg']);

            // Assert
            expect(spawn).toHaveBeenCalledWith(
                'test',
                ['arg'],
                expect.objectContaining({
                    stdio: 'inherit',
                }),
            );
            expect(spawn).toHaveBeenCalledWith(
                'test',
                ['arg'],
                expect.not.objectContaining({
                    shell: expect.anything(),
                }),
            );
        });

        it('should handle error events', async () => {
            // Arrange
            const crossSpawn = await import('cross-spawn');
            const {Logger} = await import('./logger');
            const mockProcess = {
                on: vi.fn((event: string, handler: any) => {
                    if (event === 'error') {
                        handler(new Error('Command failed'));
                    }
                    return mockProcess;
                }),
            };
            vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

            // Act
            const exitCode = await CommandRunner.runWithLiveOutput('test', []);

            // Assert
            expect(exitCode).toBe(1);
            expect(Logger.error).toHaveBeenCalled();
        });

        it('should default to exit code 1 when close event returns null', async () => {
            // Arrange
            const crossSpawn = await import('cross-spawn');
            const mockProcess = {
                on: vi.fn((event: string, handler: any) => {
                    if (event === 'close') {
                        handler(null);
                    }
                    return mockProcess;
                }),
            };
            vi.mocked(crossSpawn.default).mockReturnValue(mockProcess as any);

            // Act
            const exitCode = await CommandRunner.runWithLiveOutput('test', []);

            // Assert
            expect(exitCode).toBe(1);
        });
    });
});
