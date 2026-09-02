<?php

if (PHP_SAPI !== 'cli') { http_response_code(403); exit(1); }
require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/rst006a_schema.lib.php';

$options = getopt('', array('mode:','confirm:','failure-point::'));
$mode = isset($options['mode']) ? (string) $options['mode'] : '';
if (!in_array($mode, array('apply','rollback','detect'), true)) throw new RuntimeException('Use --mode=apply, --mode=rollback, or --mode=detect.');
if ($mode !== 'detect' && (!isset($options['confirm']) || $options['confirm'] !== 'RST-006A')) throw new RuntimeException('Explicit --confirm=RST-006A is required.');

$state = mjl_rst006a_detect_schema($db);
if ($mode === 'detect') { print $state.PHP_EOL; exit($state === RST006A_SCHEMA_TARGET ? 0 : 2); }
$lock = 'mjl:rst006a:'.substr(hash('sha256', (string) mjl_rst005_scalar($db, 'SELECT DATABASE()').':'.$db->prefix()), 0, 44);
if ((int) mjl_rst005_scalar($db, "SELECT GET_LOCK('".$db->escape($lock)."',0)") !== 1) throw new RuntimeException('RST-006A migration lock is unavailable.');
try {
	if ($mode === 'apply') {
		if ($state === RST006A_SCHEMA_TARGET) { print "RST-006A target already installed.\n"; exit(0); }
		if ($state === RST006A_SCHEMA_PREDECESSOR) {
			if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity') !== 0
				|| (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity_assignment') !== 0) throw new RuntimeException('RST-006A requires the exact empty predecessor.');
		}
		mjl_rst006a_install_target($db, isset($options['failure-point']) ? (string) $options['failure-point'] : '');
		mjl_rst006a_require_target($db);
		print "RST-006A target installed and verified.\n";
	} else {
		if ($state !== RST006A_SCHEMA_TARGET) throw new RuntimeException('Rollback requires the exact RST-006A target.');
		foreach (mjl_rst006a_suffixes() as $suffix) if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst006a_table($db, $suffix)) !== 0) throw new RuntimeException('Rollback refused: RST-006A tables are not empty.');
		$actions = "'ACTIVITY_CREATED','ACTIVITY_STRUCTURE_SAVED','ACTIVITY_REVISION_SUBMITTED','ACTIVITY_ABANDONED','ACTIVITY_RESTORED','ACTIVITY_REVIEW_DECIDED'";
		if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_audit_event WHERE action IN ('.$actions.')') !== 0) throw new RuntimeException('Rollback refused: RST-006A audit evidence exists.');
		$a = $db->prefix().'mjlfinancement_activity';
		$db->query('DROP TRIGGER IF EXISTS '.$db->prefix().'mjl_activity_rst006a_bi');
		$db->query('DROP TRIGGER IF EXISTS '.$db->prefix().'mjl_activity_rst006a_bu');
		$db->query('ALTER TABLE '.$a.' DROP FOREIGN KEY fk_mjl_activity_current_revision');
		$db->query('ALTER TABLE '.$a.' DROP CONSTRAINT chk_mjl_activity_rst006a_phase2');
		$db->query('ALTER TABLE '.$a.' DROP INDEX idx_mjl_activity_current_revision');
		$db->query('ALTER TABLE '.$a.' DROP INDEX uk_mjl_activity_entity_rowid');
		$db->query('ALTER TABLE '.$a.' DROP COLUMN fk_current_revision');
		$db->query('ALTER TABLE '.$a.' DROP CONSTRAINT chk_mjl_activity_validation_status');
		$db->query("ALTER TABLE $a ADD CONSTRAINT chk_mjl_activity_validation_status CHECK (validation_status IN ('DRAFT','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED'))");
		$db->query("ALTER TABLE $a ADD CONSTRAINT chk_mjl_activity_rst005_dormant CHECK (validation_status='DRAFT' AND is_cancelled=0 AND first_submitted_amount IS NULL AND latest_validated_amount IS NULL)");
		foreach (array_reverse(mjl_rst006a_suffixes()) as $suffix) $db->query('DROP TABLE '.mjl_rst006a_table($db, $suffix));
		mjl_rst005_install_insert_trigger($db, $a);
		mjl_rst002b_install_activity_update_trigger($db);
		mjl_rst002b_install_assignment_triggers($db);
		if (mjl_rst002b_detect_schema($db) !== RST002B_SCHEMA_TARGET) throw new RuntimeException('Predecessor verification failed after rollback.');
		print "RST-006A rollback completed and predecessor verified.\n";
	}
} finally {
	$db->query("SELECT RELEASE_LOCK('".$db->escape($lock)."')");
}
