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
