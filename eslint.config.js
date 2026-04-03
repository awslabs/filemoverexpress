// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require("eslint/config");
const stylistic = require('@stylistic/eslint-plugin');

module.exports = defineConfig([
	{
		// TypeScript files configuration
		files: ['build-scripts/**/*.ts'],
		extends: [eslint.configs.recommended],
		plugins: {'@stylistic': stylistic},
		rules: {
			'@stylistic/indent': ['error', 4],
			'@stylistic/arrow-parens': 'error',
			'@stylistic/brace-style': 'error',
			'@stylistic/comma-dangle': [
				'error',
				{
					'arrays': 'always-multiline',
					'objects': 'always-multiline',
					'imports': 'always-multiline',
					'exports': 'never',
					'functions': 'always-multiline',
				},
			],
			'@stylistic/semi': ['error', 'always'],
			'@stylistic/array-element-newline': [
				'error',
				{
					'minItems': 3,
				},
			],
			'@stylistic/array-bracket-newline': ['error', 'consistent'],
			'@stylistic/quotes': [
				'error',
				'single',
				{
					'avoidEscape': true,
				},
			],
			'curly': ['error', 'all'],
			'no-sparse-arrays': ['error'],
			'no-dupe-keys': ['error'],
		},
	},
]);
