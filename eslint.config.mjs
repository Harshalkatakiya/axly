import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...fixupConfigRules(
    compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react-hooks/recommended',
      'plugin:prettier/recommended'
    )
  ),
  {
    plugins: {
      '@typescript-eslint': fixupPluginRules(typescriptEslint),
      react,
      'react-hooks': fixupPluginRules(reactHooks),
      'react-refresh': reactRefresh,
      prettier: fixupPluginRules(prettierPlugin)
    },

    languageOptions: {
      globals: {
        ...globals.browser
      },
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },

    settings: {
      react: {
        version: 'detect'
      }
    },

    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true
        }
      ],
      'prettier/prettier': 'error'
    }
  }
];
