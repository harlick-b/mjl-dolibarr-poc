<?php

function mjl_auth_ui_start($title, $heading, $description, $headingId)
{
	top_htmlhead('', $title, 0, 0, array('/custom/mjlfinancement/js/mjl_auth.js'), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
	print '<body class="mjl-auth-page"><div class="mjl-auth-shell">';
	print '<aside class="mjl-auth-sidebar" aria-hidden="true"><span></span><span></span><span></span><span></span></aside>';
	print '<div class="mjl-auth-content"><header class="mjl-auth-header"><a class="mjl-auth-logo" href="'.DOL_URL_ROOT.'/index.php" aria-label="MJL"><span>M</span><strong>MJL</strong></a></header>';
	print '<main class="mjl-auth-main"><section class="mjl-auth-panel" aria-labelledby="'.dol_escape_htmltag($headingId).'">';
	print '<div class="mjl-auth-heading"><h1 id="'.dol_escape_htmltag($headingId).'">'.dol_escape_htmltag($heading).'</h1>';
	if ($description !== '') print '<p>'.dol_escape_htmltag($description).'</p>';
	print '</div>';
}

function mjl_auth_ui_end()
{
	print '</section></main></div></div></body></html>';
}

function mjl_auth_ui_unusable_link()
{
	print '<div class="mjl-auth-message mjl-auth-error" role="alert">Ce lien est invalide ou a expiré.</div>';
	print '<a class="mjl-auth-button" href="'.DOL_URL_ROOT.'/index.php">Retour à la connexion</a>';
}

function mjl_auth_ui_password_form($formId, $actionUrl, array $hidden, $email, $buttonLabel)
{
	print '<form id="'.dol_escape_htmltag($formId).'" method="post" action="'.dol_escape_htmltag($actionUrl).'" data-mjl-auth-form>';
	print '<input type="hidden" name="token" value="'.newToken().'">';
	foreach ($hidden as $name => $value) print '<input type="hidden" name="'.dol_escape_htmltag($name).'" value="'.dol_escape_htmltag($value).'">';
	print '<input type="hidden" id="verifier" name="verifier" value="">';
	print '<div class="mjl-auth-readonly"><small>Adresse email</small><span>'.dol_escape_htmltag($email).'</span></div>';
	print '<div class="mjl-auth-field"><label for="newpass1">Nouveau mot de passe</label><div class="mjl-auth-password">';
	print '<input type="password" id="newpass1" name="newpass1" autocomplete="new-password" data-mjl-new-password required autofocus>';
	print '<button type="button" data-mjl-password-toggle aria-label="Afficher le mot de passe" aria-pressed="false"><span aria-hidden="true">◉</span></button></div></div>';
	print '<div class="mjl-auth-field"><label for="newpass2">Confirmer le mot de passe</label><div class="mjl-auth-password">';
	print '<input type="password" id="newpass2" name="newpass2" autocomplete="new-password" data-mjl-confirm-password required>';
	print '<button type="button" data-mjl-password-toggle aria-label="Afficher la confirmation" aria-pressed="false"><span aria-hidden="true">◉</span></button></div>';
	print '<span class="mjl-auth-field-error" data-mjl-password-mismatch aria-live="polite"></span></div>';
	$rules = array('8 caractères minimum', 'Une majuscule', 'Une minuscule', 'Un chiffre', 'Un caractère spécial');
	print '<ul class="mjl-password-rules" aria-label="Critères du mot de passe">';
	foreach ($rules as $rule) print '<li class="mjl-password-rule" data-mjl-password-rule data-label="'.dol_escape_htmltag($rule).'">'.dol_escape_htmltag($rule).'</li>';
	print '</ul><button type="submit" class="mjl-auth-button" data-mjl-password-submit disabled>'.dol_escape_htmltag($buttonLabel).'</button>';
	print '<a class="mjl-auth-link mjl-auth-return" href="'.DOL_URL_ROOT.'/index.php">Retour à la connexion</a></form>';
	print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/auth_fragment.js"></script>';
}
