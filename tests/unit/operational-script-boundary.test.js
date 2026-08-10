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

test('local bootstrap activates modules without persistent sample creation', () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, 'custom/mjlfinancement/scripts/bootstrap_poc.php'),
    'utf8',
  );

  assert.doesNotMatch(source, /mjl_sample_data|mjl_csv_|ensureUser|setPassword|api_key/i);
  assert.match(source, /without creating users, roles, groups, Partners, Projects, business records, documents, or sample data/);
});

test('operational module scripts fail closed on the exact preserved administrator', () => {
  const helper = fs.readFileSync(
    path.join(repositoryRoot, 'custom/mjlfinancement/scripts/preserved_admin.lib.php'),
    'utf8',
  );

  assert.match(helper, /fetch\(1\)/);
  assert.match(helper, /\$adminUser->id !== 1/);
  assert.match(helper, /\$adminUser->entity !== 0/);
  assert.match(helper, /\$adminUser->login !== 'admin'/);
  assert.match(helper, /empty\(\$adminUser->admin\)/);
  assert.match(helper, /empty\(\$adminUser->statut\)/);

  for (const script of ['bootstrap_poc.php', 'disable_native_workspace_modules.php']) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, 'custom/mjlfinancement/scripts', script),
      'utf8',
    );
    assert.match(source, /require_once __DIR__\.'\/preserved_admin\.lib\.php';/, script);
    assert.match(source, /mjl_load_preserved_native_admin\(\$db\)/, script);
  }
});
