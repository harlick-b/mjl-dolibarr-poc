<?php

require_once dirname(__DIR__, 2).'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once dirname(__DIR__, 2).'/activity_schema_installer.lib.php';
require_once dirname(__DIR__, 2).'/rst006a_schema.lib.php';

try {
	if (mjl_rst006a_detect_schema($db) === RST006A_SCHEMA_TARGET) mjl_rst006a_require_target($db);
	else mjl_rst002b_require_target_objects($db);
	$prefix = mjl_rst005_prefix($db);
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1') {
		if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($prefix.'mjlfinancement_activity')) !== 0
			|| (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($prefix.'mjlfinancement_activity_assignment')) !== 0) throw new RuntimeException('The shared RST-002B foundation must remain empty.');
	}
	print "MJL RST-002B Activity assignment schema: OK\n";
} catch (Throwable $exception) {
	fwrite(STDERR, 'ERROR: '.$exception->getMessage().PHP_EOL);
	exit(1);
}
