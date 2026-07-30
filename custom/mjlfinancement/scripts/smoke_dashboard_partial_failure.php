<?php

define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';

$realDb = $db;
$db = new class {
	public function query($sql) { return false; }
	public function lasterror() { return 'simulated dashboard source failure'; }
	public function prefix() { return 'llx_'; }
};
$failed = mjl_dashboard_capture(function () { return mjl_dashboard_scalar('SELECT 1'); });
$workspaceFailed = mjl_workspace_capture(function () { return mjl_workspace_scalar('SELECT 1'); });
$workspaceDocumentFailed = mjl_workspace_capture(function () use ($user) { return mjl_workspace_own_missing_expense_document_count($user); });
$alertsFailed = mjl_dashboard_capture(function () { return mjl_alerts_fetch_rows('SELECT 1'); });
$db = $realDb;
$successful = mjl_dashboard_capture(function () {
	return 7;
});

ob_start();
mjl_dashboard_render_card_section('Test local', 'Régions indépendantes.', array(
	array('label' => 'Source indisponible', 'value' => $failed['value'], 'available' => $failed['available'], 'context' => 'Test', 'href' => '/custom/mjlfinancement/index.php', 'action' => 'Ouvrir'),
	array('label' => 'Source disponible', 'value' => $successful['value'], 'available' => $successful['available'], 'context' => 'Test', 'href' => '/custom/mjlfinancement/index.php', 'action' => 'Ouvrir'),
));
$html = ob_get_clean();

if ($failed['available'] || $workspaceFailed['available'] || $workspaceDocumentFailed['available'] || $alertsFailed['available'] || !$successful['available'] || strpos($html, 'Indisponible') === false || strpos($html, '>7<') === false) {
	fwrite(STDERR, 'Dashboard partial failure smoke failed.'.PHP_EOL);
	exit(1);
}

print 'MJL dashboard partial failure smoke: OK'.PHP_EOL;
