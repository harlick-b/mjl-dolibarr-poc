<?php

require_once __DIR__.'/cli_guard.php';

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_native_modules.lib.php';
require_once __DIR__.'/preserved_admin.lib.php';

global $db, $user;

try {
	$adminUser = mjl_load_preserved_native_admin($db);
} catch (RuntimeException $exception) {
	mjl_disable_modules_fail($exception->getMessage());
}
$user = $adminUser;

$errors = mjl_native_modules_disable_workspace_modules('mjl_disable_modules_out');
if (!empty($errors)) {
	mjl_disable_modules_fail('Unable to disable native workspace modules: '.implode('; ', $errors));
}

mjl_disable_modules_out('Native workspace modules disabled.');

function mjl_disable_modules_out($message)
{
	print $message.PHP_EOL;
}

function mjl_disable_modules_fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(1);
}
