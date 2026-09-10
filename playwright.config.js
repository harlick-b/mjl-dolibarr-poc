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
    'activity-execution.spec.js',
    'documents-audit.spec.js',
    'phase3b-monitoring.spec.js',
    'zz-phase3b-performance.spec.js',
    'phase3b-activities-report.spec.js',
    'phase3b-operations-report.spec.js',
    'phase3b-activity-detail.spec.js',
    'phase3b-portfolio-report.spec.js',
    'phase3b-audit-report.spec.js', 'phase3b-timeline.spec.js',
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
