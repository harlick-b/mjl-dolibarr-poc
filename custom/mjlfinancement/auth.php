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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); header('Allow: GET'); exit; }
$error = ''; $notice = '';

if (!mjl_auth_otp_pending()) {
	mjl_auth_session_set_login_message($error !== '' ? $error : 'Votre session de vérification a expiré.');
	header('Location: '.DOL_URL_ROOT.'/index.php');
	exit;
}

$email = mjl_auth_session_pending_email();
$at = strrpos($email, '@');
$masked = $at === false ? '' : substr($email, 0, 1).str_repeat('•', max(4, $at - 1)).substr($email, $at);

top_htmlhead('', 'Vérification · MJL', 0, 0, array('/custom/mjlfinancement/js/mjl_api.js', '/custom/mjlfinancement/js/mjl_auth.js'), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page"><p role="alert" data-mjl-js-required>JavaScript est nécessaire pour utiliser cet écran.</p>
<div class="mjl-auth-shell">
	<aside class="mjl-auth-sidebar" aria-hidden="true"><span></span><span></span><span></span><span></span></aside>
	<div class="mjl-auth-content">
		<header class="mjl-auth-header"><a class="mjl-auth-logo" href="<?php print DOL_URL_ROOT; ?>/index.php" aria-label="MJL"><span>M</span><strong>MJL</strong></a></header>
		<main class="mjl-auth-main">
			<section class="mjl-auth-panel" aria-labelledby="mjl-otp-title">
				<div class="mjl-auth-heading"><h1 id="mjl-otp-title">Vérification</h1><p>Saisissez le code envoyé à<br><strong><?php print dol_escape_htmltag($masked); ?></strong></p></div>
				<?php if ($error !== '') { ?><div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive"><?php print dol_escape_htmltag($error); ?><?php if ($error === 'Code incorrect.') { ?><span>Vérifiez le code reçu puis réessayez.</span><?php } ?></div><?php } ?>
				<?php if ($notice !== '') { ?><div class="mjl-auth-message mjl-auth-success" role="status" aria-live="polite"><?php print dol_escape_htmltag($notice); ?></div><?php } ?>
				<form method="post" action="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/auth.php" data-mjl-auth-form data-mjl-auth-api="verify">
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
				<form method="post" action="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/auth.php" class="mjl-auth-secondary" data-mjl-auth-api="resend">
					<input type="hidden" name="token" value="<?php print newToken(); ?>">
					<input type="hidden" name="action" value="resend">
					<span>Code non reçu ?</span> <button type="submit" class="mjl-auth-link">Renvoyer le code</button>
				</form>
				<form method="post" action="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/auth.php" class="mjl-auth-return" data-mjl-auth-api="cancel">
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
