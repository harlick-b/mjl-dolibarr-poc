<?php
if (empty($conf) || !is_object($conf)) {
	print "Error, template page can't be called as URL";
	exit(1);
}

require_once DOL_DOCUMENT_ROOT.'/core/lib/functions2.lib.php';

$php_self = DOL_URL_ROOT.'/user/passwordforgotten.php';
top_htmlhead('', 'Mot de passe oublie', 0, 0, array(), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page">
<div class="mjl-auth-shell">
<main class="mjl-auth-panel" aria-labelledby="mjl-forgot-title">
	<div class="mjl-auth-brand">
		<h1 id="mjl-forgot-title">Mot de passe oublie</h1>
		<p>Indiquez l adresse email associee a votre acces MJL.</p>
	</div>

	<?php if (GETPOST('mjl_reset_requested', 'int')) { ?>
		<div class="mjl-auth-message">Si un compte correspond a cette adresse, un lien de reinitialisation sera envoye.</div>
	<?php } ?>

	<form id="mjl-password-request" method="post" action="<?php print $php_self; ?>">
		<input type="hidden" name="token" value="<?php print newToken(); ?>">
		<input type="hidden" name="action" value="mjl_build_password_reset">
		<div class="mjl-auth-field">
			<label for="email">Adresse email</label>
			<input type="email" id="email" name="email" autocomplete="email" autofocus>
		</div>
		<div class="mjl-auth-actions">
			<button type="submit" class="mjl-auth-button">Reinitialiser le mot de passe</button>
			<a class="mjl-auth-link" href="<?php print DOL_URL_ROOT; ?>/index.php">Retour a la connexion</a>
		</div>
	</form>
</main>
</div>
</body>
</html>
