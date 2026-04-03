import {describe, expect, it} from 'vitest';
import {Architecture, Platform} from '../types/platform';
import {guiConfig} from './gui-config';

describe('gui-config', () => {
    describe('required properties', () => {
        it('should have outputDir property', () => {
            expect(guiConfig).toHaveProperty('outputDir');
            expect(typeof guiConfig.outputDir).toBe('string');
        });

        it('should have sourceDir property', () => {
            expect(guiConfig).toHaveProperty('sourceDir');
            expect(typeof guiConfig.sourceDir).toBe('string');
        });

        it('should have platforms property', () => {
            expect(guiConfig).toHaveProperty('platforms');
            expect(Array.isArray(guiConfig.platforms)).toBe(true);
        });

        it('should have angularConfig property', () => {
            expect(guiConfig).toHaveProperty('angularConfig');
            expect(typeof guiConfig.angularConfig).toBe('object');
        });

        it('should have electronConfig property', () => {
            expect(guiConfig).toHaveProperty('electronConfig');
            expect(typeof guiConfig.electronConfig).toBe('object');
        });
    });

    describe('angularConfig properties', () => {
        it('should have project property', () => {
            expect(guiConfig.angularConfig).toHaveProperty('project');
            expect(typeof guiConfig.angularConfig.project).toBe('string');
        });

        it('should have configuration property', () => {
            expect(guiConfig.angularConfig).toHaveProperty('configuration');
            expect(['production', 'development']).toContain(guiConfig.angularConfig.configuration);
        });

        it('should have outputPath property', () => {
            expect(guiConfig.angularConfig).toHaveProperty('outputPath');
            expect(typeof guiConfig.angularConfig.outputPath).toBe('string');
        });

        it('should have baseHref property', () => {
            expect(guiConfig.angularConfig).toHaveProperty('baseHref');
            expect(typeof guiConfig.angularConfig.baseHref).toBe('string');
        });
    });

    describe('electronConfig properties', () => {
        it('should have appName property', () => {
            expect(guiConfig.electronConfig).toHaveProperty('appName');
            expect(typeof guiConfig.electronConfig.appName).toBe('string');
        });

        it('should have appBundleId property', () => {
            expect(guiConfig.electronConfig).toHaveProperty('appBundleId');
            expect(typeof guiConfig.electronConfig.appBundleId).toBe('string');
        });

        it('should have helperBundleId property', () => {
            expect(guiConfig.electronConfig).toHaveProperty('helperBundleId');
            expect(typeof guiConfig.electronConfig.helperBundleId).toBe('string');
        });

        it('should have iconPaths property', () => {
            expect(guiConfig.electronConfig).toHaveProperty('iconPaths');
            expect(typeof guiConfig.electronConfig.iconPaths).toBe('object');
        });

        it('should have packagerOptions property', () => {
            expect(guiConfig.electronConfig).toHaveProperty('packagerOptions');
            expect(typeof guiConfig.electronConfig.packagerOptions).toBe('object');
        });
    });

    describe('property types', () => {
        it('should have string type for outputDir', () => {
            expect(typeof guiConfig.outputDir).toBe('string');
            expect(guiConfig.outputDir.length).toBeGreaterThan(0);
        });

        it('should have string type for sourceDir', () => {
            expect(typeof guiConfig.sourceDir).toBe('string');
            expect(guiConfig.sourceDir.length).toBeGreaterThan(0);
        });

        it('should have array of PlatformConfig for platforms', () => {
            expect(Array.isArray(guiConfig.platforms)).toBe(true);
            guiConfig.platforms.forEach((config) => {
                expect(config).toHaveProperty('platform');
                expect(config).toHaveProperty('arch');
                expect(Object.values(Platform)).toContain(config.platform);
                expect(Object.values(Architecture)).toContain(config.arch);
            });
        });

        it('should have valid iconPaths for all platforms', () => {
            const iconPaths = guiConfig.electronConfig.iconPaths;
            expect(iconPaths[Platform.Darwin]).toBeDefined();
            expect(iconPaths[Platform.Linux]).toBeDefined();
            expect(iconPaths[Platform.Windows]).toBeDefined();
            expect(typeof iconPaths[Platform.Darwin]).toBe('string');
            expect(typeof iconPaths[Platform.Linux]).toBe('string');
            expect(typeof iconPaths[Platform.Windows]).toBe('string');
        });

        it('should have valid packagerOptions', () => {
            const options = guiConfig.electronConfig.packagerOptions;
            expect(typeof options.overwrite).toBe('boolean');
            expect(typeof options.prune).toBe('boolean');
            expect(typeof options.asar).toBe('boolean');
        });
    });

    describe('config values', () => {
        it('should have valid outputDir path', () => {
            expect(guiConfig.outputDir).toBe('dist');
        });

        it('should have valid sourceDir path', () => {
            expect(guiConfig.sourceDir).toBe('src/gui');
        });

        it('should have at least one platform configuration', () => {
            expect(guiConfig.platforms.length).toBeGreaterThan(0);
        });

        it('should have valid platform values', () => {
            const validPlatforms = [Platform.Darwin, Platform.Linux, Platform.Windows];
            guiConfig.platforms.forEach((config) => {
                expect(validPlatforms).toContain(config.platform);
            });
        });

        it('should have valid architecture values', () => {
            const validArchs = [Architecture.X64, Architecture.ARM64];
            guiConfig.platforms.forEach((config) => {
                expect(validArchs).toContain(config.arch);
            });
        });

        it('should have non-empty appName', () => {
            expect(guiConfig.electronConfig.appName.length).toBeGreaterThan(0);
        });

        it('should have valid bundle ID format', () => {
            expect(guiConfig.electronConfig.appBundleId).toMatch(/^[a-z0-9.]+$/);
            expect(guiConfig.electronConfig.helperBundleId).toMatch(/^[a-z0-9.]+$/);
        });

        it('should have valid icon file extensions', () => {
            expect(guiConfig.electronConfig.iconPaths[Platform.Darwin]).toMatch(/\.icns$/);
            expect(guiConfig.electronConfig.iconPaths[Platform.Linux]).toMatch(/\.png$/);
            expect(guiConfig.electronConfig.iconPaths[Platform.Windows]).toMatch(/\.ico$/);
        });
    });
});
