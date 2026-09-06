export default [
  {
    files: ['test/express.{json,raw,text,urlencoded}.js'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'AwaitExpression > CallExpression[callee.object.name="test"][callee.property.name=/^(set|write)$/]',
        message: 'Configure headers and write the body before awaiting the final request assertion.'
      }]
    }
  },
  {
    ignores: ['coverage/**', 'node_modules/**', 'reference/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
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
