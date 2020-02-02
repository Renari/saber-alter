module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  rules: {
    'no-console': 'error',
    'no-debugger': 'error',
    '@typescript-eslint/class-name-casing': 'off',
  },
  parserOptions: {
    parser: '@typescript-eslint/parser',
  },
};
