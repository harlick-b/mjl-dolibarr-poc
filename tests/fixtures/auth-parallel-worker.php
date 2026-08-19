<?php

define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

$raw = file_get_contents('php://stdin', false, null, 0, 8193);
if (!is_string($raw) || $raw === '' || strlen($raw) > 8192) { fwrite(STDERR, "invalid request\n"); exit(2); }
try {
	$request = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
	fwrite(STDERR, "invalid request\n"); exit(2);
}
if (!is_array($request) || json_encode($request, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) !== $raw) { fwrite(STDERR, "invalid request\n"); exit(2); }
$operation = $request['operation'] ?? '';
$expected = array(
	'issue' => array('operation', 'login', 'email', 'barrier'),
	'accept' => array('operation', 'selector', 'verifier', 'password', 'barrier'),
	'reset' => array('operation', 'email', 'barrier'),
	'consume' => array('operation', 'selector', 'verifier', 'password', 'barrier'),
);
if (!isset($expected[$operation]) || array_keys($request) !== $expected[$operation]) { fwrite(STDERR, "invalid request\n"); exit(2); }
$bounded = static function ($value, int $maximum): bool { return is_string($value) && $value !== '' && strlen($value) <= $maximum && !preg_match('/[\x00-\x1f\x7f]/', $value); };
foreach ($request as $key => $value) {
	if ($key !== 'operation' && $key !== 'barrier' && !$bounded($value, $key === 'password' ? 128 : 320)) { fwrite(STDERR, "invalid request\n"); exit(2); }
}
$admin = new User($db);
if ($admin->fetch(1) <= 0) { fwrite(STDERR, "admin unavailable\n"); exit(2); }

$barrier = $request['barrier'];
if (!is_string($barrier)) { fwrite(STDERR, "invalid barrier\n"); exit(2); }
if ($barrier !== '') {
	if (!preg_match('/^[a-f0-9]{32}$/', $barrier)) { fwrite(STDERR, "invalid barrier\n"); exit(2); }
	$barrierDir = DOL_DATA_ROOT.'/mjlfinancement/auth-test-barriers/'.$barrier;
	if (!is_dir($barrierDir) && dol_mkdir($barrierDir) < 0 && !is_dir($barrierDir)) { fwrite(STDERR, "barrier unavailable\n"); exit(2); }
	if (file_put_contents($barrierDir.'/participant-'.getmypid(), 'ready') === false) { fwrite(STDERR, "barrier unavailable\n"); exit(2); }
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
		'login' => $request['login'], 'email' => $request['email'], 'firstname' => 'Parallel', 'lastname' => 'Auth', 'role_code' => 'AGENT_SAISIE',
	), $admin);
} elseif ($operation === 'accept') {
	$result = array(mjl_auth_accept_invitation($request['selector'], $request['verifier'], $request['password'], $request['password']));
} elseif ($operation === 'reset') {
	$result = array(mjl_auth_create_password_reset($request['email'], 1));
} elseif ($operation === 'consume') {
	$result = array(mjl_auth_consume_password_reset($request['selector'], $request['verifier'], $request['password'], $request['password']));
} else {
	fwrite(STDERR, "unknown operation\n"); exit(2);
}
print json_encode($result, JSON_UNESCAPED_SLASHES).PHP_EOL;
