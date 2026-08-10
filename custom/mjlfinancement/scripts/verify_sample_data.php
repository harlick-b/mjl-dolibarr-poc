<?php

require_once __DIR__.'/cli_guard.php';

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';

global $db;

function mjl_empty_state_fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(1);
}

function mjl_empty_state_count($sql, $label)
{
	global $db;

	$result = $db->query($sql);
	if (!$result) {
		mjl_empty_state_fail('Unable to check '.$label.': '.$db->lasterror());
	}
	$row = $db->fetch_row($result);
	return (int) $row[0];
}

$customTables = array(
	'mjlfinancement_access_audit',
	'mjlfinancement_activity',
	'mjlfinancement_budget_line',
	'mjlfinancement_convention',
	'mjlfinancement_exchange_log',
	'mjlfinancement_expense',
	'mjlfinancement_fund_receipt',
	'mjlfinancement_invitation',
	'mjlfinancement_password_reset',
	'mjlfinancement_project_note',
	'mjlfinancement_report',
	'mjlfinancement_user_role',
	'mjlfinancement_user_soc_scope',
	'mjlfinancement_validation',
	'mjlfinancement_workflow_action',
);

foreach ($customTables as $table) {
	$count = mjl_empty_state_count('SELECT COUNT(*) FROM '.$db->prefix().$table, $table);
	if ($count !== 0) {
		mjl_empty_state_fail($table.' contains '.$count.' persistent row(s).');
	}
}

$preservedAdminCount = mjl_empty_state_count(
	"SELECT COUNT(*) FROM ".$db->prefix()."user WHERE rowid = 1 AND entity = 0 AND login = 'admin' AND admin = 1 AND statut = 1",
	'preserved administrator'
);
if ($preservedAdminCount !== 1) {
	mjl_empty_state_fail('The checksum-approved native administrator invariant is not satisfied.');
}

$nativeChecks = array(
	'user' => "rowid <> 1",
	'usergroup' => '1 = 1',
	'usergroup_user' => '1 = 1',
	'usergroup_rights' => '1 = 1',
	'societe' => '1 = 1',
	'societe_commerciaux' => '1 = 1',
	'projet' => '1 = 1',
	'projet_task' => '1 = 1',
	'ecm_files' => '1 = 1',
);

foreach ($nativeChecks as $table => $where) {
	$count = mjl_empty_state_count('SELECT COUNT(*) FROM '.$db->prefix().$table.' WHERE '.$where, $table);
	if ($count !== 0) {
		mjl_empty_state_fail($table.' still contains '.$count.' reset target row(s).');
	}
}

$forbiddenPaths = array(
	DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/sample_data',
	DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/seed_sample_data.php',
	DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_sample_data.lib.php',
);
foreach ($forbiddenPaths as $path) {
	if (file_exists($path)) {
		mjl_empty_state_fail('Legacy persistent sample path still exists: '.$path);
	}
}

$documentRoots = array('/var/www/documents/mjlfinancement');
foreach (glob('/var/www/documents/ecm/mjlfinancement_*') ?: array() as $path) {
	$documentRoots[] = $path;
}
foreach ($documentRoots as $path) {
	if (!is_dir($path)) {
		continue;
	}
	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS)
	);
	foreach ($iterator as $entry) {
		if ($entry->isFile() || $entry->isLink()) {
			mjl_empty_state_fail('Persistent MJL document file still exists: '.$entry->getPathname());
		}
	}
}

print "MJL persistent sample-data absence checks passed.\n";
