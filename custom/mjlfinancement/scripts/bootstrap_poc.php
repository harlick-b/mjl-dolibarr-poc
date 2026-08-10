<?php

require_once __DIR__.'/cli_guard.php';

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_native_modules.lib.php';
require_once __DIR__.'/preserved_admin.lib.php';

global $db, $user;

function mjl_bootstrap_fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(1);
}

function mjl_bootstrap_out($message)
{
	print $message.PHP_EOL;
}

try {
	$adminUser = mjl_load_preserved_native_admin($db);
} catch (RuntimeException $exception) {
	mjl_bootstrap_fail($exception->getMessage());
}
$user = $adminUser;

$modules = array(
	'modUser',
	'modSociete',
	'modProjet',
	'modECM',
	'modExport',
	'modMjlFinancement',
);

foreach ($modules as $module) {
	$result = activateModule($module, 1, 1);
	if ($result < 0) {
		mjl_bootstrap_fail('Failed to activate '.$module.'.');
	}
	mjl_bootstrap_out('Activated '.$module.'.');
}

$nativeCleanupErrors = mjl_native_modules_disable_workspace_modules('mjl_bootstrap_out');
if (!empty($nativeCleanupErrors)) {
	mjl_bootstrap_fail('Unable to disable unsafe native modules: '.implode('; ', $nativeCleanupErrors));
}

mjl_bootstrap_out('MJL module activation completed without creating users, roles, groups, Partners, Projects, business records, documents, or sample data.');
