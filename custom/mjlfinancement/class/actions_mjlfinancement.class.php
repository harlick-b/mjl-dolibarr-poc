<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonhookactions.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

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
			$selector = GETPOST('mjlselector', 'alphanohtml');
			if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
				$_SESSION['mjl_reset_error'] = 'Le jeton de securite est invalide. Veuillez recharger la page.';
				header('Location: '.DOL_URL_ROOT.'/user/passwordforgotten.php?setnewpassword=1&mjlselector='.urlencode($selector));
				exit;
			}
			$error = mjl_auth_consume_password_reset($selector, GETPOST('verifier', 'restricthtml'), GETPOST('newpass1', 'restricthtml'), GETPOST('newpass2', 'restricthtml'));
			if ($error === '') {
				unset($_SESSION['dol_login']);
				$_SESSION['dol_loginmesg'] = 'Votre mot de passe a ete mis a jour. Vous pouvez vous connecter.';
				header('Location: '.DOL_URL_ROOT.'/index.php');
				exit;
			}
			$_SESSION['mjl_reset_error'] = $error;
			header('Location: '.DOL_URL_ROOT.'/user/passwordforgotten.php?setnewpassword=1&mjlselector='.urlencode($selector));
			exit;
		}

		return 0;
	}

	public function llxHeader($parameters, &$object, &$action, $hookmanager)
	{
		global $conf, $user;

		if (!empty($user) && !empty($user->id) && mjl_navigation_user_can_enter($user) && $this->isMjlWorkspacePath()) {
			$conf->dol_hide_topmenu = 1;
			$conf->dol_hide_leftmenu = 1;
		}
		return 0;
	}

	public function addHtmlHeader($parameters, &$object, &$action, $hookmanager)
	{
		global $user;

		if (!$this->shouldLoadMjlBrowserFont($user)) {
			return 0;
		}

		$this->resprints = '<meta name="referrer" content="same-origin">'."\n";
		$this->resprints .= '<link rel="preconnect" href="https://fonts.googleapis.com" referrerpolicy="no-referrer">'."\n";
		$this->resprints .= '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin referrerpolicy="no-referrer">'."\n";
		$this->resprints .= '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" referrerpolicy="no-referrer">'."\n";

		return 0;
	}

	private function shouldLoadMjlBrowserFont($user)
	{
		$path = $this->normalizedRequestPath();
		if ($path === '') {
			return false;
		}

		if (($path === '/' || $path === '/index.php') && (empty($user) || empty($user->id))) {
			return true;
		}
		if ($path === '/user/passwordforgotten.php') return false;
		if (strpos($path, '/custom/mjlfinancement/') !== 0) {
			return false;
		}

		foreach (array('/css/', '/js/', '/scripts/') as $nonDocumentPath) {
			if (strpos($path, '/custom/mjlfinancement'.$nonDocumentPath) === 0) {
				return false;
			}
		}

		return $path !== '/custom/mjlfinancement/documentdownload.php' && $path !== '/custom/mjlfinancement/invitation.php';
	}

	private function isMjlWorkspacePath()
	{
		return strpos($this->normalizedRequestPath(), '/custom/mjlfinancement/') === 0;
	}

	private function normalizedRequestPath()
	{
		$path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
		if (!is_string($path) || $path === '') {
			return '';
		}

		$root = rtrim((string) DOL_URL_ROOT, '/');
		if ($root !== '' && strpos($path, $root.'/') === 0) {
			$path = substr($path, strlen($root));
		}
		return '/'.ltrim($path, '/');
	}
}
