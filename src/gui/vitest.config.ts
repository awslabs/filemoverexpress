import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: [
            // Exact-match aliases MUST come before wildcards to take precedence
            {
                find: '@wailsio/runtime',
                replacement: path.resolve(__dirname, 'src/testing/mocks/wailsio-runtime.mock.ts'),
            },
            {find: '@wailsApp/fmeapp', replacement: path.resolve(__dirname, 'src/testing/mocks/wails-fmeapp.mock.ts')},
            {
                find: '@wailsApp/models',
                replacement: path.resolve(__dirname, 'src/gen/wails/github.com/awslabs/filemoverexpress/gui/models.ts'),
            },

            // baseUrl-relative imports (e.g., 'src/app/...' used without alias)
            {find: /^src\/(.*)$/, replacement: path.resolve(__dirname, 'src/$1')},

            // Wildcard path aliases (order does not matter among these)
            {find: /^@app\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/$1')},
            {find: /^@state\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/state/$1')},
            {find: /^@services\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/services/$1')},
            {find: /^@classes\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/classes/$1')},
            {find: /^@containers\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/components/containers/$1')},
            {find: /^@primitives\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/components/primitives/$1')},
            {find: /^@modals\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/components/modals/$1')},
            {find: /^@gen\/(.*)$/, replacement: path.resolve(__dirname, 'src/gen/$1')},
            {find: /^@connect\/(.*)$/, replacement: path.resolve(__dirname, 'src/connect/$1')},
            {find: /^@events\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/classes/events/$1')},
            {find: /^@fme\/(.*)$/, replacement: path.resolve(__dirname, 'src/app/modules/fme/$1')},
            {
                find: /^@wailsApp\/(.*)$/,
                replacement: path.resolve(__dirname, 'src/gen/wails/frontend/bindings/FileMoverExpressUI/$1'),
            },
            {
                find: /^@wailsRuntime\/(.*)$/,
                replacement: path.resolve(__dirname, 'src/gen/wails/frontend/bindings/github.com/wailsapp/wails/v3/$1'),
            },
        ],
    },
    test: {
        globals: true,
        environment: 'jsdom',
        // include: ['src/**/*.spec.ts'],
        setupFiles: ['src/testing/vitest-setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: [
                'lcov',
                'text-summary',
                'html',
            ],
            reportsDirectory: 'coverage/gui/vitest',
            exclude: ['src/gen/**', 'node_modules/**'],
        },
    },
});
