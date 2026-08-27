// @ts-check
import tsEslint from 'typescript-eslint';
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import angular from 'angular-eslint';

export default tsEslint.config(
    // Global ignores
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.angular/**', 'src/gen/**'],
    },
    // TypeScript files configuration
    {
        files: ['**/*.ts'],
        extends: [
            eslint.configs.recommended,
            ...tsEslint.configs.recommended,
            ...tsEslint.configs.stylistic,
            ...angular.configs.tsRecommended,
        ],
        processor: angular.processInlineTemplates,
        languageOptions: {
            parserOptions: {
                project: ['tsconfig.json'],
            },
        },
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            // Override certain Angular rules
            '@angular-eslint/prefer-standalone': 'off',
            '@angular-eslint/prefer-on-push-component-change-detection': 'off',

            // Formatting rules (using @stylistic plugin)
            '@stylistic/indent': ['error', 4],
            '@stylistic/arrow-parens': 'error',
            '@stylistic/brace-style': 'error',
            '@stylistic/comma-dangle': ['error', {
                'arrays': 'always-multiline',
                'objects': 'always-multiline',
                'imports': 'always-multiline',
                'exports': 'always-multiline',
                'functions': 'always-multiline',
            }],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/array-element-newline': ['error', {
                'minItems': 3,
            }],
            '@stylistic/array-bracket-newline': ['error', 'consistent'],
            '@stylistic/quotes': ['error', 'single', {
                'avoidEscape': true,
            }],

            // Core ESLint rules
            'curly': ['error', 'all'],

            // TypeScript specific rules
            '@typescript-eslint/no-unused-vars': ['error', {
                'argsIgnorePattern': '^__',
            }],

            // Angular specific rules
            '@angular-eslint/directive-selector': ['error', {
                'type': 'attribute', 'prefix': 'fme', 'style': 'camelCase',
            }],
            '@angular-eslint/component-selector': ['error', {
                'type': 'element', 'prefix': 'fme', 'style': 'kebab-case',
            }],

            // Error detection rules
            'no-sparse-arrays': ['error'],
            'no-dupe-keys': ['error'],
        },
    },
    {
        // HTML template files configuration
        files: ['**/*.html'],
        extends: [
            ...angular.configs.templateRecommended,
            ...angular.configs.templateAccessibility,
        ],
        rules: {
            // Disable built-in angular lint checks until we can implement a long term solution
            '@angular-eslint/template/click-events-have-key-events': 'off',
            '@angular-eslint/template/interactive-supports-focus': 'off',
        },
    },
);
