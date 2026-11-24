import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import nodePlugin from 'eslint-plugin-n';
import globals from 'globals';

export default [
  {
    ignores: ['eslint.config.mjs', 'types/**'],
  },
  js.configs.recommended,
  nodePlugin.configs['flat/recommended'],
  importX.flatConfigs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // -------------------
      // Relaxing some rules
      // -------------------

      'no-console': 'off',
      'n/no-process-exit': 'off',

      // ----------------------------------
      // Adding more eslint rules as errors
      // ----------------------------------

      // Disallow Unused Variables
      // https://eslint.org/docs/rules/no-unused-vars
      'no-unused-vars': ['error', { vars: 'all', caughtErrors: 'none' }],
      // require using arrow functions as callbacks
      // https://eslint.org/docs/rules/prefer-arrow-callback
      'prefer-arrow-callback': 'error',
      // require using template literals instead of string concatenation
      // http://eslint.org/docs/rules/prefer-template
      'prefer-template': 'error',
      // require using of const declaration for variables that are never modified after declared
      // https://eslint.org/docs/rules/prefer-const
      'prefer-const': 'error',
      // disallow modifying variables that are declared using const
      // https://eslint.org/docs/rules/no-const-assign
      'no-const-assign': 'error',
      // require let or const instead of var
      // https://eslint.org/docs/rules/no-var
      'no-var': 'error',

      // ------------------------------------
      // Adding more eslint rules as warnings
      // ------------------------------------

      // require at least one whitespace after comments( // and /*)
      // https://eslint.org/docs/rules/spaced-comment
      // `///` for TypeScript's triple-slash directives
      'spaced-comment': ['warn', 'always', { markers: ['/'] }],
      // Require Following Curly Brace Conventions
      // https://eslint.org/docs/rules/curly
      curly: ['warn', 'all'],

      'import-x/order': [
        'warn',
        {
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          'newlines-between': 'always',
        },
      ],
    },
  },
  // Test files: add mocha globals
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
  },
];
