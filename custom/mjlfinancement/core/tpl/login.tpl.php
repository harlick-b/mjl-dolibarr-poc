<?php
if (empty($conf) || !is_object($conf)) { print "Error, template page can't be called as URL"; exit(1); }
require_once DOL_DOCUMENT_ROOT.'/core/lib/functions2.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
$otpEnabled = mjl_auth_otp_enabled();
$otpReady = !$otpEnabled || mjl_auth_otp_table_ready();
$loginValue = $otpEnabled && isset($_SESSION['mjl_auth_login_email']) ? (string) $_SESSION['mjl_auth_login_email'] : (string) $login;
unset($_SESSION['mjl_auth_login_email']);
$php_self = $otpEnabled ? DOL_URL_ROOT.'/custom/mjlfinancement/auth.php' : (empty($php_self) ? dol_escape_htmltag($_SERVER['PHP_SELF']) : $php_self);
top_htmlhead('', 'Connexion · MJL', 0, 0, array('/core/js/dst.js', '/custom/mjlfinancement/js/mjl_auth.js'), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page">
<div class="mjl-auth-shell">
	<aside class="mjl-auth-sidebar" aria-hidden="true"><span></span><span></span><span></span><span></span></aside>
	<div class="mjl-auth-content">
		<header class="mjl-auth-header"><div class="mjl-auth-logo"><span>M</span><strong>MJL</strong></div></header>
		<main class="mjl-auth-main">
			<section class="mjl-auth-panel" aria-labelledby="mjl-login-title">
				<div class="mjl-auth-heading"><h1 id="mjl-login-title">Connexion</h1></div>
				<?php if (!empty($dol_loginmesg)) { ?><div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive"><?php print dol_escape_htmltag(strip_tags($dol_loginmesg)); ?></div><?php } ?>
				<?php if (!$otpReady) { ?>
					<div class="mjl-auth-message mjl-auth-error" role="alert">La connexion est temporairement indisponible.</div>
				<?php } else { ?>
				<form id="login" name="login" method="post" action="<?php print $php_self; ?>" data-mjl-auth-form>
					<input type="hidden" name="token" value="<?php print newToken(); ?>">
					<?php if ($otpEnabled) { ?>
						<input type="hidden" name="action" value="login">
						<input type="hidden" name="backtopage" value="<?php print dol_escape_htmltag(GETPOST('backtopage', 'restricthtml')); ?>">
					<?php } else { ?>
						<input type="hidden" name="actionlogin" value="login"><input type="hidden" name="loginfunction" value="loginfunction">
					<?php } ?>
					<div class="mjl-auth-field">
						<label for="username"><?php print $otpEnabled ? 'Adresse email' : 'Identifiant'; ?></label>
						<input type="<?php print $otpEnabled ? 'email' : 'text'; ?>" id="username" name="<?php print $otpEnabled ? 'email' : 'username'; ?>" value="<?php print dol_escape_htmltag($loginValue); ?>" autocomplete="username" required autofocus>
					</div>
					<div class="mjl-auth-field">
						<label for="password">Mot de passe</label>
						<div class="mjl-auth-password"><input type="password" id="password" name="password" autocomplete="current-password" required><button type="button" data-mjl-password-toggle aria-label="Afficher le mot de passe" aria-pressed="false"><span aria-hidden="true">◉</span></button></div>
					</div>
					<div class="mjl-auth-forgot"><a class="mjl-auth-link" href="<?php print DOL_URL_ROOT; ?>/user/passwordforgotten.php">Mot de passe oublié ?</a></div>
					<button type="submit" class="mjl-auth-button">Se connecter</button>
				</form>
				<?php } ?>
			</section>
		</main>
	</div>
</div>
</body>
</html>
