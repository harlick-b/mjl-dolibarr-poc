const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('RST-006A exposes the closed aggregate command interface', () => {
  const source = read('custom/mjlfinancement/class/mjlactivitycommand.class.php');
  for (const operation of [
    'createDraft', 'createAndSubmit', 'saveStructure', 'submitRevision',
    'abandonDraft', 'restoreDraft', 'reviewRevision',
  ]) {
    assert.match(source, new RegExp(`public function ${operation}\\(`));
  }
  for (const outcome of [
    'OK', 'INVALID_INPUT', 'FORBIDDEN', 'NOT_FOUND', 'STALE_VERSION',
    'CONFLICT', 'RETRYABLE_CONFLICT', 'MIGRATION_REQUIRED', 'FAILED',
  ]) assert.match(source, new RegExp(`'${outcome}'`));
});

test('RST-006A installs exactly the five planning tables and current revision pointer', () => {
  const schema = read('custom/mjlfinancement/scripts/rst006a_schema.lib.php');
  for (const suffix of [
    'activity_reference_sequence', 'operation', 'activity_revision',
    'revision_contributor', 'review_decision',
  ]) {
    assert.match(schema, new RegExp(`'${suffix}'`));
    assert.ok(fs.existsSync(path.join(root, `custom/mjlfinancement/sql/llx_mjlfinancement_${suffix}.sql`)));
  }
  assert.match(schema, /fk_current_revision/);
  assert.match(schema, /MIGRATION_REQUIRED/);
  assert.match(schema, /rst006a_target/);
});

test('RST-006A keeps Operations activity-scoped and loads its JavaScript once', () => {
  assert.equal(fs.existsSync(path.join(root, 'custom/mjlfinancement/operations.php')), false);
  const route = read('custom/mjlfinancement/activities.php') + read('custom/mjlfinancement/lib/mjl_activity_route.lib.php');
  assert.match(route, /create_draft/);
  assert.match(route, /submit_revision/);
  assert.match(route, /review_revision/);
  assert.match(route, /mjl_form_submission_consume/);
  assert.equal((route.match(/activities\.js/g) || []).length, 1);
});

test('RST-006A audit JSON fails closed on malformed UTF-8', () => {
  const audit = read('custom/mjlfinancement/lib/mjl_audit.lib.php');
  assert.match(audit, /JSON_ERROR_NONE/);
  assert.match(audit, /mjl_audit_encode_json/);
});

test('RST-006A is wired into public verification commands', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:rst006a'], 'node tests/runner/run-suite.js rst006a');
  const runner = read('tests/runner/run-suite.js');
  assert.match(runner, /rst006a-activity-planning\.spec\.js/);
  assert.match(runner, /verification\/schema\/activity_planning\.php/);
  const browser = read('tests/e2e/rst006a-activity-planning.spec.js');
  assert.equal((browser.match(/\btest\('/g) || []).length, 8, 'focused browser discovery count changed');
});
