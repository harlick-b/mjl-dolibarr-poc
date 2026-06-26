const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    baseURL: process.env.MJL_BASE_URL || 'http://127.0.0.1:8080',
    trace: 'retain-on-failure'
  }
});
