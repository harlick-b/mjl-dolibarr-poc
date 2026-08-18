<?php

define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

$operation = isset($argv[1]) ? $argv[1] : '';
$admin = new User($db);
if ($admin->fetch(1) <= 0) { fwrite(STDERR, "admin unavailable\n"); exit(2); }

$barrier = '';
foreach ($argv as $argument) {
	if (strpos($argument, '--barrier=') === 0) $barrier = substr($argument, 10);
}
if ($barrier !== '') {
	if (!preg_match('/^[a-f0-9]{32}$/', $barrier)) { fwrite(STDERR, "invalid barrier\n"); exit(2); }
	$barrierDir = DOL_DATA_ROOT.'/mjlfinancement/auth-test-barriers/'.$barrier;
	if (dol_mkdir($barrierDir) < 0 || file_put_contents($barrierDir.'/participant-'.getmypid(), 'ready') === false) { fwrite(STDERR, "barrier unavailable\n"); exit(2); }
	$release = $barrierDir.'/released';
	$deadline = microtime(true) + 10;
	while (!is_file($release) && microtime(true) < $deadline) {
		$participants = glob($barrierDir.'/participant-*');
		if (is_array($participants) && count($participants) >= 2) file_put_contents($release, 'go');
		usleep(20000);
	}
	if (!is_file($release)) { fwrite(STDERR, "barrier timeout\n"); exit(2); }
}

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
