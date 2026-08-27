const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('RST-005 source schema matches the sealed target oracle', () => {
  const oracle = read('docs/mjl-rst-005-target-activity-schema.sql');
  const table = read('custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql');
  const keys = read('custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql');
  const combined = `${table}\n${keys}`;

  for (const field of [
    'fk_partner', 'name', 'description', 'draft_authorized_amount',
    'first_submitted_amount', 'latest_validated_amount', 'validation_status',
    'is_cancelled', 'version',
  ]) {
    assert.match(combined, new RegExp(`\\b${field}\\b`), field);
  }
  for (const removed of [
    'fk_task', 'note_public', 'note_private', 'date_actual_start',
    'physical_execution_percent', 'execution_status', 'execution_comment',
  ]) {
    assert.doesNotMatch(combined, new RegExp(`\\b${removed}\\b`), removed);
  }
  for (const invariant of [
    'chk_mjl_activity_entity_positive', 'chk_mjl_activity_rst005_dormant',
    'chk_mjl_activity_responsible_dormant', 'llx_mjl_activity_rst005_bi',
    'llx_mjl_activity_rst005_bu', 'llx_mjl_activity_rst005_bd',
  ]) {
    assert.match(combined, new RegExp(invariant), invariant);
    assert.match(oracle, new RegExp(invariant), invariant);
  }
});

test('RST-005 Activity model exposes dual sealed read projections and denies mutation', () => {
  const model = read('custom/mjlfinancement/class/mjlactivity.class.php');
  assert.match(model, /RST005_SCHEMA_PHASE1/);
  assert.match(model, /RST005_SCHEMA_TARGET/);
  assert.match(model, /detectSchema/);
  assert.match(model, /label AS name/);
  assert.match(model, /validation_status/);
  assert.match(model, /public function create[\s\S]*return -1;/);
  assert.match(model, /public function update[\s\S]*return -1;/);
  assert.match(model, /public function delete[\s\S]*return -1;/);
});

test('RST-005 route and dormant presentation expose read containment only', () => {
  const route = read('custom/mjlfinancement/activities.php');
  const feedback = read('custom/mjlfinancement/lib/mjl_feedback.lib.php');
  const email = read('custom/mjlfinancement/lib/mjl_email.lib.php');
  const templates = read('custom/mjlfinancement/lib/mjl_email_presentation.lib.php');
  assert.match(route, /REQUEST_METHOD[^\n]*POST/);
  assert.match(route, /http_response_code\(403\)/);
  assert.match(route, /MjlActivity/);
  assert.doesNotMatch(route, /INSERT|UPDATE|DELETE/i);
  assert.doesNotMatch(feedback, /activity\.(?:created|comment_added|saved)/);
  assert.doesNotMatch(email, /mjl_email_notify_activity_transition/);
  assert.doesNotMatch(templates, /activity_(?:submitted|correction_requested|prevalidated|validated|rejected)/);
});

test('RST-005 operational scripts are CLI-only and migration-state explicit', () => {
  for (const script of [
    'custom/mjlfinancement/scripts/rst005_activity_foundation.php',
    'custom/mjlfinancement/scripts/verification/schema/activity_foundation.php',
  ]) {
    const source = read(script);
    assert.match(source, /cli_guard\.php/);
  }
  const migration = read('custom/mjlfinancement/scripts/rst005_activity_foundation.php');
  assert.match(migration, /GET_LOCK/);
  assert.match(migration, /LOCK TABLES/);
  assert.match(migration, /mjl_rst005_cutover_guard_sql/);
  assert.match(migration, /after-locked-recheck/);
  assert.match(migration, /after-atomic-rename/);
  assert.match(migration, /\$disposableVerificationFailure = \$options\['mode'\] === 'verify' && \$options\['failure-point'\] === 'during-verification'/);
  assert.match(migration, /getenv\('MJL_DISPOSABLE_TEST_TENANT'\) === '1'/);
  assert.match(migration, /activity_rst005_target/);
  assert.match(migration, /activity_rst005_phase1_quarantine/);
  assert.match(migration, /RENAME TABLE/);
  assert.match(migration, /ROLLBACK/);
  assert.doesNotMatch(migration, /mjlfinancement_convention|CREATE\s+TABLE[^;]*mjlfinancement_workflow_action/i);
});

test('RST-005 evidence is encrypted, restore-tested, and source-bound', () => {
  const runner = read('tests/runner/rst005-cutover-rehearsal.js');
  const migration = read('custom/mjlfinancement/scripts/rst005_activity_foundation.php');
  assert.match(runner, /sodium_crypto_secretstream_xchacha20poly1305/);
  assert.match(runner, /fresh_process: true/);
  assert.match(runner, /rst005_schema_restore/);
  assert.match(runner, /rst005_full_restore/);
  assert.match(runner, /GRANT SELECT, SHOW VIEW, TRIGGER, EXECUTE, EVENT ON/);
  assert.match(runner, /REVOKE SELECT, SHOW VIEW, TRIGGER, EXECUTE, EVENT ON/);
  assert.match(runner, /alternate-prefix database or grant survived cleanup/);
  assert.doesNotMatch(runner, /GRANT ALL PRIVILEGES ON/);
  assert.match(runner, /restored-database evidence accepted a non-disposable caller/);
  assert.match(runner, /mutating orchestrator accepted a non-disposable caller/);
  assert.match(migration, /rst005_require_shared_launcher_authorization/);
  assert.match(migration, /mjl-disposable-fixture-sentinel/);
  assert.match(runner, /moduleTreeSha/);
  assert.match(migration, /rst005_module_tree_sha/);
  assert.match(migration, /dependent code may be present/);
});

test('RST-005 public runner and Playwright discovery are explicit', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:rst005'], 'node tests/runner/run-suite.js rst005');
  const disposable = read('tests/runner/disposable-run.js');
  const runner = read('tests/runner/run-suite.js');
  const playwright = read('playwright.config.js');
  assert.match(disposable, /rst005:\s*\['rst005'\]/);
  assert.match(runner, /rst005-activity-foundation\.spec\.js/);
  assert.match(playwright, /rst005-activity-foundation\.spec\.js/);
});

test('sealed schema hashes referenced by the strategy match their bytes', () => {
  const strategy = read('docs/mjl-rst-005-activity-foundation-strategy.md');
  for (const file of [
    'docs/mjl-rst-005-phase1-activity-schema.sql',
    'docs/mjl-rst-005-target-activity-schema.sql',
  ]) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    assert.match(strategy, new RegExp(hash));
  }
  assert.equal(
    read('custom/mjlfinancement/scripts/oracles/rst005_phase1_activity.sql'),
    read('docs/mjl-rst-005-phase1-activity-schema.sql'),
  );
});

test('RST-005 prefix and advisory-lock derivation reject unsafe and overlong identifiers', () => {
  const source = read('custom/mjlfinancement/scripts/activity_schema_installer.lib.php');
  assert.match(source, /\^\[A-Za-z\]\[A-Za-z0-9_\]\*\$/);
  assert.match(source, /count\(\$derived\) !== count\(array_unique\(\$derived\)\)/);
  assert.match(source, /strlen\(\$identifier\) > 64/);
  assert.match(source, /mjl:rst005:.*hash\('sha256'.*\$database.*\$prefix/s);
  assert.match(source, /substr\(hash\('sha256'.*0, 48\)/s);
});
