const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  globalSetup: '../helpers/playwright-global-setup.js',
  testDir: '.',
  testMatch: 'accessibility-gate.spec.js',
  outputDir: process.env.MJL_PLAYWRIGHT_OUTPUT_DIR || '../../test-results/manual-playwright',
  timeout: 0,
  workers: 1,
  use: {
    baseURL: process.env.MJL_BASE_URL,
    viewport: null,
    trace: 'on',
  },
});
