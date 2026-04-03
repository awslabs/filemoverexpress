import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {ShellType} from '../types/installer';
import {detectCurrentShell} from './shell-detector';

describe('shell-detector', () => {
    afterEach(() => {
        cleanupMocks();
    });

    describe('detectCurrentShell', () => {
        describe('bash shell', () => {
            it('should return ShellType.Bash when SHELL is /bin/bash', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/bash');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });

            it('should return ShellType.Bash when SHELL is /usr/bin/bash', () => {
                // Arrange
                vi.stubEnv('SHELL', '/usr/bin/bash');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });

            it('should return ShellType.Bash when SHELL contains bash in path', () => {
                // Arrange
                vi.stubEnv('SHELL', '/usr/local/bin/bash');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });
        });

        describe('zsh shell', () => {
            it('should return ShellType.Zsh when SHELL is /bin/zsh', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/zsh');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Zsh);
            });

            it('should return ShellType.Zsh when SHELL is /usr/bin/zsh', () => {
                // Arrange
                vi.stubEnv('SHELL', '/usr/bin/zsh');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Zsh);
            });

            it('should return ShellType.Zsh when SHELL contains zsh in path', () => {
                // Arrange
                vi.stubEnv('SHELL', '/usr/local/bin/zsh');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Zsh);
            });
        });

        describe('fish shell', () => {
            it('should return ShellType.Fish when SHELL is /bin/fish', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/fish');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Fish);
            });

            it('should return ShellType.Fish when SHELL is /usr/bin/fish', () => {
                // Arrange
                vi.stubEnv('SHELL', '/usr/bin/fish');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Fish);
            });

            it('should return ShellType.Fish when SHELL contains fish in path', () => {
                // Arrange
                vi.stubEnv('SHELL', '/usr/local/bin/fish');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Fish);
            });
        });

        describe('missing or unknown shell', () => {
            it('should return ShellType.Bash when SHELL is not set', () => {
                // Arrange
                vi.stubEnv('SHELL', undefined);

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });

            it('should return ShellType.Bash when SHELL is empty string', () => {
                // Arrange
                vi.stubEnv('SHELL', '');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });

            it('should return ShellType.Bash for unknown shell', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/ksh');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });

            it('should return ShellType.Bash for tcsh', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/tcsh');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });

            it('should return ShellType.Bash for csh', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/csh');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });
        });

        describe('case insensitivity', () => {
            it('should detect bash regardless of case', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/BASH');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });

            it('should detect zsh regardless of case', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/ZSH');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Zsh);
            });

            it('should detect fish regardless of case', () => {
                // Arrange
                vi.stubEnv('SHELL', '/bin/FISH');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Fish);
            });
        });

        describe('shell name with version or suffix', () => {
            it('should detect bash5 as bash', () => {
                // Arrange
                vi.stubEnv('SHELL', '/usr/local/bin/bash5');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Bash);
            });

            it('should detect zsh-5.8 as zsh', () => {
                // Arrange
                vi.stubEnv('SHELL', '/usr/local/bin/zsh-5.8');

                // Act
                const result = detectCurrentShell();

                // Assert
                expect(result).toBe(ShellType.Zsh);
            });
        });

        describe('current environment', () => {
            it('should detect shell in current environment', () => {
                // Act
                const result = detectCurrentShell();

                // Assert
                // Should return one of the valid shell types
                expect([ShellType.Bash, ShellType.Zsh, ShellType.Fish]).toContain(result);
            });
        });
    });
});
