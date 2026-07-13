<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_native_modules.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_sample_data.lib.php';

global $db, $user;

$adminUser = new User($db);
if ($adminUser->fetch(0, 'admin') <= 0) {
	fail('Unable to load Dolibarr admin user.');
}
$user = $adminUser;

$errors = mjl_native_modules_disable_workspace_modules('mjl_out');
if (!empty($errors)) {
	fail('Unable to disable native workspace modules: '.implode('; ', $errors));
}

mjl_out('Native workspace modules disabled.');
