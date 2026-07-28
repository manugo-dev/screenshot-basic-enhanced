import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    {
        ignores: ['dist/**', 'node_modules/**'],
    },

    js.configs.recommended,

    // type-aware linting for the three TypeScript targets; projectService picks
    // the nearest tsconfig.json (src/client, src/server or ui) per file
    {
        files: ['**/*.ts'],
        extends: [tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // FiveM natives, NUI messages and export callbacks are untyped by
            // nature, so the `any` boundary rules would only produce noise
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },

    // build tooling: CommonJS running on Node, with no type information
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: globals.node,
        },
    },

    // the flat config itself is ESM
    {
        files: ['**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: globals.node,
        },
    },

    // must stay last so formatting-related rules are switched off
    prettier,
);
