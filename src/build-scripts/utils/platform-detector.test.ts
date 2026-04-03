import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanupMocks} from '../test-utils';
import {Architecture, Platform} from '../types/platform';
import {detectCurrentArchitecture, detectCurrentPlatform, isDarwin, isLinux, isWindows} from './platform-detector';

describe('platform-detector', () => {
    afterEach(() => {
        cleanupMocks();
    });

    describe('detectCurrentPlatform', () => {
        describe('darwin platform', () => {
            it('should return Platform.Darwin when process.platform is darwin', () => {
                // Arrange
                vi.stubGlobal('process', {...process, platform: 'darwin'});

                // Act
                const result = detectCurrentPlatform();

                // Assert
                expect(result).toBe(Platform.Darwin);
            });
        });

        describe('linux platform', () => {
            it('should return Platform.Linux when process.platform is linux', () => {
                // Arrange
                vi.stubGlobal('process', {...process, platform: 'linux'});

                // Act
                const result = detectCurrentPlatform();

                // Assert
                expect(result).toBe(Platform.Linux);
            });
        });

        describe('windows platform', () => {
            it('should return Platform.Windows when process.platform is win32', () => {
                // Arrange
                vi.stubGlobal('process', {...process, platform: 'win32'});

                // Act
                const result = detectCurrentPlatform();

                // Assert
                expect(result).toBe(Platform.Windows);
            });
        });

        describe('unsupported platform', () => {
            it('should throw an error for unsupported platforms', () => {
                // Arrange
                vi.stubGlobal('process', {...process, platform: 'freebsd'});

                // Act & Assert
                expect(() => detectCurrentPlatform()).toThrow('Unsupported platform: freebsd');
            });

            it('should throw an error for aix platform', () => {
                // Arrange
                vi.stubGlobal('process', {...process, platform: 'aix'});

                // Act & Assert
                expect(() => detectCurrentPlatform()).toThrow('Unsupported platform: aix');
            });

            it('should throw an error for sunos platform', () => {
                // Arrange
                vi.stubGlobal('process', {...process, platform: 'sunos'});

                // Act & Assert
                expect(() => detectCurrentPlatform()).toThrow('Unsupported platform: sunos');
            });
        });
    });

    describe('detectCurrentArchitecture', () => {
        describe('x64 architecture', () => {
            it('should return Architecture.X64 when process.arch is x64', () => {
                // Arrange
                vi.stubGlobal('process', {...process, arch: 'x64'});

                // Act
                const result = detectCurrentArchitecture();

                // Assert
                expect(result).toBe(Architecture.X64);
            });
        });

        describe('arm64 architecture', () => {
            it('should return Architecture.ARM64 when process.arch is arm64', () => {
                // Arrange
                vi.stubGlobal('process', {...process, arch: 'arm64'});

                // Act
                const result = detectCurrentArchitecture();

                // Assert
                expect(result).toBe(Architecture.ARM64);
            });
        });

        describe('unsupported architecture', () => {
            it('should throw an error for unsupported architectures', () => {
                // Arrange
                vi.stubGlobal('process', {...process, arch: 'ia32'});

                // Act & Assert
                expect(() => detectCurrentArchitecture()).toThrow('Unsupported architecture: ia32');
            });

            it('should throw an error for arm architecture', () => {
                // Arrange
                vi.stubGlobal('process', {...process, arch: 'arm'});

                // Act & Assert
                expect(() => detectCurrentArchitecture()).toThrow('Unsupported architecture: arm');
            });

            it('should throw an error for mips architecture', () => {
                // Arrange
                vi.stubGlobal('process', {...process, arch: 'mips'});

                // Act & Assert
                expect(() => detectCurrentArchitecture()).toThrow('Unsupported architecture: mips');
            });
        });
    });

    describe('isWindows', () => {
        it('should return true when process.platform is win32', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'win32'});

            // Act
            const result = isWindows();

            // Assert
            expect(result).toBe(true);
        });

        it('should return false when process.platform is darwin', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'darwin'});

            // Act
            const result = isWindows();

            // Assert
            expect(result).toBe(false);
        });

        it('should return false when process.platform is linux', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'linux'});

            // Act
            const result = isWindows();

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('isDarwin', () => {
        it('should return true when process.platform is darwin', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'darwin'});

            // Act
            const result = isDarwin();

            // Assert
            expect(result).toBe(true);
        });

        it('should return false when process.platform is win32', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'win32'});

            // Act
            const result = isDarwin();

            // Assert
            expect(result).toBe(false);
        });

        it('should return false when process.platform is linux', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'linux'});

            // Act
            const result = isDarwin();

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('isLinux', () => {
        it('should return true when process.platform is linux', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'linux'});

            // Act
            const result = isLinux();

            // Assert
            expect(result).toBe(true);
        });

        it('should return false when process.platform is darwin', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'darwin'});

            // Act
            const result = isLinux();

            // Assert
            expect(result).toBe(false);
        });

        it('should return false when process.platform is win32', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'win32'});

            // Act
            const result = isLinux();

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('cross-platform combinations', () => {
        it('should correctly detect darwin with x64', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'darwin', arch: 'x64'});

            // Act
            const platform = detectCurrentPlatform();
            const arch = detectCurrentArchitecture();

            // Assert
            expect(platform).toBe(Platform.Darwin);
            expect(arch).toBe(Architecture.X64);
        });

        it('should correctly detect darwin with arm64', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'darwin', arch: 'arm64'});

            // Act
            const platform = detectCurrentPlatform();
            const arch = detectCurrentArchitecture();

            // Assert
            expect(platform).toBe(Platform.Darwin);
            expect(arch).toBe(Architecture.ARM64);
        });

        it('should correctly detect linux with x64', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'linux', arch: 'x64'});

            // Act
            const platform = detectCurrentPlatform();
            const arch = detectCurrentArchitecture();

            // Assert
            expect(platform).toBe(Platform.Linux);
            expect(arch).toBe(Architecture.X64);
        });

        it('should correctly detect linux with arm64', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'linux', arch: 'arm64'});

            // Act
            const platform = detectCurrentPlatform();
            const arch = detectCurrentArchitecture();

            // Assert
            expect(platform).toBe(Platform.Linux);
            expect(arch).toBe(Architecture.ARM64);
        });

        it('should correctly detect windows with x64', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'win32', arch: 'x64'});

            // Act
            const platform = detectCurrentPlatform();
            const arch = detectCurrentArchitecture();

            // Assert
            expect(platform).toBe(Platform.Windows);
            expect(arch).toBe(Architecture.X64);
        });

        it('should correctly detect windows with arm64', () => {
            // Arrange
            vi.stubGlobal('process', {...process, platform: 'win32', arch: 'arm64'});

            // Act
            const platform = detectCurrentPlatform();
            const arch = detectCurrentArchitecture();

            // Assert
            expect(platform).toBe(Platform.Windows);
            expect(arch).toBe(Architecture.ARM64);
        });
    });
});
