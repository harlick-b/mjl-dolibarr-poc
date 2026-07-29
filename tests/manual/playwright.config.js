const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'phase2-accessibility-harness.spec.js',
  timeout: 0,
  workers: 1,
  use: {
    baseURL: process.env.MJL_BASE_URL || 'http://127.0.0.1:8080',
    viewport: null,
    trace: 'on',
  },
});
