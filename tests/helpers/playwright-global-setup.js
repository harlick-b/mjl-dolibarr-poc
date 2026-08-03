const { verifyDisposableEnvironment } = require('./verify-disposable-environment');

module.exports = function playwrightGlobalSetup() {
  verifyDisposableEnvironment();
};
