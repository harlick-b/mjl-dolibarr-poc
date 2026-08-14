const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('RST-007A exposes one append-only audit contract', () => {
  const schema = read('custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.sql');
  const keys = read('custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.key.sql');
  const audit = read('custom/mjlfinancement/lib/mjl_audit.lib.php');
  assert.match(schema, /CREATE TABLE llx_mjlfinancement_audit_event/);
  for (const field of ['entity', 'object_type', 'actor_name_snapshot', 'actor_role_snapshot', 'previous_values_json', 'new_values_json', 'target_version', 'result']) {
    assert.match(schema, new RegExp(`\\b${field}\\b`), field);
  }
  assert.match(keys, /BEFORE UPDATE/);
  assert.match(keys, /BEFORE DELETE/);
  assert.match(audit, /function mjl_audit_append_in_transaction/);
  assert.match(audit, /transaction_opened\s*<=\s*0/);
  assert.match(audit, /function mjl_audit_record_outcome/);
  assert.match(audit, /transaction_opened\s*>\s*0/);
  assert.match(audit, /\[REDACTED\]/);
  assert.doesNotMatch(schema, /FOREIGN KEY/i);
});

test('RST-004 removes obsolete finance schema and the Activity Convention seam', () => {
  const sqlFiles = fs.readdirSync(path.join(root, 'custom/mjlfinancement/sql'));
  for (const fragment of ['convention', 'budget_line', 'fund_receipt', 'expense', 'validation']) {
    assert.equal(sqlFiles.some((name) => name.includes(fragment)), false, fragment);
  }
  assert.equal(sqlFiles.some((name) => name.startsWith('update_')), false, 'historical update SQL');
  const activitySchema = read('custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql');
  const activityKeys = read('custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql');
  assert.doesNotMatch(activitySchema, /fk_convention/);
  assert.doesNotMatch(activityKeys, /fk_convention/);
});

test('RST-008 makes invitations business-role-only and selector based', () => {
  const invitation = read('custom/mjlfinancement/sql/llx_mjlfinancement_invitation.sql');
  const reset = read('custom/mjlfinancement/sql/llx_mjlfinancement_password_reset.sql');
  const auth = read('custom/mjlfinancement/lib/mjl_auth.lib.php');
  assert.match(invitation, /role_code VARCHAR\(64\) NOT NULL/);
  assert.match(invitation, /token_selector VARCHAR\(64\) NOT NULL/);
  assert.match(reset, /token_selector VARCHAR\(64\) NOT NULL/);
  assert.match(invitation, /chk_mjl_invitation_credential_state/);
  assert.match(reset, /chk_mjl_reset_credential_state/);
  assert.match(auth, /function mjl_auth_business_role_codes/);
  assert.match(auth, /function mjl_auth_identity_locks/);
  assert.match(auth, /MJL_DISPOSABLE_TEST_TENANT/);
  assert.match(auth, /hash_hmac\('sha256'/);
  assert.doesNotMatch(auth, /mjlfinancement_access_audit/);
  assert.doesNotMatch(auth, /function mjl_auth_groups/);
});

test('RST-009A registry contains only approved Phase 1 destinations', () => {
  const registry = read('custom/mjlfinancement/lib/mjl_navigation_registry.lib.php');
  for (const label of ['Accueil', 'Partenaires', 'Projets', "Types d’opération", 'Audit', 'Utilisateurs et accès', 'Administration technique']) {
    assert.match(registry, new RegExp(label));
  }
  for (const route of ['expenses.php', 'conventions.php', 'budgetlines.php', 'fundreceipts.php', 'reports.php', 'exchangelogs.php', 'documents.php', 'alerts.php']) {
    assert.doesNotMatch(registry, new RegExp(route.replace('.', '\\.')));
  }
  const guard = read('custom/mjlfinancement/deployment/apache-native-guard.conf');
  assert.match(guard, /admin\/\(\?!modules\\\.php\$\)/);
});

test('cutover executor gates destructive modes and rechecks empty quarantines', () => {
  const reset = read('custom/mjlfinancement/scripts/rst_phase1_reset.php');
  assert.match(reset, /MJL_RST_PHASE1_TRAFFIC_STOPPED/);
  assert.match(reset, /evidence-sha256/);
  assert.match(reset, /hash_file\('sha256'/);
  assert.match(reset, /Quarantine table is not empty/);
  assert.match(reset, /DROP FOREIGN KEY[^;]+DROP INDEX[^;]+DROP COLUMN/);
});
