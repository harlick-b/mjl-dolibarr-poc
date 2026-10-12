<?php

$root = dirname(__DIR__, 2);
function w4Source($root, $path) { return file_get_contents($root.'/'.$path); }
function w4Check($condition, $message) { if (!$condition) throw new RuntimeException($message); }

$auth = w4Source($root, 'custom/mjlfinancement/lib/mjl_auth.lib.php');
$command = w4Source($root, 'custom/mjlfinancement/class/mjlauthcommand.class.php');
$session = w4Source($root, 'custom/mjlfinancement/lib/auth/mjl_auth_session.lib.php');
$email = w4Source($root, 'custom/mjlfinancement/lib/mjl_email.lib.php');
$scope = w4Source($root, 'custom/mjlfinancement/lib/mjl_scope.lib.php');
$policy = w4Source($root, 'custom/mjlfinancement/lib/access/mjl_access_policy.lib.php');
$loginTemplate = w4Source($root, 'custom/mjlfinancement/core/tpl/login.tpl.php');
$resetTemplate = w4Source($root, 'custom/mjlfinancement/core/tpl/passwordreset.tpl.php');

$production = array();
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/custom/mjlfinancement'));
foreach ($iterator as $file) {
	if ($file->isFile() && $file->getExtension() === 'php') {
		$relative = substr($file->getPathname(), strlen($root) + 1);
		$production[$relative] = file_get_contents($file->getPathname());
	}
}
$allProduction = implode("\n", $production);

w4Check(preg_match_all('/class\s+MjlAuthCommand\s*\{/', $allProduction) === 1, 'exactly one auth command owner is required');
foreach (array('issueInvitation','acceptInvitation','revokeInvitation','createPasswordReset','consumePasswordReset','startOtp','verifyOtp','resendOtp') as $method) {
	w4Check(preg_match_all('/public function\s+'.preg_quote($method, '/').'\s*\(/', $command) === 1, 'auth command method missing: '.$method);
}
w4Check(substr_count($command, '->assignProfileInTransaction(') === 1, 'invitation must retain the W3 transaction participant');
w4Check(strpos($command, "beginTransaction('mjl issue invitation')") !== false && strpos($command, "commit('mjl issue invitation')") !== false, 'auth command must own invitation transaction orchestration');
w4Check(substr_count($command, '$db->begin(') === 1, 'auth transaction starts must pass through one checked owner-local helper');
w4Check(substr_count($command, '$this->beginTransaction(') === 10, 'every auth transaction start must be checked');
w4Check(substr_count($command, '$db->rollback(') === 1, 'auth rollback requests must pass through one owner-local quarantine helper');
w4Check(substr_count($command, '$this->rollbackTransaction(') >= 10, 'auth transaction failures must use checked rollback handling');

$legacy = array(
	'mjl_auth_issue_invitation' => 'issueInvitation',
	'mjl_auth_accept_invitation' => 'acceptInvitation',
	'mjl_auth_revoke_invitation' => 'revokeInvitation',
	'mjl_auth_create_password_reset' => 'createPasswordReset',
	'mjl_auth_consume_password_reset' => 'consumePasswordReset',
	'mjl_auth_start_otp' => 'startOtp',
	'mjl_auth_verify_otp' => 'verifyOtp',
	'mjl_auth_resend_otp' => 'resendOtp',
);
foreach ($legacy as $function => $method) {
	w4Check(preg_match_all('/function\s+'.preg_quote($function, '/').'\s*\(/', $allProduction) === 1, 'compatibility entrypoint count changed: '.$function);
	$start = strpos($auth, 'function '.$function.'(');
	$next = strpos($auth, "\nfunction ", $start + 1);
	$body = substr($auth, $start, $next === false ? null : $next - $start);
	w4Check(strpos($body, 'mjl_auth_command()') !== false && strpos($body, '->'.$method.'(') !== false, 'compatibility entrypoint must delegate to command: '.$function);
	w4Check(strpos($body, '$db->') === false, 'compatibility entrypoint retains database authority: '.$function);
}

