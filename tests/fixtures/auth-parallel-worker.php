<?php

define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

$operation = isset($argv[1]) ? $argv[1] : '';
$admin = new User($db);
if ($admin->fetch(1) <= 0) { fwrite(STDERR, "admin unavailable\n"); exit(2); }

if ($operation === 'issue') {
	$result = mjl_auth_issue_invitation(array(
		'login' => $argv[2], 'email' => $argv[3], 'firstname' => 'Parallel', 'lastname' => 'Auth', 'role_code' => 'AGENT_SAISIE',
	), $admin);
} elseif ($operation === 'accept') {
	$result = array(mjl_auth_accept_invitation($argv[2], $argv[3], $argv[4], $argv[4]));
} elseif ($operation === 'reset') {
	$result = array(mjl_auth_create_password_reset($argv[2], 1));
} elseif ($operation === 'consume') {
	$result = array(mjl_auth_consume_password_reset($argv[2], $argv[3], $argv[4], $argv[4]));
} else {
	fwrite(STDERR, "unknown operation\n"); exit(2);
}
print json_encode($result, JSON_UNESCAPED_SLASHES).PHP_EOL;
