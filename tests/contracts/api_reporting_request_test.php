<?php

$root = dirname(__DIR__, 2);
$http = file_get_contents($root.'/custom/mjlfinancement/lib/api/mjl_api_http.lib.php');
$front = file_get_contents($root.'/custom/mjlfinancement/api/index.php');

function reporting_contract_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

foreach (array('/dashboard', '/alerts', '/audit-events', '/reports/') as $route) {
	reporting_contract_assert(strpos($http, $route) !== false, 'REST request parser must own '.$route.'.');
}
reporting_contract_assert(strpos($front, 'mjl_api_reporting.lib.php') !== false, 'Front controller must load the reporting adapter.');
reporting_contract_assert(strpos($front, 'mjl_api_reporting(') !== false, 'Front controller must dispatch reporting routes.');

foreach (array('index.php', 'alerts.php', 'reports.php', 'workflowactions.php') as $page) {
	$source = file_get_contents($root.'/custom/mjlfinancement/'.$page);
	reporting_contract_assert(strpos($source, 'mjl_reporting_shell') !== false, $page.' must be a REST screen shell.');
}

$legacy = file_get_contents($root.'/custom/mjlfinancement/reportexport.php');
reporting_contract_assert(strpos($legacy, '410') !== false, 'Legacy export route must be retired without advertising a supported form method.');

print "MJL reporting REST request contract passed.\n";
