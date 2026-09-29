const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'partner-project.spec.js',
    'auth-concurrency.spec.js',
    'document-containment.spec.js',
    'fixture-isolation.spec.js',
    'reset-boundaries.spec.js',
    'activity-assignment.spec.js',
    'activity-planning.spec.js',
    'planning-navigation.spec.js',
    'activity-execution.spec.js',
    'monitoring.spec.js',
    'activities-report.spec.js',
    'export-recovery.spec.js',
    'operations-report.spec.js',
    'activity-detail.spec.js',
    'portfolio-report.spec.js',
    'audit-report.spec.js', 'timeline.spec.js',
    'reconciliation-restore.spec.js',
    'vui-activities-list.spec.js',
    'vui-activity-planning.spec.js',
    'vui-activity-workspace.spec.js',
    'vui-review-workflow.spec.js',
    'vui-operation-consultation.spec.js',
    'vui-exception-dialogs.spec.js',
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
