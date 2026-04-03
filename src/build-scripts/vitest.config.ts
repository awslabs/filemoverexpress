import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        // Test environment
        environment: 'node',

        // Test file patterns
        include: ['**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['**/*.ts'],
            exclude: [
                '**/*.test.ts',
                'node_modules/**',
                'dist/**',
                'types/**',
                '**/prettier.config.ts',
            ],
            thresholds: {
                lines: 80,
                branches: 75,
                functions: 80,
                statements: 90,
            },
        },

        // Globals (optional, for describe/it/expect without imports)
        globals: true,

        // Timeout for async tests
        testTimeout: 10000,

        // Allow running with no tests (useful during initial setup)
        passWithNoTests: true,
    },
});
