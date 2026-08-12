<?php
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
mjl_workspace_require_validation_history_access($user);
llxHeader('', 'Historique des validations');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render(
	'Historique des validations',
	array(
		'breadcrumb' => array(array('label' => 'Supervision / Audit')),
		'description' => 'Consultez les décisions enregistrées sur les dépenses accessibles à votre rôle.',
		'context' => array('label' => 'Accès', 'value' => 'Lecture avancée'),
	)
);
global $db, $conf;
$sql = 'SELECT v.ref, e.ref AS expense_ref, v.action, v.from_status, v.to_status, u.login, v.actor_role, v.action_date, v.comment';
$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity';
$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
$sql .= ' WHERE v.entity = '.((int) $conf->entity);
$sql .= ' AND (';
$sql .= ' NOT EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense any_e WHERE any_e.rowid = v.fk_expense)';
$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense ok_e';
$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention ok_c ON ok_c.rowid = ok_e.fk_convention AND ok_c.entity = ok_e.entity';
$sql .= ' INNER JOIN '.$db->prefix().'projet ok_p ON ok_p.rowid = ok_e.fk_project AND ok_p.entity = ok_e.entity AND ok_p.rowid = ok_c.fk_project AND ok_p.fk_soc = ok_c.fk_soc';
$sql .= ' INNER JOIN '.$db->prefix().'societe ok_s ON ok_s.rowid = ok_p.fk_soc AND ok_s.entity = ok_p.entity';
$sql .= ' WHERE ok_e.rowid = v.fk_expense AND ok_e.entity = v.entity)';
$sql .= ')';
$sql .= ' ORDER BY v.action_date DESC, v.rowid DESC LIMIT 200';
$resql = $db->query($sql);
if (!$resql) {
	print mjl_ui_system_state('unavailable', 'Historique indisponible', 'L’historique des validations ne peut pas être chargé pour le moment.');
	mjl_ui_log_error('database', array('route' => 'validations', 'action' => 'list', 'entity' => (int) $conf->entity, 'user_id' => (int) $user->id), $db->lasterror());
} else {
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Réf.</th><th>Dépense</th><th>Action</th><th>De</th><th>Vers</th><th>Acteur</th><th>Rôle</th><th>Date</th><th>Commentaire</th></tr>';
	while ($obj = $db->fetch_object($resql)) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($obj->ref).'</td><td>'.dol_escape_htmltag($obj->expense_ref).'</td><td>'.dol_escape_htmltag($obj->action).'</td><td>'.dol_escape_htmltag($obj->from_status).'</td><td>'.dol_escape_htmltag($obj->to_status).'</td><td>'.dol_escape_htmltag($obj->login).'</td><td>'.dol_escape_htmltag($obj->actor_role).'</td><td>'.dol_escape_htmltag($obj->action_date).'</td><td>'.dol_escape_htmltag($obj->comment).'</td></tr>';
	}
	print '</table></div>';
}
print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();
