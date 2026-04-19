import {describe, expect, it} from 'vitest';
import type {BuildComponent} from './cli';

describe('cli types', () => {
    describe('BuildComponent', () => {
        it('should accept cli as valid BuildComponent', () => {
            const component: BuildComponent = 'cli';
            expect(component).toBe('cli');
        });

        it('should accept gui as valid BuildComponent', () => {
            const component: BuildComponent = 'gui';
            expect(component).toBe('gui');
        });

        it('should accept electron as valid BuildComponent', () => {
            const component: BuildComponent = 'electron';
            expect(component).toBe('electron');
        });

        it('should accept proto as valid BuildComponent', () => {
            const component: BuildComponent = 'proto';
            expect(component).toBe('proto');
        });

        it('should accept package as valid BuildComponent', () => {
            const component: BuildComponent = 'package';
            expect(component).toBe('package');
        });

        it('should accept install as valid BuildComponent', () => {
            const component: BuildComponent = 'install';
            expect(component).toBe('install');
        });

        it('should accept installer as valid BuildComponent', () => {
            const component: BuildComponent = 'installer';
            expect(component).toBe('installer');
        });

        it('should validate all BuildComponent values', () => {
            const validComponents: BuildComponent[] = ['cli', 'gui', 'electron', 'proto', 'package', 'install', 'installer'];
            validComponents.forEach((component) => {
                expect(['cli', 'gui', 'electron', 'proto', 'package', 'install', 'installer']).toContain(component);
            });
        });
    });
});
