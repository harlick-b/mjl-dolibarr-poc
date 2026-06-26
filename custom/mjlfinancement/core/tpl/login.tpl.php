<?php
if (empty($conf) || !is_object($conf)) {
	print "Error, template page can't be called as URL";
	exit(1);
}

require_once DOL_DOCUMENT_ROOT.'/core/lib/functions2.lib.php';

$php_self = empty($php_self) ? dol_escape_htmltag($_SERVER['PHP_SELF']) : $php_self;
if (!empty($_SERVER['QUERY_STRING']) && dol_escape_htmltag($_SERVER['QUERY_STRING'])) {
	$php_self .= '?'.dol_escape_htmltag($_SERVER['QUERY_STRING']);
}
$php_self = preg_replace('/(\?|&amp;|&)actionlogin=[^&]+/', '\1', $php_self);
$php_self = preg_replace('/(&amp;)+/', '&amp;', $php_self);

top_htmlhead('', 'Connexion @ '.$titletruedolibarrversion, 0, 0, array('/core/js/dst.js'), array('/custom/mjlfinancement/css/mjl_auth.css.php'), 1, 1);
?>
<body class="mjl-auth-page">
<div class="mjl-auth-shell">
<main class="mjl-auth-panel" aria-labelledby="mjl-login-title">
	<div class="mjl-auth-brand">
		<h1 id="mjl-login-title">MJL Financement</h1>
		<p>Espace de suivi administratif et financier des projets a financement externe.</p>
	</div>

	<?php if (!empty($dol_loginmesg)) { ?>
		<div class="mjl-auth-message mjl-auth-error"><?php print dol_escape_htmltag(strip_tags($dol_loginmesg)); ?></div>
	<?php } ?>

	<form id="login" name="login" method="post" action="<?php print $php_self; ?>">
		<input type="hidden" name="token" value="<?php print newToken(); ?>">
		<input type="hidden" name="actionlogin" id="actionlogin" value="login">
		<input type="hidden" name="loginfunction" id="loginfunction" value="loginfunction">
		<input type="hidden" name="backtopage" value="<?php print dol_escape_htmltag(GETPOST('backtopage')); ?>">
		<input type="hidden" name="tz" id="tz" value="">
		<input type="hidden" name="tz_string" id="tz_string" value="">
		<input type="hidden" name="dst_observed" id="dst_observed" value="">
		<input type="hidden" name="dst_first" id="dst_first" value="">
		<input type="hidden" name="dst_second" id="dst_second" value="">
		<input type="hidden" name="screenwidth" id="screenwidth" value="">
		<input type="hidden" name="screenheight" id="screenheight" value="">
		<input type="hidden" name="dol_hide_topmenu" id="dol_hide_topmenu" value="<?php print (int) $dol_hide_topmenu; ?>">
		<input type="hidden" name="dol_hide_leftmenu" id="dol_hide_leftmenu" value="<?php print (int) $dol_hide_leftmenu; ?>">
		<input type="hidden" name="dol_optimize_smallscreen" id="dol_optimize_smallscreen" value="<?php print (int) $dol_optimize_smallscreen; ?>">
		<input type="hidden" name="dol_no_mouse_hover" id="dol_no_mouse_hover" value="<?php print (int) $dol_no_mouse_hover; ?>">
		<input type="hidden" name="dol_use_jmobile" id="dol_use_jmobile" value="<?php print (int) $dol_use_jmobile; ?>">

		<div class="mjl-auth-field">
			<label for="username">Identifiant</label>
			<input type="text" id="username" name="username" value="<?php print dol_escape_htmltag($login); ?>" autocomplete="username" autofocus>
		</div>
		<div class="mjl-auth-field">
			<label for="password">Mot de passe</label>
			<input type="password" id="password" name="password" value="" autocomplete="current-password">
		</div>
		<?php
		if (!empty($morelogincontent)) {
			print is_array($morelogincontent) ? implode('', $morelogincontent) : $morelogincontent;
		}
		?>
		<div class="mjl-auth-actions">
			<button type="submit" class="mjl-auth-button">Connexion</button>
			<a class="mjl-auth-link" href="<?php print DOL_URL_ROOT; ?>/user/passwordforgotten.php">Mot de passe oublie</a>
		</div>
	</form>
</main>
</div>
<?php
if (!empty($moreloginextracontent)) {
	print $moreloginextracontent;
}
?>
</body>
</html>
