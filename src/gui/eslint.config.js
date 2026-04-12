// @ts-check
const tsEslint = require('typescript-eslint');
const eslint = require('@eslint/js');
const stylistic = require('@stylistic/eslint-plugin');
const angularEslint = require('@angular-eslint/eslint-plugin');
const angularTemplateEslint = require('@angular-eslint/eslint-plugin-template');

module.exports = tsEslint.config({
    // Global ignores
    ignores: ['projects/**/*', 'dist/**', 'node_modules/**', 'coverage/**', '.angular/**', 'src/app/gen/**'],
}, {
    // TypeScript files configuration
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tsEslint.configs.recommended, ...tsEslint.configs.stylistic],
    plugins: {
        '@angular-eslint': angularEslint, '@stylistic': stylistic,
    },
    processor: angularTemplateEslint.processors['extract-inline-html'],
    languageOptions: {
        parserOptions: {
            project: ['tsconfig.json'],
        },
    },
    rules: {
        // Angular recommended rules
        ...angularEslint.configs.recommended.rules,

        // Override certain Angular rules
        '@angular-eslint/prefer-standalone': 'off',

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
}, {
    // HTML template files configuration
    files: ['**/*.html'], plugins: {
        '@angular-eslint/template': angularTemplateEslint,
    }, languageOptions: {
        parser: require('@angular-eslint/template-parser'),
    }, rules: {
        ...angularTemplateEslint.configs.recommended.rules, ...angularTemplateEslint.configs.accessibility.rules,

        // Disable built-in angular lint checks until we can implement a long term solution
        '@angular-eslint/template/click-events-have-key-events': 'off', '@angular-eslint/template/interactive-supports-focus': 'off',
    },
});
