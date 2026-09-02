<?php

if (PHP_SAPI !== 'cli') { http_response_code(403); exit(1); }
require_once dirname(__DIR__, 2).'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006a_schema.lib.php';

mjl_rst006a_require_target($db);
foreach (mjl_rst006a_suffixes() as $suffix) {
	if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst006a_table($db, $suffix)) !== 0) {
		throw new RuntimeException('Shared RST-006A table is not empty: '.$suffix);
	}
}
print "RST-006A exact target verified; shared planning tables are empty.\n";
