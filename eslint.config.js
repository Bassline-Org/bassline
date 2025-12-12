import js from '@eslint/js'
import jsdoc from 'eslint-plugin-jsdoc'
import prettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  jsdoc.configs['flat/recommended-typescript-flavor'],
  prettier,
  {
    files: ['packages/*/src/**/*.js'],
    languageOptions: {
      globals: {
        // Node.js globals
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
      },
    },
    rules: {
      // === Core quality ===
      eqeqeq: ['error', 'always'], // Prevent == bugs
      'no-var': 'error', // Modern JS
      'prefer-const': 'warn', // Signal immutability
      'no-shadow': 'warn', // Prevent confusion

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
    },
  },
  {
    // Ignore generated files
    ignores: ['**/node_modules/**', '**/*.d.ts', 'docs/**'],
  },
]
