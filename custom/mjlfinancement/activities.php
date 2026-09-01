<?php

define('NOREDIRECTBYMAINTOLOGIN', 1);
http_response_code(403);
if ($_SERVER['REQUEST_METHOD'] === 'POST' || isset($_GET['action']) || isset($_POST['action'])) {
	header('Content-Type: text/plain; charset=UTF-8');
	print 'Forbidden';
	exit;
}
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';

if (!mjl_activity_access_can_enter_list($user)) {
	http_response_code(403);
	header('Content-Type: text/plain; charset=UTF-8');
	print 'Forbidden';
	exit;
}
http_response_code(200);

llxHeader('', 'Activités');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render('Activités', array(
	'breadcrumb' => array(array('label' => 'Consultation temporaire')),
	'description' => 'Consultation en lecture seule pendant la mise en place du modèle cible.',
	'context' => array('label' => 'Accès', 'value' => 'Supervision et validation'),
));
$activityModel = new MjlActivity($db);
$activities = $activityModel->fetchReadProjection($user, 200);
if ($activities === false) {
	http_response_code(503);
	print mjl_ui_system_state('unavailable', 'Activités indisponibles', 'La consultation ne peut pas être chargée pour le moment.');
} elseif (count($activities) === 0) {
	print mjl_ui_system_state('empty', 'Aucune Activité', 'Aucune activité n’est enregistrée dans l’entité active.');
} else {
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Référence</th><th>Activité</th><th>Projet</th><th>Statut</th></tr>';
	foreach ($activities as $row) {
		$status = mjl_ui_activity_status($row->validation_status);
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($row->ref).'</td><td>'.dol_escape_htmltag($row->name).'</td><td>'.dol_escape_htmltag(trim($row->project_ref.' — '.$row->project_title)).'</td><td>'.mjl_ui_status_badge($status).'</td></tr>';
	}
	print '</table></div>';
}
print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();