$authSessionFiles = array(
	'custom/mjlfinancement/lib/mjl_auth.lib.php',
	'custom/mjlfinancement/class/mjlauthcommand.class.php',
	'custom/mjlfinancement/auth.php',
	'custom/mjlfinancement/invitation.php',
	'custom/mjlfinancement/class/actions_mjlfinancement.class.php',
	'custom/mjlfinancement/core/tpl/login.tpl.php',
	'custom/mjlfinancement/core/tpl/passwordreset.tpl.php',
);
foreach ($authSessionFiles as $path) {
	w4Check(strpos($production[$path], '$_SESSION') === false, 'auth session state escapes the private adapter: '.$path);
	w4Check(strpos($production[$path], 'session_regenerate_id') === false, 'session regeneration escapes the private adapter: '.$path);
}
w4Check(strpos($session, '$_SESSION') !== false && strpos($session, 'session_regenerate_id') !== false, 'private session adapter does not own session mutation');
w4Check(strpos($loginTemplate, 'mjl_auth_session_') === false && strpos($resetTemplate, 'mjl_auth_session_') === false, 'presentation templates must receive prepared auth state');
w4Check(strpos($loginTemplate, 'GETPOST(') === false && strpos($resetTemplate, 'GETPOST(') === false && strpos($resetTemplate, 'mjl_auth_reset_status(') === false && strpos($resetTemplate, 'mjl_auth_reset_email(') === false, 'auth templates must render prepared request and reset data only');
w4Check(strpos($command, 'global $db') === false && strpos($command, 'global $conf') === false && strpos($command, 'mjl_auth_entity()') === false, 'auth command dependencies must be injected');
w4Check(strpos($command, 'getDolGlobalString(') === false && strpos($command, 'getenv(') === false && strpos($session, 'getDolGlobalString(') === false && strpos($session, 'getenv(') === false && strpos($session, 'global $conf') === false, 'command and session adapter runtime values must be supplied by orchestration');

$decisionStart = strpos($session, 'function mjl_auth_session_validity_decision');
$decision = substr($session, $decisionStart);
w4Check($decisionStart !== false && strpos($decision, '$_SESSION') === false && strpos($decision, '$db') === false, 'session validity decision must be pure');

foreach (array('mjl_auth_e2e_tokens_enabled','mjl_auth_write_test_outbox') as $helper) {
	w4Check(preg_match_all('/function\s+'.preg_quote($helper, '/').'\s*\(/', $allProduction) === 1, 'email-owned helper definition count changed: '.$helper);
	w4Check(strpos($email, 'function '.$helper.'(') !== false, 'email module must own helper: '.$helper);
	w4Check(strpos($auth, 'function '.$helper.'(') === false, 'auth library retains email helper: '.$helper);
}
w4Check(strpos($email, "function_exists('mjl_auth_") === false, 'email module retains reverse auth callback discovery');

w4Check(strpos($scope, "require_once __DIR__.'/access/mjl_access_policy.lib.php'") !== false, 'scope compatibility seam must load the access policy');
foreach (array('mjl_scope_role_codes','mjl_scope_effective_role_code','mjl_scope_is_platform_admin') as $policyFunction) {
	w4Check(preg_match_all('/function\s+'.preg_quote($policyFunction, '/').'\s*\(/', $allProduction) === 1, 'access policy definition count changed: '.$policyFunction);
	w4Check(strpos($policy, 'function '.$policyFunction.'(') !== false, 'access policy owner missing: '.$policyFunction);
}

w4Check(!is_file($root.'/custom/mjlfinancement/register.php'), 'public registration route is forbidden');
w4Check(substr_count($allProduction, 'MJL_AUTH_E2E_FAIL_SESSION_COMPLETION') === 1 && strpos($auth, 'MJL_AUTH_E2E_FAIL_SESSION_COMPLETION') !== false && strpos($session, '$failCompletion') !== false, 'session completion test flag must be captured once at orchestration and supplied to the adapter');

print "W4 auth ownership contract passed\n";
