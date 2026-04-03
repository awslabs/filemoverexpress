import {describe, expect, it} from 'vitest';
import type {PlatformConfig} from './platform';
import {Architecture, Platform} from './platform';

describe('platform types', () => {
    describe('Platform enum', () => {
        it('should have Darwin value', () => {
            expect(Platform.Darwin).toBe('darwin');
        });

        it('should have Linux value', () => {
            expect(Platform.Linux).toBe('linux');
        });

        it('should have Windows value', () => {
            expect(Platform.Windows).toBe('windows');
        });

        it('should have exactly 4 platform values', () => {
            const values = Object.values(Platform);
            expect(values).toHaveLength(4);
        });

        it('should contain all expected platform values', () => {
            const values = Object.values(Platform);
            expect(values).toContain('darwin');
            expect(values).toContain('linux');
            expect(values).toContain('windows');
            expect(values).toContain('unknown');
        });
    });

    describe('Architecture enum', () => {
        it('should have X64 value', () => {
            expect(Architecture.X64).toBe('x64');
        });

        it('should have ARM64 value', () => {
            expect(Architecture.ARM64).toBe('arm64');
        });

        it('should have exactly 2 architecture values', () => {
            const values = Object.values(Architecture);
            expect(values).toHaveLength(2);
        });

        it('should contain all expected architecture values', () => {
            const values = Object.values(Architecture);
            expect(values).toContain('x64');
            expect(values).toContain('arm64');
        });
    });

    describe('PlatformConfig', () => {
        it('should accept valid PlatformConfig with Darwin and X64', () => {
            const config: PlatformConfig = {
                platform: Platform.Darwin,
                arch: Architecture.X64,
            };
            expect(config.platform).toBe(Platform.Darwin);
            expect(config.arch).toBe(Architecture.X64);
        });

        it('should accept valid PlatformConfig with Linux and ARM64', () => {
            const config: PlatformConfig = {
                platform: Platform.Linux,
                arch: Architecture.ARM64,
            };
            expect(config.platform).toBe(Platform.Linux);
            expect(config.arch).toBe(Architecture.ARM64);
        });

        it('should accept valid PlatformConfig with Windows and X64', () => {
            const config: PlatformConfig = {
                platform: Platform.Windows,
                arch: Architecture.X64,
            };
            expect(config.platform).toBe(Platform.Windows);
            expect(config.arch).toBe(Architecture.X64);
        });

        it('should accept all platform and architecture combinations', () => {
            const platforms = [Platform.Darwin, Platform.Linux, Platform.Windows];
            const architectures = [Architecture.X64, Architecture.ARM64];

            platforms.forEach((platform) => {
                architectures.forEach((arch) => {
                    const config: PlatformConfig = {platform, arch};
                    expect(config.platform).toBe(platform);
                    expect(config.arch).toBe(arch);
                });
            });
        });
    });
});
