import js from '@eslint/js'
import jsdoc from 'eslint-plugin-jsdoc'
import prettier from 'eslint-config-prettier'

// Shared Node.js globals
const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
}

// Shared rules for source files
const sourceRules = {
  // === Core quality ===
  eqeqeq: ['error', 'always'], // Prevent == bugs
  'no-var': 'error', // Modern JS
  'prefer-const': 'warn', // Signal immutability
  'no-shadow': 'warn', // Prevent confusion
  'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],

  // === Async patterns (critical for resource model) ===
  'no-async-promise-executor': 'error', // Antipattern
  'require-await': 'warn', // Catch unnecessary async
  'no-return-await': 'warn', // Cleaner code

  // === Prevent common bugs ===
  'no-template-curly-in-string': 'warn', // Catch 'Hello ${name}' typos
  'no-self-compare': 'error', // x === x is always a bug
  'no-unused-private-class-members': 'error',

  // === JSDoc (relax some defaults) ===
  'jsdoc/require-jsdoc': 'off',
  'jsdoc/require-param-description': 'off',
  'jsdoc/require-param-type': 'off',
  'jsdoc/require-returns': 'off',
  'jsdoc/require-returns-description': 'off',
  'jsdoc/check-param-names': 'error', // Param names match function
  'jsdoc/check-types': 'warn', // Valid type syntax
}

export default [
  js.configs.recommended,
  jsdoc.configs['flat/recommended-typescript-flavor'],
  prettier,
  // Source files
  {
    files: ['packages/*/src/**/*.js', 'apps/*/src/**/*.js'],
    languageOptions: {
      globals: nodeGlobals,
    },
    rules: sourceRules,
  },
  // Test files
  {
    files: ['packages/*/test/**/*.js', 'apps/*/test/**/*.js', 'test/**/*.js'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      ...sourceRules,
      // Relax some rules for tests
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'require-await': 'off', // Tests often have async without await for setup
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/check-param-names': 'off',
      'jsdoc/check-types': 'off',
    },
  },
  {
    // Ignore generated files and experimental packages
    ignores: ['**/node_modules/**', '**/*.d.ts', 'docs/**', 'packages/tcl/**'],
  },
]
