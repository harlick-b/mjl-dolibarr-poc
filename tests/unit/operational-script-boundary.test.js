const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');

test('Apache denies every operational script route before PHP dispatch', () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, 'custom/mjlfinancement/deployment/apache-native-guard.conf'),
    'utf8',
  );

  assert.match(source, /LocationMatch "\^\/custom\/mjlfinancement\/scripts\(\/\|\$\)"/);
  assert.match(source, /Require all denied/);
});

test('operational entrypoints require the shared CLI-only guard', () => {
  for (const script of [
    'audit_schema_current.php',
    'bootstrap_poc.php',
    'check_production_readiness.php',
    'disable_native_workspace_modules.php',
    'seed_sample_data.php',
    'verify_activity_workflow.php',
    'verify_expense_workflow.php',
    'verify_sample_data.php',
    'verify_scope_integrity.php',
    'verify_traceability_exports.php',
  ]) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, 'custom/mjlfinancement/scripts', script),
      'utf8',
    );
    assert.match(source, /require_once __DIR__\.'\/cli_guard\.php';/, script);
  }
});

test('local bootstrap never prints API key material', () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, 'custom/mjlfinancement/scripts/bootstrap_poc.php'),
    'utf8',
  );

  assert.doesNotMatch(source, /mjl_out\([^\n]*api_key/i);
  assert.match(source, /API key ensured for/);
});
