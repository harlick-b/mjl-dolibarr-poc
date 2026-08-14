<?php
if (empty($conf) || !is_object($conf)) {
	print "Error, template page can't be called as URL";
	exit(1);
}

require_once DOL_DOCUMENT_ROOT.'/core/lib/functions2.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');

$selector = GETPOST('mjlselector', 'alphanohtml');
$status = mjl_auth_reset_status($selector);
$error = empty($_SESSION['mjl_reset_error']) ? '' : $_SESSION['mjl_reset_error'];
unset($_SESSION['mjl_reset_error']);

top_htmlhead('', 'Réinitialiser le mot de passe', 0, 0, array(), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page">
<div class="mjl-auth-shell">
<main class="mjl-auth-panel" aria-labelledby="mjl-reset-title">
	<div class="mjl-auth-brand">
		<h1 id="mjl-reset-title">Définir un nouveau mot de passe</h1>
		<p>Choisissez un mot de passe personnel pour accéder à votre espace MJL.</p>
	</div>

	<?php if ($status !== 'valid') { ?>
		<div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive">Ce lien de réinitialisation est invalide ou expiré. Veuillez refaire une demande.</div>
		<div class="mjl-auth-actions"><a class="mjl-auth-button" href="<?php print DOL_URL_ROOT; ?>/user/passwordforgotten.php">Demander un nouveau lien</a></div>
	<?php } else { ?>
		<?php if ($error !== '') { ?><div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive"><?php print dol_escape_htmltag($error); ?></div><?php } ?>
		<form id="mjl-password-reset" method="post" action="<?php print DOL_URL_ROOT; ?>/user/passwordforgotten.php">
			<input type="hidden" name="token" value="<?php print newToken(); ?>">
			<input type="hidden" name="action" value="mjl_validate_password_reset">
			<input type="hidden" name="mjlselector" value="<?php print dol_escape_htmltag($selector); ?>">
			<div class="mjl-auth-field">
				<label for="verifier">Code secret de réinitialisation</label>
				<input type="password" id="verifier" name="verifier" autocomplete="one-time-code" required>
			</div>
			<div class="mjl-auth-field">
				<label for="newpass1">Nouveau mot de passe</label>
				<input type="password" id="newpass1" name="newpass1" autocomplete="new-password" autofocus>
			</div>
			<div class="mjl-auth-field">
				<label for="newpass2">Confirmer le mot de passe</label>
				<input type="password" id="newpass2" name="newpass2" autocomplete="new-password">
			</div>
			<p class="mjl-auth-help">Le mot de passe doit contenir au moins 10 caractères.</p>
			<div class="mjl-auth-actions">
				<button type="submit" class="mjl-auth-button">Définir mon mot de passe</button>
				<a class="mjl-auth-link" href="<?php print DOL_URL_ROOT; ?>/index.php">Retour à la connexion</a>
			</div>
		</form>
		<script src="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/js/auth_fragment.js"></script>
	<?php } ?>
</main>
</div>
</body>
</html>
