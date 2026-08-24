<?php

require_once dirname(__DIR__, 2).'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once dirname(__DIR__, 2).'/activity_schema_installer.lib.php';

try {
	$prefix = mjl_rst005_prefix($db);
	$table = $prefix.'mjlfinancement_activity';
	$allowQuarantine = isset($argv[1]) && $argv[1] === '--allow-quarantine' && count($argv) === 2;
	mjl_rst005_require_target_objects($db, $table);
	if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($table)) !== 0 && getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1') {
		throw new RuntimeException('The shared RST-005 Activity foundation must remain empty.');
	}
	$temporaryCount = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE '".$db->escape($prefix)."mjlfinancement_activity_rst005_%'");
	if ($allowQuarantine) {
		$quarantine = $prefix.'mjlfinancement_activity_rst005_phase1_quarantine';
		if ($temporaryCount !== 1 || mjl_rst005_detect_schema($db, $quarantine) !== RST005_SCHEMA_PHASE1) throw new RuntimeException('The reversible RST-005 quarantine state is invalid.');
		mjl_rst005_assert_empty($db, $quarantine);
	} elseif ($temporaryCount !== 0) {
		throw new RuntimeException('RST-005 temporary tables remain after finalization.');
	}
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($prefix.'mjlfinancement_'.'workflow_action')."'") !== 0) {
		throw new RuntimeException('The forbidden workflow-action table exists.');
	}
	print "MJL RST-005 Activity foundation schema: OK\n";
} catch (Throwable $exception) {
	fwrite(STDERR, 'ERROR: '.$exception->getMessage().PHP_EOL);
	exit(1);
}
