import js from '@eslint/js'
import jsdoc from 'eslint-plugin-jsdoc'
import prettier from 'eslint-config-prettier'

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

const sourceRules = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'warn',
  'no-unused-vars': [
    'error',
    { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
  ],

  'no-async-promise-executor': 'error',
  'no-template-curly-in-string': 'warn',
  'no-self-compare': 'error',

  // i'm ignoring this for now, will add later
  'jsdoc/require-jsdoc': 'off',
  'jsdoc/require-param-description': 'off',
  'jsdoc/require-param-type': 'off',
  'jsdoc/require-returns': 'off',
  'jsdoc/require-returns-description': 'off',
  'jsdoc/check-param-names': 'error',
  'jsdoc/check-types': 'error',
}

export default [
  js.configs.recommended,
  jsdoc.configs['flat/recommended-typescript-flavor'],
  prettier,
  {
    files: ['**/*.js'],
    ignores: ['**/node_modules/**'],
    languageOptions: {
      globals: sharedGlobals,
    },
    rules: sourceRules,
  },
  {
    ignores: ['**/node_modules/**', '**/*.d.ts'],
  },
]
