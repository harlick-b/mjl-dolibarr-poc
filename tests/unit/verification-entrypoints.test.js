const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');

test('verification entrypoints resolve allowlisted modules without disabled process functions', () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, 'custom/mjlfinancement/scripts/verification/runner.php'),
    'utf8',
  );

  assert.match(source, /in_array\(\$requestedPath, \$relativePaths, true\)/);
  assert.match(source, /return \$path/);
  assert.doesNotMatch(source, /\b(?:exec|passthru|proc_open|shell_exec|system)\s*\(/);

  for (const entrypoint of ['audit_schema_current.php', 'verify_scope_integrity.php']) {
    const entrypointSource = fs.readFileSync(
      path.join(repositoryRoot, 'custom/mjlfinancement/scripts', entrypoint),
      'utf8',
    );
    assert.match(entrypointSource, /require \$modulePath/);
  }
});

test('production readiness references only the supported current scope verifier', () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, 'custom/mjlfinancement/scripts/check_production_readiness.php'),
    'utf8',
  );

  assert.match(source, /verify_scope_integrity\.php/);
  assert.doesNotMatch(source, /audit_unresolved_scope\.php/);
  for (const requiredUnknown of [
    'final_permission_matrix',
    'official_output_templates',
    'production_email_transport',
    'public_base_url',
    'production_secrets',
    'backup_restore_procedure',
    'monitoring_and_log_retention',
  ]) {
    assert.match(source, new RegExp(`unknown\\('${requiredUnknown}'`));
  }
  assert.match(source, /MJL_AUTH_E2E_EXPOSE_TOKENS/);
  assert.match(source, /BLOCKED_PENDING_CLIENT_AND_OPERATOR_CONFIRMATION/);
});
