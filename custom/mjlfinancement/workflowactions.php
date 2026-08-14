<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';

if (!mjl_navigation_policy_allows($user, 'audit_read')) { http_response_code(403); accessforbidden(); }
$objectType = GETPOST('object_type', 'alphanohtml');
$action = GETPOST('audit_action', 'alphanohtml');
llxHeader('', 'Audit');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render('Audit', array(
	'breadcrumb' => array(array('label' => 'Contrôle')),
	'description' => 'Événements immuables enregistrés pour l’entité active.',
	'context' => array('label' => 'Accès', 'value' => 'Validateur et Admin'),
));
print '<form method="GET"><div class="div-table-responsive-no-min"><table class="noborder centpercent"><tr class="liste_titre"><th>Objet</th><th>Action</th><th></th></tr><tr class="oddeven">';
print '<td><input name="object_type" value="'.dol_escape_htmltag($objectType).'"></td><td><input name="audit_action" value="'.dol_escape_htmltag($action).'"></td><td><button class="button" type="submit">Filtrer</button></td></tr></table></div></form><br>';
$where = array('entity = '.((int) $conf->entity));
if ($objectType !== '') $where[] = "object_type = '".$db->escape($objectType)."'";
if ($action !== '') $where[] = "action = '".$db->escape($action)."'";
$sql = 'SELECT rowid, object_type, object_id, object_ref, action, state_before, state_after, actor_name_snapshot, actor_role_snapshot, event_date, reason, result';
$sql .= ' FROM '.$db->prefix().'mjlfinancement_audit_event WHERE '.implode(' AND ', $where).' ORDER BY event_date DESC, rowid DESC LIMIT 200';
$resql = $db->query($sql);
if (!$resql) {
	print mjl_ui_system_state('unavailable', 'Audit indisponible', 'Les événements ne peuvent pas être chargés.');
} elseif ($db->num_rows($resql) === 0) {
	print mjl_ui_system_state('empty', 'Aucun événement', 'Aucun événement ne correspond aux filtres.');
} else {
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent"><tr class="liste_titre"><th>ID</th><th>Objet</th><th>Action</th><th>État</th><th>Acteur</th><th>Rôle</th><th>Date</th><th>Résultat</th><th>Motif</th></tr>';
	while ($row = $db->fetch_object($resql)) {
		$object = trim($row->object_type.' '.($row->object_ref !== null ? $row->object_ref : $row->object_id));
		$state = trim((string) $row->state_before).' → '.trim((string) $row->state_after);
		print '<tr class="oddeven"><td>'.((int) $row->rowid).'</td><td>'.dol_escape_htmltag($object).'</td><td>'.dol_escape_htmltag($row->action).'</td><td>'.dol_escape_htmltag($state).'</td><td>'.dol_escape_htmltag($row->actor_name_snapshot).'</td><td>'.dol_escape_htmltag(mjl_scope_role_label($row->actor_role_snapshot)).'</td><td>'.dol_escape_htmltag($row->event_date).'</td><td>'.dol_escape_htmltag($row->result).'</td><td>'.dol_escape_htmltag($row->reason).'</td></tr>';
	}
	print '</table></div>';
}
print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();
