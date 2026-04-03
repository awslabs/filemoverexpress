import {describe, expect, it} from 'vitest';
import type {BuildArgs, BuildOptions} from './build-target';
import {Architecture, Platform} from './platform';

describe('build-target types', () => {
    describe('BuildArgs', () => {
        it('should accept valid BuildArgs with cli component', () => {
            const buildArgs: BuildArgs = {
                component: 'cli',
                target: 'build',
                options: {},
            };
            expect(buildArgs.component).toBe('cli');
            expect(buildArgs.target).toBe('build');
        });

        it('should accept valid BuildArgs with gui component', () => {
            const buildArgs: BuildArgs = {
                component: 'gui',
                target: 'build',
                options: {},
            };
            expect(buildArgs.component).toBe('gui');
            expect(buildArgs.target).toBe('build');
        });

        it('should accept BuildArgs with options', () => {
            const buildArgs: BuildArgs = {
                component: 'cli',
                target: 'build',
                options: {
                    archs: [Architecture.X64],
                    platforms: [Platform.Darwin],
                    production: true,
                    verbose: false,
                },
            };
            expect(buildArgs.options.archs).toEqual([Architecture.X64]);
            expect(buildArgs.options.platforms).toEqual([Platform.Darwin]);
            expect(buildArgs.options.production).toBe(true);
            expect(buildArgs.options.verbose).toBe(false);
        });
    });

    describe('BuildOptions', () => {
        it('should accept empty BuildOptions', () => {
            const options: BuildOptions = {};
            expect(options).toBeDefined();
        });

        it('should accept BuildOptions with archs', () => {
            const options: BuildOptions = {
                archs: [Architecture.X64, Architecture.ARM64],
            };
            expect(options.archs).toEqual([Architecture.X64, Architecture.ARM64]);
        });

        it('should accept BuildOptions with platforms', () => {
            const options: BuildOptions = {
                platforms: [Platform.Darwin, Platform.Linux, Platform.Windows],
            };
            expect(options.platforms).toEqual([Platform.Darwin, Platform.Linux, Platform.Windows]);
        });

        it('should accept BuildOptions with production flag', () => {
            const options: BuildOptions = {
                production: true,
            };
            expect(options.production).toBe(true);
        });

        it('should accept BuildOptions with verbose flag', () => {
            const options: BuildOptions = {
                verbose: true,
            };
            expect(options.verbose).toBe(true);
        });

        it('should accept BuildOptions with all properties', () => {
            const options: BuildOptions = {
                archs: [Architecture.X64],
                platforms: [Platform.Darwin],
                production: true,
                verbose: false,
            };
            expect(options.archs).toEqual([Architecture.X64]);
            expect(options.platforms).toEqual([Platform.Darwin]);
            expect(options.production).toBe(true);
            expect(options.verbose).toBe(false);
        });
    });
});
