const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  globalSetup: '../helpers/playwright-global-setup.js',
  testDir: '.',
  testMatch: ['finance.spec.js'],
  outputDir: process.env.MJL_PLAYWRIGHT_OUTPUT_DIR || 'test-results/characterization',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.MJL_BASE_URL,
    trace: 'retain-on-failure',
  },
});
