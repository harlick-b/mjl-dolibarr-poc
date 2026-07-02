<?php
define('NOLOGIN', 1);
require '../../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

header('Content-Type: application/javascript; charset=UTF-8');

if ((empty($user) || empty($user->id)) && !empty($_SESSION['dol_login'])) {
	$sessionUser = new User($db);
	if ($sessionUser->fetch(0, $_SESSION['dol_login']) > 0) {
		$user = $sessionUser;
	}
}

$enabled = !empty($user) && !empty($user->id) && empty($user->admin) && mjl_workspace_user_can_read($user);
?>
(function () {
	'use strict';
	var enabled = <?php print $enabled ? 'true' : 'false'; ?>;
	if (!enabled) return;

	var path = window.location.pathname || '';
	var root = <?php print json_encode(rtrim((string) DOL_URL_ROOT, '/')); ?>;
	if (root && path.indexOf(root + '/') === 0) {
		path = path.substring(root.length);
	}
	path = '/' + path.replace(/^\/+/, '');

	if (path.indexOf('/custom/mjlfinancement/') === 0 || path === '/index.php') {
		return;
	}

	var prefixes = [
		'/core/tools.php',
		'/ecm',
		'/expensereport',
		'/hrm',
		'/holiday',
		'/modulebuilder',
		'/api',
		'/commande',
		'/fourn',
		'/compta',
		'/accountancy',
		'/banque',
		'/tax',
		'/admin/tools',
		'/admin/system',
		'/admin/dict',
		'/admin/modules.php'
	];

	prefixes.push('/societe', '/comm', '/projet');

	var denied = prefixes.some(function (prefix) {
		return path === prefix || path.indexOf(prefix.replace(/\/$/, '') + '/') === 0;
	});
	if (denied) {
		window.location.replace(root + '/custom/mjlfinancement/index.php');
	}
}());
