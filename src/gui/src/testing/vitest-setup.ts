/**
 * Vitest setup file for Angular GUI tests.
 *
 * This file provides browser API mocks required by Angular Material in jsdom.
 *
 * NOTE: Zone.js initialization and TestBed.initTestEnvironment are handled
 * automatically by the @angular/build:unit-test builder. Do NOT call
 * TestBed.initTestEnvironment here — it will cause a "Cannot set base
 * providers because it has already been called" error.
 */

import { vi } from 'vitest';

// --- Browser API mocks (must be defined before TestBed init) ---

// localStorage mock — jsdom may not provide localStorage in all environments
if (typeof window.localStorage === 'undefined' || window.localStorage === null) {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
        value: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                storage.set(key, value); 
            },
            removeItem: (key: string) => {
                storage.delete(key); 
            },
            clear: () => {
                storage.clear(); 
            },
            get length() {
                return storage.size; 
            },
            key: (index: number) => [...storage.keys()][index] ?? null,
        },
        writable: true,
    });
}

// ResizeObserver mock — Angular Material and CDK components use this API
global.ResizeObserver = class ResizeObserver {
    observe(): void { /* noop */ }
    unobserve(): void { /* noop */ }
    disconnect(): void { /* noop */ }
};

// window.matchMedia mock — Angular Material responsive components require this
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// getComputedStyle mock — provide if not already available in jsdom
if (typeof window.getComputedStyle === 'undefined') {
    Object.defineProperty(window, 'getComputedStyle', {
        value: () => ({
            display: 'none',
            appearance: '',
            getPropertyValue: () => '',
        }),
    });
}
