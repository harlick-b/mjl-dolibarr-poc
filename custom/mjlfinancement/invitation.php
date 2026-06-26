<?php

define('NOLOGIN', 1);

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

$token = GETPOST('invite', 'restricthtml');
$action = GETPOST('action', 'aZ09');
$error = '';
$done = false;

if ($action === 'accept') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		$error = 'Le jeton de securite est invalide. Veuillez recharger la page.';
	} else {
		$error = mjl_auth_accept_invitation($token, GETPOST('newpass1', 'restricthtml'), GETPOST('newpass2', 'restricthtml'));
		$done = ($error === '');
	}
}

$status = mjl_auth_invitation_status($token);

top_htmlhead('', 'Invitation MJL', 0, 0, array(), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page">
<div class="mjl-auth-shell">
<main class="mjl-auth-panel" aria-labelledby="mjl-invitation-title">
	<div class="mjl-auth-brand">
		<h1 id="mjl-invitation-title">Invitation MJL</h1>
		<p>Definissez votre mot de passe pour acceder a votre espace.</p>
	</div>

	<?php if ($done) { ?>
		<div class="mjl-auth-message">Votre acces est active. Vous pouvez vous connecter.</div>
		<div class="mjl-auth-actions"><a class="mjl-auth-button" href="<?php print DOL_URL_ROOT; ?>/index.php">Acceder a mon espace</a></div>
	<?php } elseif ($status === 'expired') { ?>
		<div class="mjl-auth-message mjl-auth-error">Cette invitation a expire. Veuillez contacter l administrateur pour recevoir une nouvelle invitation.</div>
	<?php } elseif ($status === 'revoked') { ?>
		<div class="mjl-auth-message mjl-auth-error">Cette invitation a ete revoquee. Veuillez contacter l administrateur.</div>
	<?php } elseif ($status === 'send_failed') { ?>
		<div class="mjl-auth-message mjl-auth-error">Cette invitation n a pas pu etre envoyee. Veuillez contacter l administrateur.</div>
	<?php } elseif ($status === 'accepted') { ?>
		<div class="mjl-auth-message">Cette invitation a deja ete acceptee. Vous pouvez vous connecter.</div>
		<div class="mjl-auth-actions"><a class="mjl-auth-button" href="<?php print DOL_URL_ROOT; ?>/index.php">Connexion</a></div>
	<?php } elseif ($status !== 'valid') { ?>
		<div class="mjl-auth-message mjl-auth-error">Cette invitation est invalide. Veuillez contacter l administrateur.</div>
	<?php } else { ?>
		<?php if ($error !== '') { ?><div class="mjl-auth-message mjl-auth-error"><?php print dol_escape_htmltag($error); ?></div><?php } ?>
		<form id="mjl-invitation-accept" method="post" action="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/invitation.php">
			<input type="hidden" name="token" value="<?php print newToken(); ?>">
			<input type="hidden" name="action" value="accept">
			<input type="hidden" name="invite" value="<?php print dol_escape_htmltag($token); ?>">
			<div class="mjl-auth-field">
				<label for="newpass1">Mot de passe</label>
				<input type="password" id="newpass1" name="newpass1" autocomplete="new-password" autofocus>
			</div>
			<div class="mjl-auth-field">
				<label for="newpass2">Confirmer le mot de passe</label>
				<input type="password" id="newpass2" name="newpass2" autocomplete="new-password">
			</div>
			<p class="mjl-auth-help">Le mot de passe doit contenir au moins 10 caracteres.</p>
			<div class="mjl-auth-actions">
				<button type="submit" class="mjl-auth-button">Definir mon mot de passe</button>
			</div>
		</form>
	<?php } ?>
</main>
</div>
</body>
</html>
<?php
$db->close();
