const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'access-shell.spec.js',
    'auth-invitations.spec.js',
    'partners-projects.spec.js',
    'activities.spec.js',
    'expenses.spec.js',
    'finance.spec.js',
    'documents-audit.spec.js',
    'scope-security.spec.js',
    'dashboards-alerts.spec.js',
    'reports-exports.spec.js',
    'email-notifications.spec.js',
  ],
  globalSetup: './tests/helpers/playwright-global-setup.js',
  outputDir: process.env.MJL_PLAYWRIGHT_OUTPUT_DIR || 'test-results/playwright',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.MJL_BASE_URL,
    trace: 'retain-on-failure'
  }
});
