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
  const cases = require(path.join(root, 'tests/e2e/cases/rst006a.cases.js'));
  assert.equal((browser.match(/\btest\('/g) || []).length + Object.values(cases).flat().length, 42, 'focused browser inventory count changed');
  assert.match(runner, /RST-006A focused inventory changed/);
});

test('RST-006A list query has a closed typed filter and fixed pagination contract', () => {
  const route = read('custom/mjlfinancement/lib/mjl_activity_route.lib.php');
  const model = read('custom/mjlfinancement/class/mjlactivity.class.php');
  assert.match(route, /function mjl_activity_list_query\(/);
  assert.match(route, /array\('q','status','project_id','page'\)/);
  assert.match(route, /mjl_activity_list_url\(/);
  assert.match(model, /fetchReadProjection\(User \$reader, array \$filters, \$limit, \$offset\)/);
  assert.match(model, /str_replace\(array\('\\\\', '%', '_'\)/);
  assert.match(model, /ESCAPE/);
  assert.match(model, /ORDER BY a\.rowid DESC LIMIT/);
  assert.match(route, /array_slice\(\$rows, 0, 50\)/);
});

test('RST-006A transaction boundary classifies driver false and thrown lock conflicts', () => {
  const source = read('custom/mjlfinancement/class/mjlactivitycommand.class.php');
  const browser = read('tests/e2e/rst006a-activity-planning.spec.js');
  const worker = read('tests/fixtures/rst006a-parallel-worker.php');
  assert.match(source, /function databaseFailureOutcome\(/);
  assert.match(source, /1205/);
  assert.match(source, /1213/);
  assert.match(source, /lasterror\(\)/);
  assert.match(source, /rollback\('mjl RST-006A database failure'\)/);
  assert.match(browser, /INNODB_LOCK_WAITS/);
  assert.match(browser, /real MariaDB deadlock/);
  assert.match(worker, /innodb_lock_wait_timeout/);
});

test('RST-006A rollback is staged, checked, and dependency-gated', () => {
  const migration = read('custom/mjlfinancement/scripts/rst006a_activity_planning.php');
  const schema = read('custom/mjlfinancement/scripts/rst006a_schema.lib.php');
  const dependency = JSON.parse(read('custom/mjlfinancement/scripts/rst006a-dependent-units.json'));
  assert.deepEqual(dependency, {
    version: 1,
    unit: 'RST-006A',
    dependencies: [
      'RST-006B', 'RST-007B', 'RST-009B', 'RST-009C', 'RST-011', 'RST-012',
      'RST-013B', 'RST-013C', 'RST-013D', 'RST-013E', 'RST-014B', 'RST-014C',
      'RST-014D', 'RST-015',
    ],
    statuses: {
      'RST-006B':'PENDING_APPROVAL','RST-007B':'PENDING_APPROVAL','RST-009B':'PENDING_APPROVAL','RST-009C':'PENDING_APPROVAL',
      'RST-011':'PENDING_APPROVAL','RST-012':'PENDING_APPROVAL','RST-013B':'PENDING_APPROVAL','RST-013C':'PENDING_APPROVAL',
      'RST-013D':'PENDING_APPROVAL','RST-013E':'PENDING_APPROVAL','RST-014B':'PENDING_APPROVAL','RST-014C':'PENDING_APPROVAL',
      'RST-014D':'PENDING_APPROVAL','RST-015':'PENDING_APPROVAL',
    },
    executed: [],
  });
  assert.match(migration, /mjl_rst006a_require_rollback_dependencies/);
  assert.match(migration, /mjl_rst006a_disposable_tenant_attested/);
  assert.match(migration, /MJL_DISPOSABLE_FIXTURE_SENTINEL/);
  assert.match(migration, /\.mjl-disposable-fixture-sentinel/);
  assert.match(migration, /dependency execution index is inconsistent/);
  assert.match(schema, /function mjl_rst006a_rollback_target\(/);
  assert.match(schema, /Unable to execute RST-006A DDL/);
  assert.doesNotMatch(migration, /\$db->query\('DROP/);

  const manifest = read('docs/mjl-reset-manifest-v2.md');
  const dependencyMap = new Map();
  const manifestStatuses = new Map();
  for (const section of manifest.split(/^### /m).slice(1)) {
    const unit = section.match(/^(RST-[0-9A-Z]+)/)?.[1];
    const dependencyLine = section.match(/^- Dependencies:\s*([^\n]*(?:\n  [^\n]*)*)/m)?.[1] || '';
    if (unit) {
      dependencyMap.set(unit, [...dependencyLine.matchAll(/RST-[0-9A-Z]+/g)].map((match) => match[0]));
      manifestStatuses.set(unit, section.match(/^- Status: `([^`]+)`/m)?.[1] || '');
    }
  }
  const closure = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const [unit, dependencies] of dependencyMap) {
      if (!closure.includes(unit) && dependencies.some((dependencyName) => dependencyName === 'RST-006A' || closure.includes(dependencyName))) {
        closure.push(unit); changed = true;
      }
    }
  }
  assert.deepEqual([...dependency.dependencies].sort(), closure.sort());
  for (const unit of dependency.dependencies) assert.equal(dependency.statuses[unit],manifestStatuses.get(unit),`${unit} dependency status drift`);
});

test('RST-006A cutover seals final evidence only after restart and health verification', () => {
  const source = read('custom/mjlfinancement/scripts/rst006a_fast_cutover.js');
  const rehearsal = read('tests/runner/rst006a-fast-cutover-rehearsal.js');
  const main = source.slice(source.indexOf('function main()'));
  const restart = main.indexOf("dc(['start', 'dolibarr']");
  const health = main.indexOf('healthCheck()', restart);
  const finalEvidence = main.indexOf('sealCompletion(journal)', health);
  assert.ok(restart > 0 && health > restart && finalEvidence > health);
  assert.match(source, /tracked source changes/);
  assert.match(source, /journal/);
  assert.match(source, /backup_sha256/);
  assert.match(source, /Unknown schema state; Dolibarr remains stopped/);
  assert.match(source, /verifyInheritedLock/);
  assert.match(source, /Independent cutover lock contention proof failed/);
  assert.match(source, /function requireStoppedTraffic\(\)/);
  assert.match(source, /Traffic-stop verification failed: observed/);
  assert.doesNotMatch(source, /MJL_RST006A_LOCK_HELD/);
  assert.match(source, /data', 'backups', 'rst006a/);
  assert.match(source, /--conflict-exit-code', '75'/);
  assert.match(source, /Rehearsal interruption hooks are restricted to disposable wrapper tenants/);
  for (const point of ['pre-apply','partial-ddl','target-before-restart','restart-before-evidence']) assert.match(rehearsal,new RegExp(`'${point}'`));
  for (const refusal of ['missing journal backup','corrupt journal backup','unknown schema state','tracked source drift','malformed journal','lock allowed a contender']) assert.match(rehearsal,new RegExp(refusal,'i'));
});
