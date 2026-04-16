import js from '@eslint/js'
import jsdoc from 'eslint-plugin-jsdoc'
import prettier from 'eslint-config-prettier'

// Globals available in both Node 18+ and modern browsers
const sharedGlobals = {
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
  EventTarget: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  queueMicrotask: 'readonly',
  document: 'readonly',
  WebSocket: 'readonly',
  self: 'readonly',
  Worker: 'readonly',
  crypto: 'readonly',
  AbortController: 'readonly',
}

// Shared rules for source files
const sourceRules = {
  // === Core quality ===
  eqeqeq: ['error', 'always', { null: 'ignore' }], // Allow == null (nullish idiom)
  'no-var': 'error', // Modern JS
  'prefer-const': 'warn', // Signal immutability
  'no-shadow': 'off', // Prevent confusion
  'no-unused-vars': [
    'error',
    { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
  ],

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
  // All JS source files
  {
    files: ['**/*.js'],
    ignores: ['**/node_modules/**'],
    languageOptions: {
      globals: sharedGlobals,
    },
    rules: sourceRules,
  },
  // Test files — relax some rules
  {
    files: ['**/test/**/*.js'],
    languageOptions: {
      globals: {
        ...sharedGlobals,
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
      'require-await': 'off', // Tests often have async without await for setup
      'jsdoc/check-param-names': 'off',
      'jsdoc/check-types': 'off',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/*.d.ts'],
  },
]
