import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {Logger, LogLevel} from './logger';

describe('Logger', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Mock all console methods
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        });
        consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {
        });

        // Reset verbose mode to default
        Logger.verbose = false;
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('error', () => {
        it('should log error messages with [ERROR] prefix', () => {
            // Arrange
            const message = 'Something went wrong';

            // Act
            Logger.error(message);

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Something went wrong');
        });

        it('should log error message and stack trace when error object is provided', () => {
            // Arrange
            const message = 'Operation failed';
            const error = new Error('Detailed error message');

            // Act
            Logger.error(message, error);

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Operation failed');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Detailed error message'));
        });

        it('should log error message when error object has no stack', () => {
            // Arrange
            const message = 'Operation failed';
            const error = new Error('Error without stack');
            delete (error as any).stack;

            // Act
            Logger.error(message, error);

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Operation failed');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error without stack');
        });

        it('should handle empty error message', () => {
            // Arrange
            const message = '';

            // Act
            Logger.error(message);

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] ');
        });
    });

    describe('warn', () => {
        it('should log warning messages with [WARN] prefix', () => {
            // Arrange
            const message = 'This is a warning';

            // Act
            Logger.warn(message);

            // Assert
            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] This is a warning');
        });

        it('should handle empty warning message', () => {
            // Arrange
            const message = '';

            // Act
            Logger.warn(message);

            // Assert
            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] ');
        });

        it('should handle warning messages with special characters', () => {
            // Arrange
            const message = 'Warning: "quoted" and \'single\' quotes';

            // Act
            Logger.warn(message);

            // Assert
            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Warning: "quoted" and \'single\' quotes');
        });
    });

    describe('info', () => {
        it('should log info messages with [INFO] prefix', () => {
            // Arrange
            const message = 'Information message';

            // Act
            Logger.info(message);

            // Assert
            expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Information message');
        });

        it('should handle empty info message', () => {
            // Arrange
            const message = '';

            // Act
            Logger.info(message);

            // Assert
            expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] ');
        });

        it('should handle multiline info messages', () => {
            // Arrange
            const message = 'Line 1\nLine 2\nLine 3';

            // Act
            Logger.info(message);

            // Assert
            expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Line 1\nLine 2\nLine 3');
        });
    });

    describe('debug', () => {
        it('should not log debug messages when verbose is false', () => {
            // Arrange
            Logger.verbose = false;
            const message = 'Debug information';

            // Act
            Logger.debug(message);

            // Assert
            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        it('should log debug messages with [DEBUG] prefix when verbose is true', () => {
            // Arrange
            Logger.verbose = true;
            const message = 'Debug information';

            // Act
            Logger.debug(message);

            // Assert
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] Debug information');
        });

        it('should handle empty debug message when verbose is true', () => {
            // Arrange
            Logger.verbose = true;
            const message = '';

            // Act
            Logger.debug(message);

            // Assert
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] ');
        });

        it('should suppress multiple debug messages when verbose is false', () => {
            // Arrange
            Logger.verbose = false;

            // Act
            Logger.debug('Message 1');
            Logger.debug('Message 2');
            Logger.debug('Message 3');

            // Assert
            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        it('should log multiple debug messages when verbose is true', () => {
            // Arrange
            Logger.verbose = true;

            // Act
            Logger.debug('Message 1');
            Logger.debug('Message 2');
            Logger.debug('Message 3');

            // Assert
            expect(consoleDebugSpy).toHaveBeenCalledTimes(3);
            expect(consoleDebugSpy).toHaveBeenNthCalledWith(1, '[DEBUG] Message 1');
            expect(consoleDebugSpy).toHaveBeenNthCalledWith(2, '[DEBUG] Message 2');
            expect(consoleDebugSpy).toHaveBeenNthCalledWith(3, '[DEBUG] Message 3');
        });
    });

    describe('success', () => {
        it('should log success messages with [SUCCESS] prefix', () => {
            // Arrange
            const message = 'Operation completed successfully';

            // Act
            Logger.success(message);

            // Assert
            expect(consoleLogSpy).toHaveBeenCalledWith('[SUCCESS] Operation completed successfully');
        });

        it('should handle empty success message', () => {
            // Arrange
            const message = '';

            // Act
            Logger.success(message);

            // Assert
            expect(consoleLogSpy).toHaveBeenCalledWith('[SUCCESS] ');
        });

        it('should handle success messages with numbers', () => {
            // Arrange
            const message = 'Built 42 files in 1.5 seconds';

            // Act
            Logger.success(message);

            // Assert
            expect(consoleLogSpy).toHaveBeenCalledWith('[SUCCESS] Built 42 files in 1.5 seconds');
        });
    });

    describe('verbose mode toggling', () => {
        it('should start with verbose mode disabled by default', () => {
            // Assert
            expect(Logger.verbose).toBe(false);
        });

        it('should allow enabling verbose mode', () => {
            // Act
            Logger.verbose = true;

            // Assert
            expect(Logger.verbose).toBe(true);
        });

        it('should allow disabling verbose mode', () => {
            // Arrange
            Logger.verbose = true;

            // Act
            Logger.verbose = false;

            // Assert
            expect(Logger.verbose).toBe(false);
        });

        it('should toggle verbose mode multiple times', () => {
            // Act & Assert
            Logger.verbose = true;
            expect(Logger.verbose).toBe(true);

            Logger.verbose = false;
            expect(Logger.verbose).toBe(false);

            Logger.verbose = true;
            expect(Logger.verbose).toBe(true);
        });

        it('should affect debug output when toggled', () => {
            // Arrange
            const message = 'Debug message';

            // Act - verbose off
            Logger.verbose = false;
            Logger.debug(message);

            // Assert - no output
            expect(consoleDebugSpy).not.toHaveBeenCalled();

            // Act - verbose on
            Logger.verbose = true;
            Logger.debug(message);

            // Assert - output appears
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] Debug message');
        });

        it('should not affect other log levels when verbose is toggled', () => {
            // Arrange
            Logger.verbose = false;

            // Act
            Logger.error('Error message');
            Logger.warn('Warning message');
            Logger.info('Info message');
            Logger.success('Success message');

            // Assert - all non-debug messages are logged
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error message');
            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Warning message');
            expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Info message');
            expect(consoleLogSpy).toHaveBeenCalledWith('[SUCCESS] Success message');
        });
    });

    describe('LogLevel enum', () => {
        it('should define Error level', () => {
            expect(LogLevel.Error).toBe('error');
        });

        it('should define Warn level', () => {
            expect(LogLevel.Warn).toBe('warn');
        });

        it('should define Info level', () => {
            expect(LogLevel.Info).toBe('info');
        });

        it('should define Debug level', () => {
            expect(LogLevel.Debug).toBe('debug');
        });
    });

    describe('all log levels integration', () => {
        it('should produce output for all log levels except debug when verbose is false', () => {
            // Arrange
            Logger.verbose = false;

            // Act
            Logger.error('Error');
            Logger.warn('Warning');
            Logger.info('Info');
            Logger.debug('Debug');
            Logger.success('Success');

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy).toHaveBeenCalledTimes(2); // info + success
            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        it('should produce output for all log levels when verbose is true', () => {
            // Arrange
            Logger.verbose = true;

            // Act
            Logger.error('Error');
            Logger.warn('Warning');
            Logger.info('Info');
            Logger.debug('Debug');
            Logger.success('Success');

            // Assert
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy).toHaveBeenCalledTimes(2); // info + success
            expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
        });
    });
});
