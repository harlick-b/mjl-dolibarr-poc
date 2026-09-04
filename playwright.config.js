const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'partners-projects.spec.js',
    'auth-concurrency.spec.js',
    'document-containment.spec.js',
    'fixture-isolation.spec.js',
    'rst002b-activity-assignment.spec.js',
    'rst006a-activity-planning.spec.js',
    'zz-phase2-planning.spec.js',
  ],
  globalSetup: './tests/helpers/playwright-global-setup.js',
  outputDir: process.env.MJL_PLAYWRIGHT_OUTPUT_DIR || 'test-results/playwright',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.MJL_BASE_URL,
    trace: 'off',
    video: 'off'
  }
});
