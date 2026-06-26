<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonhookactions.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

class ActionsMjlfinancement extends CommonHookActions
{
	public $db;
	public $resprints = '';
	public $results = array();

	public function __construct($db)
	{
		$this->db = $db;
	}

	public function redirectAfterConnection($parameters, &$object, &$action, $hookmanager)
	{
		return 0;
	}

	public function afterLoginFailed($parameters, &$object, &$action, $hookmanager)
	{
		if (empty($_SESSION['dol_loginmesg'])) {
			return 0;
		}

		$message = (string) $_SESSION['dol_loginmesg'];
		if (stripos($message, 'invalid') !== false || stripos($message, 'password change') !== false || stripos($message, 'SessionInvalidated') !== false) {
			$_SESSION['dol_loginmesg'] = 'Votre session a expire pour des raisons de securite. Veuillez vous reconnecter.';
		}

		return 0;
	}

	public function doActions($parameters, &$object, &$action, $hookmanager)
	{
		if (empty($parameters['currentcontext']) || strpos($parameters['currentcontext'], 'passwordforgottenpage') === false) {
			return 0;
		}

		if ($action === 'mjl_build_password_reset') {
			if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
				mjl_auth_record_event('password_reset_bad_csrf', null, null, 'ip_hash='.mjl_auth_client_ip_hash().mjl_auth_e2e_context_suffix());
				header('Location: '.DOL_URL_ROOT.'/user/passwordforgotten.php?mjl_reset_requested=1');
				exit;
			}
			$email = GETPOST('email', 'restricthtml');
			mjl_auth_create_password_reset($email);
			header('Location: '.DOL_URL_ROOT.'/user/passwordforgotten.php?mjl_reset_requested=1');
			exit;
		}

		if ($action === 'mjl_validate_password_reset') {
			$token = GETPOST('mjlreset', 'restricthtml');
			if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
				$_SESSION['mjl_reset_error'] = 'Le jeton de securite est invalide. Veuillez recharger la page.';
				header('Location: '.DOL_URL_ROOT.'/user/passwordforgotten.php?setnewpassword=1&mjlreset='.urlencode($token));
				exit;
			}
			$error = mjl_auth_consume_password_reset($token, GETPOST('newpass1', 'restricthtml'), GETPOST('newpass2', 'restricthtml'));
			if ($error === '') {
				unset($_SESSION['dol_login']);
				$_SESSION['dol_loginmesg'] = 'Votre mot de passe a ete mis a jour. Vous pouvez vous connecter.';
				header('Location: '.DOL_URL_ROOT.'/index.php');
				exit;
			}
			$_SESSION['mjl_reset_error'] = $error;
			header('Location: '.DOL_URL_ROOT.'/user/passwordforgotten.php?setnewpassword=1&mjlreset='.urlencode($token));
			exit;
		}

		return 0;
	}
}
