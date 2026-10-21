<?php

/** Private session-state adapter for MJL authentication. */

function mjl_auth_session_value($key, $default = '')
{
	return isset($_SESSION[$key]) ? $_SESSION[$key] : $default;
}

function mjl_auth_session_binding()
{
	$value = mjl_auth_session_value('mjl_otp_binding');
	return is_string($value) ? $value : '';
}

function mjl_auth_session_pending_user_id() { return (int) mjl_auth_session_value('mjl_otp_user_id', 0); }
function mjl_auth_session_pending_challenge_id() { return (int) mjl_auth_session_value('mjl_otp_challenge_id', 0); }
function mjl_auth_session_pending_email() { return (string) mjl_auth_session_value('mjl_otp_email', ''); }
function mjl_auth_session_pending_backtopage() { return (string) mjl_auth_session_value('mjl_otp_backtopage', ''); }

function mjl_auth_session_verified_state()
{
	return array(
		'challenge_id' => (int) mjl_auth_session_value('mjl_otp_verified_challenge_id', 0),
		'user_id' => (int) mjl_auth_session_value('mjl_otp_verified_user_id', 0),
		'binding' => mjl_auth_session_binding(),
	);
}

function mjl_auth_session_clear_pending()
{
	foreach (array('mjl_otp_binding','mjl_otp_challenge_id','mjl_otp_user_id','mjl_otp_email','mjl_otp_backtopage') as $key) unset($_SESSION[$key]);
}

function mjl_auth_session_clear_native()
{
	foreach (array('dol_login','dol_logindate','dol_authmode','dol_entity','mjl_otp_verified_challenge_id','mjl_otp_verified_user_id','mjl_authenticated_at','mjl_last_activity_at') as $key) unset($_SESSION[$key]);
}

function mjl_auth_session_begin_pending($binding, $challengeId, User $target, $backtopage)
{
	mjl_auth_session_clear_native();
	mjl_auth_session_clear_pending();
	session_regenerate_id(true);
	unset($_SESSION['mjl_api_csrf'], $_SESSION['mjl_form_submissions']);
	$_SESSION['mjl_otp_binding'] = (string) $binding;
	$_SESSION['mjl_otp_challenge_id'] = (int) $challengeId;
	$_SESSION['mjl_otp_user_id'] = (int) $target->id;
	$_SESSION['mjl_otp_email'] = (string) $target->email;
	$_SESSION['mjl_otp_backtopage'] = (string) $backtopage;
}

function mjl_auth_session_complete(User $target, $challengeId, $entity, $failCompletion = false)
{
	if ($failCompletion) {
		throw new RuntimeException('Injected session completion failure.');
	}
	session_regenerate_id(true);
	unset($_SESSION['mjl_api_csrf'], $_SESSION['mjl_form_submissions']);
	$_SESSION['dol_login'] = (string) $target->login;
	$_SESSION['dol_logindate'] = dol_now('gmt');
	$_SESSION['mjl_authenticated_at'] = $_SESSION['mjl_last_activity_at'] = time();
	$_SESSION['dol_authmode'] = 'mjl_email_otp';
	$_SESSION['dol_entity'] = (int) $entity;
	$_SESSION['mjl_otp_verified_challenge_id'] = (int) $challengeId;
	$_SESSION['mjl_otp_verified_user_id'] = (int) $target->id;
	unset($_SESSION['mjl_auth_login_email'], $_SESSION['dol_loginmesg']);
	foreach (array('mjl_otp_challenge_id','mjl_otp_user_id','mjl_otp_email','mjl_otp_backtopage') as $key) unset($_SESSION[$key]);
}

function mjl_auth_session_cancel()
{
	mjl_auth_session_clear_native();
	mjl_auth_session_clear_pending();
	session_regenerate_id(true);
	unset($_SESSION['mjl_api_csrf'], $_SESSION['mjl_form_submissions']);
}

function mjl_auth_session_invalidate($message)
{
	foreach (array_keys($_SESSION) as $key) unset($_SESSION[$key]);
	session_regenerate_id(true);
	unset($_SESSION['mjl_api_csrf'], $_SESSION['mjl_form_submissions']);
	$_SESSION['dol_loginmesg'] = (string) $message;
}

function mjl_auth_session_set_login_message($message) { $_SESSION['dol_loginmesg'] = (string) $message; }
function mjl_auth_session_login_message() { return (string) mjl_auth_session_value('dol_loginmesg', ''); }
function mjl_auth_session_remember_login_email($email) { $_SESSION['mjl_auth_login_email'] = (string) $email; }
function mjl_auth_session_login_email($fallback = '') { return (string) mjl_auth_session_value('mjl_auth_login_email', $fallback); }

function mjl_auth_session_consume_login_email($fallback = '')
{
	$value = mjl_auth_session_login_email($fallback);
	unset($_SESSION['mjl_auth_login_email']);
	return $value;
}

function mjl_auth_session_set_reset_error($error) { $_SESSION['mjl_reset_error'] = (string) $error; }

function mjl_auth_session_consume_reset_error()
{
	$value = (string) mjl_auth_session_value('mjl_reset_error', '');
	unset($_SESSION['mjl_reset_error']);
	return $value;
}

/** API CSRF stays stable across native page token renewal, in the same session. */
function mjl_auth_session_api_csrf()
{
 if (empty($_SESSION['mjl_api_csrf'])) $_SESSION['mjl_api_csrf']=bin2hex(random_bytes(32));
 return $_SESSION['mjl_api_csrf'];
}

/** Server clock policy shared by JSON and remaining HTML routes. */
function mjl_auth_session_expiry_decision($started, $active, $now)
{
 if (!is_int($started) || !is_int($active) || $started <= 0 || $active < $started || $started > $now || $active > $now) return 'session_invalidated';
 return $now - $started >= 86400 || $now - $active >= 86400 ? 'session_expired' : 'valid';
}

function mjl_auth_session_clock_state()
{
 return array('authenticated_at'=>mjl_auth_session_value('mjl_authenticated_at',0),'last_activity_at'=>mjl_auth_session_value('mjl_last_activity_at',0));
}

function mjl_auth_session_touch($now) { $_SESSION['mjl_last_activity_at'] = (int)$now; }

function mjl_auth_session_logout()
{
 mjl_auth_session_invalidate('');
 $params=session_get_cookie_params();
 setcookie(session_name(), '', array('expires'=>1,'path'=>$params['path'],'domain'=>$params['domain'],'secure'=>$params['secure'],'httponly'=>true,'samesite'=>'Lax'));
 session_destroy();
}

function mjl_auth_session_validity_decision($otpEnabled, $targetUserId, array $sessionState, $credentialRowExists, $credentialMatches)
{
	if (!$otpEnabled) return true;
	return (int) $sessionState['challenge_id'] > 0
		&& (int) $sessionState['user_id'] === (int) $targetUserId
		&& (string) $sessionState['binding'] !== ''
		&& (bool) $credentialRowExists
		&& (bool) $credentialMatches;
}
