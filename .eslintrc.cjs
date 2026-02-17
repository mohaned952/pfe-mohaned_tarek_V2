module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  plugins: ['unused-imports'],
  extends: ['eslint:recommended', 'plugin:import/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'no-console': 'error',
    'import/no-unresolved': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'unused-imports/no-unused-imports': 'error',
    'no-unreachable': 'error'
  }
};
