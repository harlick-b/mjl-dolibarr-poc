const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'phase3d-navigation-zoom-harness.spec.js',
  timeout: 0,
  workers: 1,
  use: {
    baseURL: process.env.MJL_BASE_URL,
    headless: false,
    viewport: null,
    trace: 'on',
  },
});
