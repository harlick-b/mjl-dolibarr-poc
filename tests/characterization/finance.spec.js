const { test } = require('@playwright/test');

const { verifyDisposableEnvironment } = require('../helpers/verify-disposable-environment');

test.beforeAll(() => {
  verifyDisposableEnvironment();
});

test.describe('CHARACTERIZATION — finance behavior pending product authority (registry C1)', () => {
  require('./cases/convention-integrity.cases');
  require('./cases/budget-integrity.cases');
  require('./cases/fund-receipt-integrity.cases');
});
