<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';

mjl_activity_access_require_read($user, (int) $conf->entity);
if ($_SERVER['REQUEST_METHOD'] === 'POST' || GETPOST('action', 'aZ09') !== '') {
	http_response_code(403);
	accessforbidden();
}

llxHeader('', 'Activités');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render('Activités', array(
	'breadcrumb' => array(array('label' => 'Consultation temporaire')),
	'description' => 'Consultation en lecture seule pendant la mise en place du modèle cible.',
	'context' => array('label' => 'Accès', 'value' => 'Supervision et validation'),
));
$sql = 'SELECT a.rowid, a.ref, a.label, a.status, p.ref AS project_ref, p.title AS project_title';
$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
$sql .= ' INNER JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
$sql .= ' WHERE a.entity = '.((int) $conf->entity).' ORDER BY a.rowid DESC LIMIT 200';
$resql = $db->query($sql);
if (!$resql) {
	print mjl_ui_system_state('unavailable', 'Activités indisponibles', 'La consultation ne peut pas être chargée pour le moment.');
} elseif ($db->num_rows($resql) === 0) {
	print mjl_ui_system_state('empty', 'Aucune Activité', 'Le modèle cible des Activités sera introduit par RST-005.');
} else {
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Référence</th><th>Activité</th><th>Projet</th><th>Statut technique</th></tr>';
	while ($row = $db->fetch_object($resql)) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($row->ref).'</td><td>'.dol_escape_htmltag($row->label).'</td><td>'.dol_escape_htmltag(trim($row->project_ref.' — '.$row->project_title)).'</td><td>'.((int) $row->status).'</td></tr>';
	}
	print '</table></div>';
}
print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();
