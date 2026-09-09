<?php

require_once dirname(__DIR__, 2).'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once dirname(__DIR__, 2).'/rst006b_schema.lib.php';

try {
	mjl_rst006b_require_target($db);
	foreach (array('mjlfinancement_activity','mjlfinancement_operation','mjlfinancement_cancellation_request','mjlfinancement_reopening_request') as $suffix) {
		if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$db->prefix().$suffix) !== 0 && getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1') throw new RuntimeException('Shared Phase 3A business tables must remain empty.');
	}
	print 'MJL Phase 3A execution schema: OK'.PHP_EOL;
} catch (Throwable $exception) {
	fwrite(STDERR, 'MJL Phase 3A execution schema failed: '.$exception->getMessage().PHP_EOL);
	exit(1);
}

