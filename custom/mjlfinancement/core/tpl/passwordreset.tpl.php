<?php
if (empty($conf) || !is_object($conf)) {
	print "Error, template page can't be called as URL";
	exit(1);
}

require_once DOL_DOCUMENT_ROOT.'/core/lib/functions2.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

$token = GETPOST('mjlreset', 'restricthtml');
$status = mjl_auth_reset_status($token);
$error = empty($_SESSION['mjl_reset_error']) ? '' : $_SESSION['mjl_reset_error'];
unset($_SESSION['mjl_reset_error']);

top_htmlhead('', 'Reinitialiser le mot de passe', 0, 0, array(), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page">
<div class="mjl-auth-shell">
<main class="mjl-auth-panel" aria-labelledby="mjl-reset-title">
	<div class="mjl-auth-brand">
		<h1 id="mjl-reset-title">Definir un nouveau mot de passe</h1>
		<p>Choisissez un mot de passe personnel pour acceder a votre espace MJL.</p>
	</div>

	<?php if ($status !== 'valid') { ?>
		<div class="mjl-auth-message mjl-auth-error">Ce lien de reinitialisation est invalide ou expire. Veuillez refaire une demande.</div>
		<div class="mjl-auth-actions"><a class="mjl-auth-button" href="<?php print DOL_URL_ROOT; ?>/user/passwordforgotten.php">Demander un nouveau lien</a></div>
	<?php } else { ?>
		<?php if ($error !== '') { ?><div class="mjl-auth-message mjl-auth-error"><?php print dol_escape_htmltag($error); ?></div><?php } ?>
		<form id="mjl-password-reset" method="post" action="<?php print DOL_URL_ROOT; ?>/user/passwordforgotten.php">
			<input type="hidden" name="token" value="<?php print newToken(); ?>">
			<input type="hidden" name="action" value="mjl_validate_password_reset">
			<input type="hidden" name="mjlreset" value="<?php print dol_escape_htmltag($token); ?>">
			<div class="mjl-auth-field">
				<label for="newpass1">Nouveau mot de passe</label>
				<input type="password" id="newpass1" name="newpass1" autocomplete="new-password" autofocus>
			</div>
			<div class="mjl-auth-field">
				<label for="newpass2">Confirmer le mot de passe</label>
				<input type="password" id="newpass2" name="newpass2" autocomplete="new-password">
			</div>
			<p class="mjl-auth-help">Le mot de passe doit contenir au moins 10 caracteres.</p>
			<div class="mjl-auth-actions">
				<button type="submit" class="mjl-auth-button">Definir mon mot de passe</button>
				<a class="mjl-auth-link" href="<?php print DOL_URL_ROOT; ?>/index.php">Retour a la connexion</a>
			</div>
		</form>
	<?php } ?>
</main>
</div>
</body>
</html>
