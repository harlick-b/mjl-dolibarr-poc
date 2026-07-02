<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonhookactions.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

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
		$this->redirectRestrictedNativeWorkspace();

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

	private function redirectRestrictedNativeWorkspace()
	{
		global $user;

		if (empty($user) || empty($user->id) || !mjl_workspace_user_can_read($user)) {
			return;
		}

		$path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
		if (!is_string($path) || $path === '') {
			return;
		}

		$root = rtrim((string) DOL_URL_ROOT, '/');
		if ($root !== '' && strpos($path, $root.'/') === 0) {
			$path = substr($path, strlen($root));
		}
		$path = '/'.ltrim($path, '/');

		if (strpos($path, '/custom/mjlfinancement/') === 0 || $path === '/index.php') {
			return;
		}

		if ($this->isDeniedNativeWorkspacePath($path, $user)) {
			header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/index.php', true, 302);
			exit;
		}
	}

	private function isDeniedNativeWorkspacePath($path, User $targetUser)
	{
		if (!empty($targetUser->admin)) {
			return false;
		}

		$businessDeniedPaths = array(
			'/societe',
			'/comm',
			'/projet',
			'/ecm',
			'/expensereport',
			'/hrm',
			'/holiday',
			'/modulebuilder',
			'/api',
			'/core/tools.php',
			'/commande',
			'/fourn',
			'/compta',
			'/accountancy',
			'/banque',
			'/tax',
			'/admin/tools',
			'/admin/system',
			'/admin/dict',
			'/admin/modules.php',
		);
		foreach ($businessDeniedPaths as $prefix) {
			if ($this->pathStartsWith($path, $prefix)) {
				return true;
			}
		}

		return false;
	}

	private function pathStartsWith($path, $prefix)
	{
		return $path === $prefix || strpos($path, rtrim($prefix, '/').'/') === 0;
	}
}
