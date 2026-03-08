'use strict';

module.exports = [
  {
    ignores: ['coverage/**', 'node_modules/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        Buffer: 'readonly'
      }
    },
    rules: {
      'eol-last': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      indent: ['error', 2, { MemberExpression: 'off', SwitchCase: 1 }],
      'no-restricted-globals': [
        'error',
        {
          name: 'Buffer',
          message: 'Use `import { Buffer } from "node:buffer"` instead of the global Buffer.'
        }
      ],
      'no-trailing-spaces': 'error',
      'no-unused-vars': ['error', { vars: 'all', args: 'none', ignoreRestSiblings: true }]
    }
  }
];
