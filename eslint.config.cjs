module.exports = [
  ...require('eslint-config-canonical/configurations/auto'),
  {
    ignores: ['**/dist/', '**/package-lock.json'],
  },
];
