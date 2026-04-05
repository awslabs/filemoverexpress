import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {toPosix} from './normalize-path';
import {TempDirManager} from './temp-dir-manager';

// Mock fs module
vi.mock('fs', () => ({
    mkdtempSync: vi.fn(),
    rmSync: vi.fn(),
}));

// Mock os module
vi.mock('os', () => ({
    tmpdir: vi.fn(),
}));

describe('TempDirManager', () => {
    let manager: TempDirManager;
    const mockTmpDir = '/mock/tmp';
    const mockTempPath = '/mock/tmp/test-abc123';

    beforeEach(() => {
        manager = new TempDirManager();

        // Reset all mocks before each test
        vi.clearAllMocks();

        // Setup default mocks
        vi.mocked(os.tmpdir).mockReturnValue(mockTmpDir);
        vi.mocked(fs.mkdtempSync).mockReturnValue(mockTempPath);
        vi.mocked(fs.rmSync).mockImplementation(() => {
        });
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('createTempDir', () => {
        describe('successful directory creation', () => {
            it('should create a temporary directory with default prefix', () => {
                // Act
                const result = manager.createTempDir();

                // Assert
                expect(result).toBe(mockTempPath);
                expect(fs.mkdtempSync).toHaveBeenCalledWith(
                    toPosix(path.join(mockTmpDir, 'fme-tmp-')),
                );
            });

            it('should create a temporary directory with custom prefix', () => {
                // Arrange
                const customPrefix = 'build-';
                const expectedPath = toPosix(path.join(mockTmpDir, customPrefix));

                // Act
                const result = manager.createTempDir({prefix: customPrefix});

                // Assert
                expect(result).toBe(mockTempPath);
                expect(fs.mkdtempSync).toHaveBeenCalledWith(expectedPath);
            });

            it('should create a temporary directory with empty prefix', () => {
                // Arrange
                const emptyPrefix = '';
                // When prefix is empty, the implementation still uses default 'fme-tmp-'
                // This is because the code does: options?.prefix || 'fme-tmp-'
                const expectedPath = toPosix(path.join(mockTmpDir, 'fme-tmp-'));

                // Act
                const result = manager.createTempDir({prefix: emptyPrefix});

                // Assert
                expect(result).toBe(mockTempPath);
                expect(fs.mkdtempSync).toHaveBeenCalledWith(expectedPath);
            });

            it('should use OS-specific temp directory', () => {
                // Arrange
                const customTmpDir = '/custom/temp';
                vi.mocked(os.tmpdir).mockReturnValue(customTmpDir);

                // Act
                manager.createTempDir();

                // Assert
                expect(os.tmpdir).toHaveBeenCalled();
                expect(fs.mkdtempSync).toHaveBeenCalledWith(
                    toPosix(path.join(customTmpDir, 'fme-tmp-')),
                );
            });
        });

        describe('error handling', () => {
            it('should throw descriptive error for EACCES (permission denied)', () => {
                // Arrange
                const error: any = new Error('Permission denied');
                error.code = 'EACCES';
                vi.mocked(fs.mkdtempSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => manager.createTempDir()).toThrow(
                    /Failed to create temporary directory.*Permission denied/,
                );
                expect(() => manager.createTempDir()).toThrow(
                    /Check that you have write access/,
                );
            });

            it('should throw descriptive error for ENOSPC (no space left)', () => {
                // Arrange
                const error: any = new Error('No space left on device');
                error.code = 'ENOSPC';
                vi.mocked(fs.mkdtempSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => manager.createTempDir()).toThrow(
                    /Failed to create temporary directory.*No space left on device/,
                );
                expect(() => manager.createTempDir()).toThrow(
                    /Free up disk space and try again/,
                );
            });

            it('should throw descriptive error for generic errors', () => {
                // Arrange
                const error = new Error('Unknown error');
                vi.mocked(fs.mkdtempSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => manager.createTempDir()).toThrow(
                    /Failed to create temporary directory.*Unknown error/,
                );
            });

            it('should include temp path in error message', () => {
                // Arrange
                const customPrefix = 'test-';
                const error = new Error('Test error');
                vi.mocked(fs.mkdtempSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                const expectedPath = path.join(mockTmpDir, customPrefix).split(path.sep).join('/');
                expect(() => manager.createTempDir({prefix: customPrefix})).toThrow(
                    new RegExp(expectedPath),
                );
            });
        });
    });

    describe('withTempDir', () => {
        describe('successful callback execution', () => {
            it('should create temp directory, execute callback, and cleanup', () => {
                // Arrange
                const callback = vi.fn();

                // Act
                manager.withTempDir(callback);

                // Assert
                expect(fs.mkdtempSync).toHaveBeenCalled();
                expect(callback).toHaveBeenCalledWith(mockTempPath);
                expect(fs.rmSync).toHaveBeenCalledWith(mockTempPath, {
                    recursive: true,
                    force: true,
                });
            });

            it('should pass temp directory path to callback', () => {
                // Arrange
                let receivedPath: string | undefined;
                const callback = (tempPath: string) => {
                    receivedPath = tempPath;
                };

                // Act
                manager.withTempDir(callback);

                // Assert
                expect(receivedPath).toBe(mockTempPath);
            });

            it('should cleanup even if callback completes successfully', () => {
                // Arrange
                const callback = vi.fn(() => {
                    // Simulate some work
                    return 'success';
                });

                // Act
                manager.withTempDir(callback);

                // Assert
                expect(fs.rmSync).toHaveBeenCalledWith(mockTempPath, {
                    recursive: true,
                    force: true,
                });
            });

            it('should use custom prefix when provided', () => {
                // Arrange
                const callback = vi.fn();
                const customPrefix = 'custom-';

                // Act
                manager.withTempDir(callback, {prefix: customPrefix});

                // Assert
                expect(fs.mkdtempSync).toHaveBeenCalledWith(
                    toPosix(path.join(mockTmpDir, customPrefix)),
                );
            });
        });

        describe('noCleanOnExit option', () => {
            it('should skip cleanup when noCleanOnExit is true', () => {
                // Arrange
                const callback = vi.fn();

                // Act
                manager.withTempDir(callback, {noCleanOnExit: true});

                // Assert
                expect(callback).toHaveBeenCalledWith(mockTempPath);
                expect(fs.rmSync).not.toHaveBeenCalled();
            });

            it('should cleanup when noCleanOnExit is false', () => {
                // Arrange
                const callback = vi.fn();

                // Act
                manager.withTempDir(callback, {noCleanOnExit: false});

                // Assert
                expect(fs.rmSync).toHaveBeenCalled();
            });

            it('should cleanup when noCleanOnExit is undefined', () => {
                // Arrange
                const callback = vi.fn();

                // Act
                manager.withTempDir(callback, {});

                // Assert
                expect(fs.rmSync).toHaveBeenCalled();
            });

            it('should not cleanup even if callback throws when noCleanOnExit is true', () => {
                // Arrange
                const callback = vi.fn(() => {
                    throw new Error('Callback error');
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback, {noCleanOnExit: true});
                }).toThrow('Callback error');
                expect(fs.rmSync).not.toHaveBeenCalled();
            });
        });

        describe('callback error handling', () => {
            it('should cleanup and re-throw callback error', () => {
                // Arrange
                const callbackError = new Error('Callback failed');
                const callback = vi.fn(() => {
                    throw callbackError;
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow('Callback failed');
                expect(fs.rmSync).toHaveBeenCalledWith(mockTempPath, {
                    recursive: true,
                    force: true,
                });
            });

            it('should preserve callback error even if cleanup succeeds', () => {
                // Arrange
                const callback = vi.fn(() => {
                    throw new Error('Original error');
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow('Original error');
            });

            it('should execute callback before cleanup', () => {
                // Arrange
                const executionOrder: string[] = [];
                const callback = vi.fn(() => {
                    executionOrder.push('callback');
                });
                vi.mocked(fs.rmSync).mockImplementation(() => {
                    executionOrder.push('cleanup');
                });

                // Act
                manager.withTempDir(callback);

                // Assert
                expect(executionOrder).toEqual(['callback', 'cleanup']);
            });
        });

        describe('cleanup error handling', () => {
            it('should throw descriptive error for EBUSY (resource busy)', () => {
                // Arrange
                const callback = vi.fn();
                const error: any = new Error('Resource busy');
                error.code = 'EBUSY';
                vi.mocked(fs.rmSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow(/Failed to cleanup temporary directory.*Directory or files are in use/);
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow(/Close any programs using these files/);
            });

            it('should throw descriptive error for EACCES during cleanup', () => {
                // Arrange
                const callback = vi.fn();
                const error: any = new Error('Permission denied');
                error.code = 'EACCES';
                vi.mocked(fs.rmSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow(/Failed to cleanup temporary directory.*Permission denied/);
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow(/Check that you have write access to remove the directory/);
            });

            it('should throw descriptive error for generic cleanup errors', () => {
                // Arrange
                const callback = vi.fn();
                const error = new Error('Generic cleanup error');
                vi.mocked(fs.rmSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow(/Failed to cleanup temporary directory.*Generic cleanup error/);
            });

            it('should prioritize callback error over cleanup error', () => {
                // Arrange
                const callbackError = new Error('Callback error');
                const callback = vi.fn(() => {
                    throw callbackError;
                });
                const cleanupError: any = new Error('Cleanup error');
                cleanupError.code = 'EBUSY';
                vi.mocked(fs.rmSync).mockImplementation(() => {
                    throw cleanupError;
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow('Callback error');
            });

            it('should include temp path in cleanup error message', () => {
                // Arrange
                const callback = vi.fn();
                const error: any = new Error('Cleanup failed');
                error.code = 'EBUSY';
                vi.mocked(fs.rmSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow(new RegExp(mockTempPath));
            });
        });

        describe('edge cases', () => {
            it('should handle callback with empty prefix', () => {
                // Arrange
                const callback = vi.fn();

                // Act
                manager.withTempDir(callback, {prefix: ''});

                // Assert
                expect(callback).toHaveBeenCalledWith(mockTempPath);
                expect(fs.rmSync).toHaveBeenCalled();
            });

            it('should handle callback that returns a value', () => {
                // Arrange
                const callback = vi.fn(() => 'return value');

                // Act
                manager.withTempDir(callback);

                // Assert
                expect(callback).toHaveBeenCalled();
                expect(fs.rmSync).toHaveBeenCalled();
            });

            it('should handle callback that modifies files in temp directory', () => {
                // Arrange
                const callback = vi.fn((tempPath: string) => {
                    // Simulate file operations
                    // In real scenario, files would be created here
                });

                // Act
                manager.withTempDir(callback);

                // Assert
                expect(callback).toHaveBeenCalledWith(mockTempPath);
                expect(fs.rmSync).toHaveBeenCalledWith(mockTempPath, {
                    recursive: true,
                    force: true,
                });
            });

            it('should handle multiple sequential calls', () => {
                // Arrange
                const callback1 = vi.fn();
                const callback2 = vi.fn();

                // Act
                manager.withTempDir(callback1);
                manager.withTempDir(callback2);

                // Assert
                expect(callback1).toHaveBeenCalledTimes(1);
                expect(callback2).toHaveBeenCalledTimes(1);
                expect(fs.rmSync).toHaveBeenCalledTimes(2);
            });
        });

        describe('creation error handling', () => {
            it('should not attempt cleanup if directory creation fails', () => {
                // Arrange
                const callback = vi.fn();
                const error: any = new Error('Creation failed');
                error.code = 'EACCES';
                vi.mocked(fs.mkdtempSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow(/Failed to create temporary directory/);
                expect(callback).not.toHaveBeenCalled();
                expect(fs.rmSync).not.toHaveBeenCalled();
            });

            it('should propagate creation errors without modification', () => {
                // Arrange
                const callback = vi.fn();
                const error: any = new Error('ENOSPC error');
                error.code = 'ENOSPC';
                vi.mocked(fs.mkdtempSync).mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => {
                    manager.withTempDir(callback);
                }).toThrow(/No space left on device/);
            });
        });
    });
});
