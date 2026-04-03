import {describe, expect, it} from 'vitest';
import {Platform} from '../types/platform';
import {electronConfig} from './electron-config';

describe('electron-config', () => {
    describe('required properties', () => {
        it('should have outputDir property', () => {
            expect(electronConfig).toHaveProperty('outputDir');
            expect(typeof electronConfig.outputDir).toBe('string');
        });

        it('should have sourceDir property', () => {
            expect(electronConfig).toHaveProperty('sourceDir');
            expect(typeof electronConfig.sourceDir).toBe('string');
        });

        it('should have platforms property', () => {
            expect(electronConfig).toHaveProperty('platforms');
            expect(Array.isArray(electronConfig.platforms)).toBe(true);
        });

        it('should have appName property', () => {
            expect(electronConfig).toHaveProperty('appName');
            expect(typeof electronConfig.appName).toBe('string');
        });

        it('should have appBundleId property', () => {
            expect(electronConfig).toHaveProperty('appBundleId');
            expect(typeof electronConfig.appBundleId).toBe('string');
        });

        it('should have helperBundleId property', () => {
            expect(electronConfig).toHaveProperty('helperBundleId');
            expect(typeof electronConfig.helperBundleId).toBe('string');
        });

        it('should have iconPaths property', () => {
            expect(electronConfig).toHaveProperty('iconPaths');
            expect(typeof electronConfig.iconPaths).toBe('object');
        });

        it('should have packagerOptions property', () => {
            expect(electronConfig).toHaveProperty('packagerOptions');
            expect(typeof electronConfig.packagerOptions).toBe('object');
        });
    });

    describe('property types', () => {
        it('should have string type for outputDir', () => {
            expect(typeof electronConfig.outputDir).toBe('string');
            expect(electronConfig.outputDir.length).toBeGreaterThan(0);
        });

        it('should have string type for sourceDir', () => {
            expect(typeof electronConfig.sourceDir).toBe('string');
            expect(electronConfig.sourceDir.length).toBeGreaterThan(0);
        });

        it('should have string type for appName', () => {
            expect(typeof electronConfig.appName).toBe('string');
            expect(electronConfig.appName.length).toBeGreaterThan(0);
        });

        it('should have string type for appBundleId', () => {
            expect(typeof electronConfig.appBundleId).toBe('string');
            expect(electronConfig.appBundleId.length).toBeGreaterThan(0);
        });

        it('should have string type for helperBundleId', () => {
            expect(typeof electronConfig.helperBundleId).toBe('string');
            expect(electronConfig.helperBundleId.length).toBeGreaterThan(0);
        });

        it('should have array type for platforms', () => {
            expect(Array.isArray(electronConfig.platforms)).toBe(true);
        });

        it('should have valid iconPaths for all platforms', () => {
            const iconPaths = electronConfig.iconPaths;
            expect(iconPaths[Platform.Darwin]).toBeDefined();
            expect(iconPaths[Platform.Linux]).toBeDefined();
            expect(iconPaths[Platform.Windows]).toBeDefined();
            expect(typeof iconPaths[Platform.Darwin]).toBe('string');
            expect(typeof iconPaths[Platform.Linux]).toBe('string');
            expect(typeof iconPaths[Platform.Windows]).toBe('string');
        });

        it('should have valid packagerOptions', () => {
            const options = electronConfig.packagerOptions;
            expect(typeof options.overwrite).toBe('boolean');
            expect(typeof options.prune).toBe('boolean');
            expect(typeof options.asar).toBe('boolean');
        });
    });

    describe('config values', () => {
        it('should have valid outputDir path', () => {
            expect(electronConfig.outputDir).toBe('dist/electron');
        });

        it('should have valid sourceDir path', () => {
            expect(electronConfig.sourceDir).toBe('src/electron');
        });

        it('should have non-empty appName', () => {
            expect(electronConfig.appName.length).toBeGreaterThan(0);
        });

        it('should have valid bundle ID format', () => {
            expect(electronConfig.appBundleId).toMatch(/^[a-z0-9.]+$/);
            expect(electronConfig.helperBundleId).toMatch(/^[a-z0-9.]+$/);
        });

        it('should have valid icon file extensions', () => {
            expect(electronConfig.iconPaths[Platform.Darwin]).toMatch(/\.icns$/);
            expect(electronConfig.iconPaths[Platform.Linux]).toMatch(/\.png$/);
            expect(electronConfig.iconPaths[Platform.Windows]).toMatch(/\.ico$/);
        });

        it('should have valid packagerOptions values', () => {
            expect(typeof electronConfig.packagerOptions.overwrite).toBe('boolean');
            expect(typeof electronConfig.packagerOptions.prune).toBe('boolean');
            expect(typeof electronConfig.packagerOptions.asar).toBe('boolean');
        });

        it('should have icon paths starting with assets/', () => {
            expect(electronConfig.iconPaths[Platform.Darwin]).toMatch(/^assets\//);
            expect(electronConfig.iconPaths[Platform.Linux]).toMatch(/^assets\//);
            expect(electronConfig.iconPaths[Platform.Windows]).toMatch(/^assets\//);
        });
    });
});
