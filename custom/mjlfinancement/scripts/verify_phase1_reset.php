<?php

require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/preserved_admin.lib.php';
require_once __DIR__.'/activity_schema_installer.lib.php';

function phase1_fail($message) { fwrite(STDERR, 'ERROR: '.$message.PHP_EOL); exit(1); }
function phase1_scalar($sql) { global $db; $resql = $db->query($sql); if (!$resql) phase1_fail($db->lasterror()); $row = $db->fetch_row($resql); return (int) $row[0]; }
function phase1_table($name) { global $db; return phase1_scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($db->prefix().$name)."'"); }
function phase1_column($table, $column) { global $db; return phase1_scalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($db->prefix().$table)."' AND COLUMN_NAME='".$db->escape($column)."'"); }

try { mjl_load_preserved_native_admin($db); } catch (RuntimeException $exception) { phase1_fail($exception->getMessage()); }
$absent = array('mjlfinancement_convention', 'mjlfinancement_budget_line', 'mjlfinancement_fund_receipt', 'mjlfinancement_expense', 'mjlfinancement_validation', 'mjlfinancement_workflow_action', 'mjlfinancement_exchange_log', 'mjlfinancement_report', 'mjlfinancement_access_audit');
foreach ($absent as $table) if (phase1_table($table) !== 0) phase1_fail('Obsolete table remains: '.$table);
foreach (array('mjlfinancement_activity', 'mjlfinancement_audit_event', 'mjlfinancement_invitation', 'mjlfinancement_password_reset') as $table) if (phase1_table($table) !== 1) phase1_fail('Required table missing: '.$table);
if (phase1_column('mjlfinancement_activity', 'fk_convention') !== 0) phase1_fail('Activity still depends on Convention.');
try { mjl_rst005_require_target_objects($db); } catch (RuntimeException $exception) { phase1_fail($exception->getMessage()); }
foreach (array('mjlfinancement_invitation', 'mjlfinancement_password_reset') as $table) {
	foreach (array('token_selector', 'token_hash', 'live_user_id') as $column) if (phase1_column($table, $column) !== 1) phase1_fail($table.'.'.$column.' is missing.');
}
if (phase1_scalar("SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('".$db->prefix()."mjlfinancement_audit_event_bu','".$db->prefix()."mjlfinancement_audit_event_bd')") !== 2) phase1_fail('Audit immutability triggers are missing.');
if (phase1_scalar("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME IN ('chk_mjl_invitation_credential_state','chk_mjl_invitation_terminal_date','chk_mjl_reset_credential_state')") !== 3) phase1_fail('Auth state constraints are missing.');
if (phase1_scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND (TABLE_NAME LIKE '%\\_rst\\_phase1\\_20260814' OR TABLE_NAME LIKE '%\\_rst\\_phase1\\_target\\_20260814')") !== 0) phase1_fail('Phase 1 quarantine/rollback tables remain.');
foreach (array('mjlfinancement_activity', 'mjlfinancement_audit_event', 'mjlfinancement_invitation', 'mjlfinancement_password_reset', 'mjlfinancement_user_role', 'mjlfinancement_user_soc_scope') as $table) if (phase1_scalar('SELECT COUNT(*) FROM '.$db->prefix().$table) !== 0) phase1_fail('Expected empty table: '.$table);
if (phase1_scalar('SELECT COUNT(*) FROM '.$db->prefix().'user WHERE rowid<>1') !== 0) phase1_fail('Unexpected users exist.');
$forbiddenTestConstants = array('MJL_AUTH_E2E_EXPOSE_TOKENS', 'MJL_RST_PHASE1_FAILURE_INJECTION', 'MJL_RST_PHASE1_ACTIVATION_FAILURE_INJECTION');
$quotedTestConstants = array();
foreach ($forbiddenTestConstants as $name) $quotedTestConstants[] = "'".$db->escape($name)."'";
if (phase1_scalar('SELECT COUNT(*) FROM '.$db->prefix().'const WHERE name IN ('.implode(',', $quotedTestConstants).')') !== 0) phase1_fail('Disposable test/failure-injection constant remains in at least one entity.');
print "RST Phase 1 schema and empty-tenant invariants verified.\n";
