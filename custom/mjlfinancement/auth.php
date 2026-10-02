<?php

define('NOLOGIN', 1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');

if (!mjl_auth_otp_enabled()) {
	header('Location: '.DOL_URL_ROOT.'/index.php');
	exit;
}

$action = GETPOST('action', 'aZ09');
$error = '';
$notice = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		$error = 'Le jeton de sécurité est invalide. Veuillez recharger la page.';
	} elseif ($action === 'login') {
		$emailInput = strtolower(trim(GETPOST('email', 'restricthtml')));
		$_SESSION['mjl_auth_login_email'] = $emailInput;
		$result = mjl_auth_start_otp($emailInput, GETPOST('password', 'password'), GETPOST('backtopage', 'restricthtml'));
		if ($result[0]) {
			header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/auth.php');
			exit;
		}
		$error = $result[1];
	} elseif ($action === 'verify' && mjl_auth_otp_pending()) {
		$result = mjl_auth_verify_otp(GETPOST('code', 'alphanohtml'));
		if ($result[0]) {
			header('Location: '.DOL_URL_ROOT.$result[1]);
			exit;
		}
		$error = $result[1];
	} elseif ($action === 'resend' && mjl_auth_otp_pending()) {
		$result = mjl_auth_resend_otp();
		$result[0] ? $notice = $result[1] : $error = $result[1];
	} elseif ($action === 'cancel') {
		mjl_auth_clear_native_session();
		mjl_auth_otp_clear_pending_session();
		session_regenerate_id(true);
		header('Location: '.DOL_URL_ROOT.'/index.php');
		exit;
	} else {
		$error = 'Votre session de vérification a expiré.';
	}
}

if (!mjl_auth_otp_pending()) {
	$_SESSION['dol_loginmesg'] = $error !== '' ? $error : 'Votre session de vérification a expiré.';
	header('Location: '.DOL_URL_ROOT.'/index.php');
	exit;
}

$email = isset($_SESSION['mjl_otp_email']) ? (string) $_SESSION['mjl_otp_email'] : '';
$at = strrpos($email, '@');
$masked = $at === false ? '' : substr($email, 0, 1).str_repeat('•', max(4, $at - 1)).substr($email, $at);

top_htmlhead('', 'Vérification · MJL', 0, 0, array('/custom/mjlfinancement/js/mjl_auth.js'), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page">
<div class="mjl-auth-shell">
	<aside class="mjl-auth-sidebar" aria-hidden="true"><span></span><span></span><span></span><span></span></aside>
	<div class="mjl-auth-content">
		<header class="mjl-auth-header"><a class="mjl-auth-logo" href="<?php print DOL_URL_ROOT; ?>/index.php" aria-label="MJL"><span>M</span><strong>MJL</strong></a></header>
		<main class="mjl-auth-main">
			<section class="mjl-auth-panel" aria-labelledby="mjl-otp-title">
				<div class="mjl-auth-heading"><h1 id="mjl-otp-title">Vérification</h1><p>Saisissez le code envoyé à<br><strong><?php print dol_escape_htmltag($masked); ?></strong></p></div>
				<?php if ($error !== '') { ?><div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive"><?php print dol_escape_htmltag($error); ?><?php if ($error === 'Code incorrect.') { ?><span>Vérifiez le code reçu puis réessayez.</span><?php } ?></div><?php } ?>
				<?php if ($notice !== '') { ?><div class="mjl-auth-message mjl-auth-success" role="status" aria-live="polite"><?php print dol_escape_htmltag($notice); ?></div><?php } ?>
				<form method="post" action="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/auth.php" data-mjl-auth-form>
					<input type="hidden" name="token" value="<?php print newToken(); ?>">
					<input type="hidden" name="action" value="verify">
					<div class="mjl-auth-field">
						<label for="mjl-otp-code">Code de vérification</label>
						<div class="mjl-otp-control" data-mjl-otp>
							<div class="mjl-otp-slots" aria-hidden="true"><span></span><span></span><span></span><i>−</i><span></span><span></span><span></span></div>
							<input id="mjl-otp-code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code" aria-invalid="<?php print $error === 'Code incorrect.' ? 'true' : 'false'; ?>" required autofocus>
						</div>
					</div>
					<button type="submit" class="mjl-auth-button">Vérifier</button>
				</form>
				<form method="post" action="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/auth.php" class="mjl-auth-secondary">
					<input type="hidden" name="token" value="<?php print newToken(); ?>">
					<input type="hidden" name="action" value="resend">
					<span>Code non reçu ?</span> <button type="submit" class="mjl-auth-link">Renvoyer le code</button>
				</form>
				<form method="post" action="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/auth.php" class="mjl-auth-return">
					<input type="hidden" name="token" value="<?php print newToken(); ?>"><input type="hidden" name="action" value="cancel">
					<button type="submit" class="mjl-auth-link">Retour à la connexion</button>
				</form>
			</section>
		</main>
	</div>
</div>
</body>
</html>
<?php $db->close(); ?>
