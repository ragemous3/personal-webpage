import js from '@eslint/js';
import typescriptParser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import sortImports from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';
/*
 * TODO: Currently need to use knip to discover unused imports / exports.
 * need to get eslint-plugin-imports when it is working for eslint 10.
 *  */

const tsFiles = ['**/*.{ts,tsx,mts,cts}'];
const jsFiles = ['**/*.{js,mjs,cjs}'];

const testFiles = [
  '**/*.test.{ts,tsx,js,mjs,cjs}',
  '**/*.spec.{ts,tsx,js,mjs,cjs}',
  '**/__tests__/**/*.{ts,tsx,js,mjs,cjs}',
];

const sharedPlugins = {
  'simple-import-sort': sortImports,
  'import-x': importX,
  sonarjs,
};

const sharedLanguageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
};

const sharedRules = {
  /**
   * General correctness / readability
   */
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  curly: ['error', 'all'],
  'no-implicit-coercion': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
  'object-shorthand': 'error',
  'prefer-template': 'error',
  'default-case-last': 'error',
  'no-else-return': ['error', { allowElseIf: false }],
  'no-nested-ternary': 'error',
  'no-unreachable': 'error',

  'no-console': ['error', { allow: ['error', 'info', 'table'] }],
  'prefer-arrow-callback': 'error',
  'arrow-body-style': ['error', 'as-needed'],

  /**
   * Imports
   */
  'simple-import-sort/imports': 'error',
  'simple-import-sort/exports': 'error',
  'no-duplicate-imports': 'error',

  /**
   * Code-smell detection
   */
  complexity: ['error', 8],
  'max-depth': ['error', 2],
  'max-params': ['error', 5],
  'max-lines-per-function': [
    'error',
    {
      max: 80,
      skipBlankLines: true,
      skipComments: true,
    },
  ],

  /**
   * SonarJS smell rules
   */
  'sonarjs/cognitive-complexity': ['error', 12],
  'sonarjs/no-duplicated-branches': 'error',
  'sonarjs/no-all-duplicated-branches': 'error',
  'sonarjs/no-identical-functions': 'error',
  'sonarjs/no-identical-conditions': 'error',
  'sonarjs/no-identical-expressions': 'error',
  'sonarjs/no-collapsible-if': 'error',
  'sonarjs/no-redundant-boolean': 'error',
  'sonarjs/prefer-single-boolean-return': 'error',
  'sonarjs/prefer-immediate-return': 'error',

  /**
   * Unicorn - Setting recommends to off
   */

  'unicorn/no-null': 'off',
};

const jsRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: ['../*'],
    },
  ],
};

const tsRules = {
  'import-x/no-restricted-paths': [
    'error',
    {
      basePath: import.meta.dirname,
      zones: [
        {
          target: './assets/layers/views/**/*',
          from: './assets/layers/data/**/*',
          message: 'View must not import from Data.',
        },
        {
          target: './assets/layers/data/**/*',
          from: './assets/layers/services/**/*',
          message: 'Data must not import from services.',
        },
        {
          target: './assets/layers/data/**/*',
          from: './assets/layers/views/**/*',
          message: 'Data must not import from views.',
        },
        {
          target: './assets/layers/services/**/*',
          from: './assets/layers/views/**/*',
          message: 'Services must not import from views.',
        },
      ],
    },
  ],
  /**
   * TypeScript replaces the core rule.
   */
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],

  /**
   * Class structure
   */
  '@typescript-eslint/member-ordering': [
    'error',
    {
      default: [
        'public-static-field',
        'protected-static-field',
        'private-static-field',

        'public-instance-field',
        'protected-instance-field',
        'private-instance-field',

        'constructor',

        'public-static-method',
        'protected-static-method',
        'private-static-method',

        'public-instance-method',
        'protected-instance-method',
        'private-instance-method',
      ],
    },
  ],

  '@typescript-eslint/explicit-member-accessibility': [
    'error',
    {
      accessibility: 'no-public',
    },
  ],

  /**
   * Return types.
   *
   * This is less aggressive than your original config. It still encourages
   * explicit API boundaries without fighting local inference everywhere.
   */
  '@typescript-eslint/explicit-function-return-type': [
    'error',
    {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true,
    },
  ],

  /**
   * Type-safety
   */
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': [
    'error',
    {
      checksVoidReturn: {
        attributes: false,
      },
    },
  ],
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/require-await': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-unnecessary-type-parameters': 'error',
  '@typescript-eslint/no-base-to-string': 'error',

  '@typescript-eslint/restrict-template-expressions': [
    'error',
    {
      allowNumber: true,
      allowBoolean: false,
      allowAny: false,
      allowNullish: false,
    },
  ],

  /**
   * Type imports / exports
   */
  '@typescript-eslint/consistent-type-imports': [
    'error',
    {
      prefer: 'type-imports',
      fixStyle: 'inline-type-imports',
    },
  ],
  '@typescript-eslint/consistent-type-exports': 'error',
  '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
  '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

  /**
   * Prevent `any` from leaking.
   */
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',

  /**
   * Modern TS style
   */
  '@typescript-eslint/prefer-nullish-coalescing': [
    'error',
    {
      ignoreConditionalTests: true,
      ignoreMixedLogicalExpressions: true,
    },
  ],
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/prefer-readonly': 'error',

  '@typescript-eslint/unbound-method': 'error',
  '@typescript-eslint/no-confusing-void-expression': [
    'error',
    {
      ignoreArrowShorthand: true,
    },
  ],

  /**
   * Restrict parent-relative imports in TS.
   */
  'no-restricted-imports': 'off',
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          // eslint-disable-next-line unicorn/prefer-string-raw
          regex: '^\\.\\.(?:/|$)',
          message: 'Use the configured path alias instead of parent-relative imports.',
        },
      ],
    },
  ],
};

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    'public/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '.next/**',
    '.turbo/**',
    '.cache/**',
    '*.generated.*',
    '**/*.generated.*',
    '**/generated/**',
  ]),

  /**
   * JavaScript files.
   *
   * Keep this block mostly for config files, scripts, and plain JS utilities.
   */
  {
    files: jsFiles,
    languageOptions: {
      ...sharedLanguageOptions,
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      ...sharedPlugins,
    },
    extends: [js.configs.recommended, unicorn.configs.recommended],
    rules: {
      ...sharedRules,
      ...jsRules,
    },
  },

  /**
   * TypeScript files.
   */
  {
    files: tsFiles,
    languageOptions: {
      ...sharedLanguageOptions,
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
      ...sharedPlugins,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['tsconfig.json'],
          alwaysTryTypes: true,
        }),
      ],
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      unicorn.configs.recommended,
      'import-x/flat/recommended',
    ],
    rules: {
      'import-x/no-dynamic-require': 'warn',
      ...sharedRules,
      ...tsRules,
    },
  },

  /**
   * Node/server files.
   */
  {
    files: [
      './server/**/*.{ts,tsx,js,mjs,cjs}',
      'scripts/**/*.{ts,tsx,js,mjs,cjs}',
      '*.{config,conf}.{ts,js,mjs,cjs}',
      '*.config.{ts,js,mjs,cjs}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  /**
   * Tests.
   */
  {
    files: testFiles,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',

      '@typescript-eslint/unbound-method': 'off',

      'max-lines-per-function': 'off',
      'max-params': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-identical-functions': 'off',

      'no-console': 'off',
    },
  },
  /**
   * Prettier owns formatting.
   */
  prettier,
]);
