const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('RST-002B stores immutable entity-scoped current and historical assignments', () => {
  const table = read('custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.sql');
  const keys = read('custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.key.sql');
  const installer = read('custom/mjlfinancement/scripts/activity_schema_installer.lib.php');
  const combined = `${table}\n${keys}\n${installer}`;

  for (const field of [
    'entity', 'fk_activity', 'fk_user', 'is_primary', 'date_start', 'date_end',
    'fk_user_assign', 'reason', 'date_creation', 'tms',
  ]) assert.match(combined, new RegExp(`\\b${field}\\b`), field);

  for (const invariant of [
    'current_user_id', 'current_primary_activity_id',
    'uk_mjl_activity_assignment_current_user',
    'uk_mjl_activity_assignment_current_primary',
    'chk_mjl_activity_assignment_entity_positive',
    'chk_mjl_activity_assignment_primary',
    'chk_mjl_activity_assignment_reason_nonblank',
    'chk_mjl_activity_assignment_dates',
    'llx_mjl_activity_assignment_bi',
    'llx_mjl_activity_assignment_bu',
    'llx_mjl_activity_assignment_bd',
  ]) assert.match(combined, new RegExp(invariant), invariant);

  assert.match(combined, /fk_user_assign[^\n]*DEFAULT NULL/i);
  assert.match(combined, /NEW\.fk_user_assign IS NULL/);
  assert.match(combined, /AGENT_SAISIE/);
  assert.match(combined, /VALIDATEUR_DEFINITIF/);
  assert.match(combined, /ON UPDATE RESTRICT ON DELETE RESTRICT/g);
});

test('RST-002B exposes one closed transactional assignment interface', () => {
  const source = read('custom/mjlfinancement/class/mjlactivityassignment.class.php');
  assert.match(source, /class MjlActivityAssignment/);
  assert.match(source, /function changeAssignment\(\$activityId, \$expectedVersion, User \$authenticatedActor, \$operation, \$targetAgentId, \$reason\)/);
  for (const operation of ['ADD_ADDITIONAL', 'REMOVE_ADDITIONAL', 'TRANSFER_PRIMARY']) {
    assert.match(source, new RegExp(`['"]${operation}['"]`), operation);
  }
  for (const result of ['OK', 'INVALID_INPUT', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'STALE_VERSION', 'FAILED']) {
    assert.match(source, new RegExp(`['"]${result}['"]`), result);
  }
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /SET TRANSACTION ISOLATION LEVEL READ COMMITTED/);
  assert.match(source, /mjl_audit_append_in_transaction/);
  assert.match(source, /activity_assignment/);
  assert.match(source, /ASSIGNMENT_ADDED/);
  assert.match(source, /ASSIGNMENT_REMOVED/);
  assert.match(source, /PRIMARY_TRANSFERRED/);
  assert.doesNotMatch(source, /\$_(?:GET|POST|REQUEST)|dol_now\(/);
});

test('RST-002B Activity reads are role-projected and assignment-filtered at the server', () => {
  const access = read('custom/mjlfinancement/lib/mjl_activity_access.lib.php');
  const model = read('custom/mjlfinancement/class/mjlactivity.class.php');
  const route = read('custom/mjlfinancement/activities.php');
  const scope = read('custom/mjlfinancement/lib/mjl_scope.lib.php');

  assert.match(access, /function mjl_activity_access_can_enter_list\(User \$targetUser\)/);
  assert.match(access, /function mjl_activity_access_can_read_activity\(User \$targetUser, \$activityId\)/);
  assert.match(access, /mjlfinancement_activity_assignment/);
  assert.match(access, /date_end IS NULL/);
  assert.match(access, /a\.entity=/);
  assert.match(access, /aa\.entity=a\.entity/);
  assert.match(model, /fetchReadProjection\(User \$reader/);
  assert.match(model, /INNER JOIN .*mjlfinancement_activity_assignment/s);
  assert.match(model, /aa\.fk_user=/);
  assert.match(model, /aa\.date_end IS NULL/);
  assert.match(route, /mjl_activity_access_can_enter_list\(\$user\)/);
  assert.match(route, /fetchReadProjection\(\$user/);
  assert.match(scope, /'AGENT_SAISIE'[\s\S]*array\('activity', 'read'\)/);
  assert.doesNotMatch(`${access}\n${model}`, /user_soc_scope/);
});

test('RST-002B role and user changes reciprocally guard current assignments', () => {
  const scope = read('custom/mjlfinancement/lib/mjl_scope.lib.php');
  const keys = read('custom/mjlfinancement/sql/llx_mjlfinancement_user_role.key.sql');
  const module = read('custom/mjlfinancement/core/modules/modMjlFinancement.class.php');
  const installer = read('custom/mjlfinancement/scripts/activity_schema_installer.lib.php');
  for (const source of [scope, keys, installer]) assert.match(source, /mjlfinancement_activity_assignment/);
  assert.match(scope, /function mjl_scope_lock_user_and_active_role/);
  assert.match(scope, /ORDER BY rowid FOR UPDATE/);
  assert.match(scope, /function mjl_scope_has_current_activity_assignment/);
  assert.match(`${keys}\n${installer}\n${module}`, /mjlfinancement_user_role_bd/);
  assert.match(`${keys}\n${installer}\n${module}`, /mjlfinancement_user_admin_bu/);
  assert.match(`${keys}\n${installer}`, /OLD\.role_code='AGENT_SAISIE'/);
  assert.match(`${keys}\n${installer}`, /NEW\.statut<>1/);
  assert.match(`${keys}\n${installer}`, /NEW\.entity<>OLD\.entity/);
});

test('RST-002B migration is CLI-only, known-prefix, empty-state, and rollback guarded', () => {
  const migration = read('custom/mjlfinancement/scripts/rst002b_activity_assignment.php');
  const verifier = read('custom/mjlfinancement/scripts/verification/schema/activity_assignment.php');
  assert.match(migration, /cli_guard\.php/);
  assert.match(verifier, /cli_guard\.php/);
  assert.match(migration, /GET_LOCK/);
  assert.match(migration, /RST002B_MIGRATION_REQUIRED|RST-005/);
  assert.match(migration, /assignment-table-created/);
  assert.match(migration, /activity-guard-cutover/);
  assert.match(migration, /scope-table-removed/);
  assert.match(migration, /mjl_rst002b_require_target_objects/);
  assert.match(migration, /fk_user_responsible/);
  assert.match(migration, /mjlfinancement_user_soc_scope/);
  assert.match(migration, /object_type='activity_assignment'/);
  assert.match(migration, /MJL_DISPOSABLE_TEST_TENANT/);
  assert.match(migration, /MJL_RST002B_SHARED_LAUNCHER/);
  assert.match(migration, /Rollback refused/);
});

test('RST-002B focused disposable and Playwright discovery are explicit', () => {
  const pkg = JSON.parse(read('package.json'));
  const disposable = read('tests/runner/disposable-run.js');
  const runner = read('tests/runner/run-suite.js');
  const playwright = read('playwright.config.js');
  assert.equal(pkg.scripts['test:rst002b'], 'node tests/runner/run-suite.js rst002b');
  assert.equal(pkg.scripts['test:rst002b-launcher'], 'node tests/runner/rst002b-shared-launcher-rehearsal.js');
  assert.match(disposable, /rst002b:\s*\['rst002b'\]/);
  assert.match(runner, /rst002b-activity-assignment\.spec\.js/);
  assert.match(playwright, /rst002b-activity-assignment\.spec\.js/);
});
