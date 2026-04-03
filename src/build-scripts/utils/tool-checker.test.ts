import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {ToolChecker} from './tool-checker';

// Mock CommandRunner module
vi.mock('./command-runner', () => ({
    CommandRunner: {
        run: vi.fn(),
    },
}));

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

describe('ToolChecker', () => {
    beforeEach(async () => {
        // Import mocked modules and reset
        const {CommandRunner} = await import('./command-runner');
        const {Logger} = await import('./logger');

        vi.mocked(CommandRunner.run).mockReset();
        vi.mocked(Logger.error).mockReset();

        // Mock console.error to prevent test output pollution
        vi.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        cleanupMocks();
    });

    describe('checkTool', () => {
        describe('tool detection', () => {
            it('should return available: true when tool command succeeds', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'go version go1.21.0 darwin/arm64',
                    stderr: '',
                });

                // Act
                const result = await ToolChecker.checkTool('go', ['version']);

                // Assert
                expect(result.available).toBe(true);
                expect(CommandRunner.run).toHaveBeenCalledWith('go', ['version']);
            });

            it('should capture version from stdout when available', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                const versionOutput = 'go version go1.21.0 darwin/arm64';
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: versionOutput,
                    stderr: '',
                });

                // Act
                const result = await ToolChecker.checkTool('go', ['version']);

                // Assert
                expect(result.version).toBe(versionOutput);
            });

            it('should capture version from stderr when stdout is empty', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                const versionOutput = 'Angular CLI: 17.0.0';
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: versionOutput,
                });

                // Act
                const result = await ToolChecker.checkTool('ng', ['version']);

                // Assert
                expect(result.version).toBe(versionOutput);
            });

            it('should trim whitespace from version output', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '  go version go1.21.0  \n',
                    stderr: '',
                });

                // Act
                const result = await ToolChecker.checkTool('go', ['version']);

                // Assert
                expect(result.version).toBe('go version go1.21.0');
            });

            it('should return available: false when tool command fails', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 127,
                    stdout: '',
                    stderr: 'command not found: go',
                });

                // Act
                const result = await ToolChecker.checkTool('go', ['version']);

                // Assert
                expect(result.available).toBe(false);
                expect(result.version).toBeUndefined();
            });

            it('should return available: false when command throws error', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                vi.mocked(CommandRunner.run).mockRejectedValue(new Error('Command execution failed'));

                // Act
                const result = await ToolChecker.checkTool('nonexistent', ['--version']);

                // Assert
                expect(result.available).toBe(false);
                expect(result.version).toBeUndefined();
            });

            it('should handle tools with different version command formats', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'v18.0.0',
                    stderr: '',
                });

                // Act
                const result = await ToolChecker.checkTool('node', ['--version']);

                // Assert
                expect(result.available).toBe(true);
                expect(result.version).toBe('v18.0.0');
                expect(CommandRunner.run).toHaveBeenCalledWith('node', ['--version']);
            });
        });
    });

    describe('checkGo', () => {
        it('should check for go with version command', async () => {
            // Arrange
            const {CommandRunner} = await import('./command-runner');
            vi.mocked(CommandRunner.run).mockResolvedValue({
                exitCode: 0,
                stdout: 'go version go1.21.0 darwin/arm64',
                stderr: '',
            });

            // Act
            const result = await ToolChecker.checkGo();

            // Assert
            expect(result.available).toBe(true);
            expect(CommandRunner.run).toHaveBeenCalledWith('go', ['version']);
        });

        it('should return false when go is not installed', async () => {
            // Arrange
            const {CommandRunner} = await import('./command-runner');
            vi.mocked(CommandRunner.run).mockResolvedValue({
                exitCode: 127,
                stdout: '',
                stderr: 'command not found: go',
            });

            // Act
            const result = await ToolChecker.checkGo();

            // Assert
            expect(result.available).toBe(false);
        });
    });

    describe('checkAngularCLI', () => {
        it('should check for ng with version command', async () => {
            // Arrange
            const {CommandRunner} = await import('./command-runner');
            vi.mocked(CommandRunner.run).mockResolvedValue({
                exitCode: 0,
                stdout: '',
                stderr: 'Angular CLI: 17.0.0',
            });

            // Act
            const result = await ToolChecker.checkAngularCLI();

            // Assert
            expect(result.available).toBe(true);
            expect(CommandRunner.run).toHaveBeenCalledWith('ng', ['version']);
        });

        it('should return false when ng is not installed', async () => {
            // Arrange
            const {CommandRunner} = await import('./command-runner');
            vi.mocked(CommandRunner.run).mockResolvedValue({
                exitCode: 127,
                stdout: '',
                stderr: 'command not found: ng',
            });

            // Act
            const result = await ToolChecker.checkAngularCLI();

            // Assert
            expect(result.available).toBe(false);
        });
    });

    describe('checkRequiredTools', () => {
        describe('CLI component', () => {
            it('should return true when go is available', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: 'go version go1.21.0',
                    stderr: '',
                });

                // Act
                const result = await ToolChecker.checkRequiredTools('cli');

                // Assert
                expect(result).toBe(true);
                expect(CommandRunner.run).toHaveBeenCalledWith('go', ['version']);
            });

            it('should return false and report missing go', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                const {Logger} = await import('./logger');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 127,
                    stdout: '',
                    stderr: 'command not found: go',
                });

                // Act
                const result = await ToolChecker.checkRequiredTools('cli');

                // Assert
                expect(result).toBe(false);
                expect(Logger.error).toHaveBeenCalledWith('Missing required tools:');
                expect(console.error).toHaveBeenCalledWith('  - go');
                expect(console.error).toHaveBeenCalledWith(
                    expect.stringContaining('Install Go from https://golang.org/dl/'),
                );
            });
        });

        describe('GUI component', () => {
            it('should return true when ng is available', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 0,
                    stdout: '',
                    stderr: 'Angular CLI: 17.0.0',
                });

                // Act
                const result = await ToolChecker.checkRequiredTools('gui');

                // Assert
                expect(result).toBe(true);
                expect(CommandRunner.run).toHaveBeenCalledWith('ng', ['version']);
            });

            it('should return false and report missing ng', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                const {Logger} = await import('./logger');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 127,
                    stdout: '',
                    stderr: 'command not found: ng',
                });

                // Act
                const result = await ToolChecker.checkRequiredTools('gui');

                // Assert
                expect(result).toBe(false);
                expect(Logger.error).toHaveBeenCalledWith('Missing required tools:');
                expect(console.error).toHaveBeenCalledWith('  - ng (Angular CLI)');
                expect(console.error).toHaveBeenCalledWith(
                    expect.stringContaining('npm install -g @angular/cli'),
                );
            });
        });

        describe('other components', () => {
            it('should return true for electron component (no required tools)', async () => {
                // Act
                const result = await ToolChecker.checkRequiredTools('electron');

                // Assert
                expect(result).toBe(true);
            });

            it('should return true for proto component (no required tools)', async () => {
                // Act
                const result = await ToolChecker.checkRequiredTools('proto');

                // Assert
                expect(result).toBe(true);
            });

            it('should return true for package component (no required tools)', async () => {
                // Act
                const result = await ToolChecker.checkRequiredTools('package');

                // Assert
                expect(result).toBe(true);
            });

            it('should return true for install component (no required tools)', async () => {
                // Act
                const result = await ToolChecker.checkRequiredTools('install');

                // Assert
                expect(result).toBe(true);
            });
        });

        describe('missing tool reporting', () => {
            it('should provide installation suggestions for missing tools', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 127,
                    stdout: '',
                    stderr: 'command not found',
                });

                // Act
                await ToolChecker.checkRequiredTools('cli');

                // Assert
                expect(console.error).toHaveBeenCalledWith('  - go');
                expect(console.error).toHaveBeenCalledWith(
                    expect.stringContaining('brew install go'),
                );
                expect(console.error).toHaveBeenCalledWith(
                    expect.stringContaining('apt install golang-go'),
                );
            });

            it('should report all missing tools with suggestions', async () => {
                // Arrange
                const {CommandRunner} = await import('./command-runner');
                const {Logger} = await import('./logger');
                vi.mocked(CommandRunner.run).mockResolvedValue({
                    exitCode: 127,
                    stdout: '',
                    stderr: 'command not found',
                });

                // Act
                await ToolChecker.checkRequiredTools('gui');

                // Assert
                expect(Logger.error).toHaveBeenCalledWith('Missing required tools:');
                expect(console.error).toHaveBeenCalledWith('  - ng (Angular CLI)');
                expect(console.error).toHaveBeenCalledWith(
                    '    Install Angular CLI: npm install -g @angular/cli',
                );
            });
        });
    });
});
