import {describe, expect, it} from 'vitest';
import {Architecture, Platform} from '../types/platform';
import {cliConfig} from './cli-config';

describe('cli-config', () => {
    describe('required properties', () => {
        it('should have outputDir property', () => {
            expect(cliConfig).toHaveProperty('outputDir');
            expect(typeof cliConfig.outputDir).toBe('string');
        });

        it('should have sourceDir property', () => {
            expect(cliConfig).toHaveProperty('sourceDir');
            expect(typeof cliConfig.sourceDir).toBe('string');
        });

        it('should have goVersion property', () => {
            expect(cliConfig).toHaveProperty('goVersion');
            expect(typeof cliConfig.goVersion).toBe('string');
        });

        it('should have buildFlags property', () => {
            expect(cliConfig).toHaveProperty('buildFlags');
            expect(Array.isArray(cliConfig.buildFlags)).toBe(true);
        });

        it('should have ldFlags property', () => {
            expect(cliConfig).toHaveProperty('ldFlags');
            expect(Array.isArray(cliConfig.ldFlags)).toBe(true);
        });

        it('should have platforms property', () => {
            expect(cliConfig).toHaveProperty('platforms');
            expect(Array.isArray(cliConfig.platforms)).toBe(true);
        });
    });

    describe('property types', () => {
        it('should have string type for outputDir', () => {
            expect(typeof cliConfig.outputDir).toBe('string');
            expect(cliConfig.outputDir.length).toBeGreaterThan(0);
        });

        it('should have string type for sourceDir', () => {
            expect(typeof cliConfig.sourceDir).toBe('string');
            expect(cliConfig.sourceDir.length).toBeGreaterThan(0);
        });

        it('should have string type for goVersion', () => {
            expect(typeof cliConfig.goVersion).toBe('string');
            expect(cliConfig.goVersion.length).toBeGreaterThan(0);
        });

        it('should have array of strings for buildFlags', () => {
            expect(Array.isArray(cliConfig.buildFlags)).toBe(true);
            cliConfig.buildFlags.forEach((flag) => {
                expect(typeof flag).toBe('string');
            });
        });

        it('should have array of strings for ldFlags', () => {
            expect(Array.isArray(cliConfig.ldFlags)).toBe(true);
            cliConfig.ldFlags.forEach((flag) => {
                expect(typeof flag).toBe('string');
            });
        });

        it('should have array of PlatformConfig for platforms', () => {
            expect(Array.isArray(cliConfig.platforms)).toBe(true);
            cliConfig.platforms.forEach((config) => {
                expect(config).toHaveProperty('platform');
                expect(config).toHaveProperty('arch');
                expect(Object.values(Platform)).toContain(config.platform);
                expect(Object.values(Architecture)).toContain(config.arch);
            });
        });

        it('should have optional string type for windowsDaemonLauncherPath', () => {
            if (cliConfig.windowsDaemonLauncherPath !== undefined) {
                expect(typeof cliConfig.windowsDaemonLauncherPath).toBe('string');
            }
        });
    });

    describe('config values', () => {
        it('should have valid outputDir path', () => {
            expect(cliConfig.outputDir).toBe('dist');
        });

        it('should have valid sourceDir path', () => {
            expect(cliConfig.sourceDir).toBe('src/cli');
        });

        it('should have valid goVersion format', () => {
            expect(cliConfig.goVersion).toMatch(/^\d+\.\d+\.\d+$/);
        });

        it('should have non-empty buildFlags', () => {
            expect(cliConfig.buildFlags.length).toBeGreaterThan(0);
        });

        it('should have non-empty ldFlags', () => {
            expect(cliConfig.ldFlags.length).toBeGreaterThan(0);
        });

        it('should have at least one platform configuration', () => {
            expect(cliConfig.platforms.length).toBeGreaterThan(0);
        });

        it('should have valid platform values', () => {
            const validPlatforms = [Platform.Darwin, Platform.Linux, Platform.Windows];
            cliConfig.platforms.forEach((config) => {
                expect(validPlatforms).toContain(config.platform);
            });
        });

        it('should have valid architecture values', () => {
            const validArchs = [Architecture.X64, Architecture.ARM64];
            cliConfig.platforms.forEach((config) => {
                expect(validArchs).toContain(config.arch);
            });
        });
    });
});
