<?php

define('NOLOGIN', 1);

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');

$selector = GETPOST('selector', 'alphanohtml');
$action = GETPOST('action', 'aZ09');
$error = '';
$done = false;

if ($action === 'accept') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		$error = 'Le jeton de sécurité est invalide. Veuillez recharger la page.';
	} else {
		$error = mjl_auth_accept_invitation($selector, GETPOST('verifier', 'restricthtml'), GETPOST('newpass1', 'restricthtml'), GETPOST('newpass2', 'restricthtml'));
		$done = ($error === '');
	}
}

$status = mjl_auth_invitation_status($selector);

top_htmlhead('', 'Invitation MJL', 0, 0, array(), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page">
<div class="mjl-auth-shell">
<main class="mjl-auth-panel" aria-labelledby="mjl-invitation-title">
	<div class="mjl-auth-brand">
		<h1 id="mjl-invitation-title">Invitation MJL</h1>
		<p>Définissez votre mot de passe pour accéder à votre espace.</p>
	</div>

	<?php if ($done) { ?>
		<div class="mjl-auth-message" role="status" aria-live="polite">Votre accès est activé. Vous pouvez vous connecter.</div>
		<div class="mjl-auth-actions"><a class="mjl-auth-button" href="<?php print DOL_URL_ROOT; ?>/index.php">Accéder à mon espace</a></div>
	<?php } elseif ($status === 'expired') { ?>
		<div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive">Cette invitation a expiré. Veuillez contacter l’administrateur pour recevoir une nouvelle invitation.</div>
	<?php } elseif ($status === 'revoked') { ?>
		<div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive">Cette invitation a été révoquée. Veuillez contacter l’administrateur.</div>
	<?php } elseif ($status === 'send_failed') { ?>
		<div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive">Cette invitation n’a pas pu être envoyée. Veuillez contacter l’administrateur.</div>
	<?php } elseif ($status === 'accepted') { ?>
		<div class="mjl-auth-message" role="status" aria-live="polite">Cette invitation a déjà été acceptée. Vous pouvez vous connecter.</div>
		<div class="mjl-auth-actions"><a class="mjl-auth-button" href="<?php print DOL_URL_ROOT; ?>/index.php">Connexion</a></div>
	<?php } elseif ($status !== 'valid') { ?>
		<div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive">Cette invitation est invalide. Veuillez contacter l’administrateur.</div>
	<?php } else { ?>
		<?php if ($error !== '') { ?><div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive"><?php print dol_escape_htmltag($error); ?></div><?php } ?>
		<form id="mjl-invitation-accept" method="post" action="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/invitation.php">
			<input type="hidden" name="token" value="<?php print newToken(); ?>">
			<input type="hidden" name="action" value="accept">
			<input type="hidden" name="selector" value="<?php print dol_escape_htmltag($selector); ?>">
			<div class="mjl-auth-field">
				<label for="verifier">Code secret de l’invitation</label>
				<input type="password" id="verifier" name="verifier" autocomplete="one-time-code" required>
			</div>
			<div class="mjl-auth-field">
				<label for="newpass1">Mot de passe</label>
				<input type="password" id="newpass1" name="newpass1" autocomplete="new-password" autofocus>
			</div>
			<div class="mjl-auth-field">
				<label for="newpass2">Confirmer le mot de passe</label>
				<input type="password" id="newpass2" name="newpass2" autocomplete="new-password">
			</div>
			<p class="mjl-auth-help">Le mot de passe doit contenir au moins 10 caractères.</p>
			<div class="mjl-auth-actions">
				<button type="submit" class="mjl-auth-button">Définir mon mot de passe</button>
			</div>
		</form>
		<script src="<?php print DOL_URL_ROOT; ?>/custom/mjlfinancement/js/auth_fragment.js"></script>
	<?php } ?>
</main>
</div>
</body>
</html>
<?php
$db->close();
