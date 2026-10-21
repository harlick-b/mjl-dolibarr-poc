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

	public function beforeLoginAuthentication($parameters, &$object, &$action, $hookmanager)
	{
		if (!mjl_auth_otp_enabled() || GETPOST('actionlogin', 'aZ09') !== 'login') return 0;
		mjl_auth_session_set_login_message('Utilisez le formulaire de connexion MJL.');
		return -1;
	}

	public function updateSession($parameters, &$object, &$action, $hookmanager)
	{
		global $user;
		if (!mjl_auth_otp_enabled() || empty($user->id)) return 0;
		$path=parse_url((string)($_SERVER['REQUEST_URI']??''),PHP_URL_PATH);
		$foreground=!preg_match('~/(css|js|scripts|ajax)/~',(string)$path);
		if (mjl_auth_check_session($user,$foreground)==='valid') return 0;
		mjl_auth_session_set_login_message('Votre session doit être vérifiée de nouveau.');
		header('Location: '.DOL_URL_ROOT.'/index.php');
		exit;
	}

	public function afterLoginFailed($parameters, &$object, &$action, $hookmanager)
	{
		if (mjl_auth_session_login_message() === '') {
			return 0;
		}

		$message = mjl_auth_session_login_message();
		if (stripos($message, 'invalid') !== false || stripos($message, 'password change') !== false || stripos($message, 'SessionInvalidated') !== false) {
			mjl_auth_session_set_login_message('Votre session a expire pour des raisons de securite. Veuillez vous reconnecter.');
		}

		return 0;
	}

	public function getLoginPageOptions($parameters, &$object, &$action, $hookmanager)
	{
		$GLOBALS['mjl_auth_login_view'] = array(
			'otp_enabled' => mjl_auth_otp_enabled(),
			'otp_ready' => !mjl_auth_otp_enabled() || mjl_auth_otp_table_ready(),
			'email' => mjl_auth_session_consume_login_email(''),
			'backtopage' => GETPOST('backtopage', 'restricthtml'),
		);
		return 0;
	}

	public function getPasswordForgottenPageOptions($parameters, &$object, &$action, $hookmanager)
	{
		$selector = GETPOST('mjlselector', 'alphanohtml');
		$GLOBALS['mjl_auth_reset_view'] = array('selector' => $selector);
		return 0;
	}

	public function doActions($parameters, &$object, &$action, $hookmanager)
	{
		if (empty($parameters['currentcontext']) || strpos($parameters['currentcontext'], 'passwordforgottenpage') === false) {
			return 0;
		}
		if (in_array($action, array('buildnewpassword', 'validatenewpassword'), true)) {
			header('Location: '.DOL_URL_ROOT.'/user/passwordforgotten.php');
			exit;
		}

		if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); header('Allow: GET'); exit; }

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
		if ($path === '/user/passwordforgotten.php' || $path === '/custom/mjlfinancement/invitation.php' || $path === '/custom/mjlfinancement/auth.php') return true;
		if (strpos($path, '/custom/mjlfinancement/') !== 0) {
			return false;
		}

		foreach (array('/css/', '/js/', '/scripts/') as $nonDocumentPath) {
			if (strpos($path, '/custom/mjlfinancement'.$nonDocumentPath) === 0) {
				return false;
			}
		}

		return $path !== '/custom/mjlfinancement/documentdownload.php';
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
