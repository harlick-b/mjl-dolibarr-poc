<?php
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
mjl_workspace_require_validation_history_access($user);
llxHeader('', 'Historique des validations');
mjl_navigation_shell_start($user, 'validations');
print '<div class="mjl-workspace">';
print load_fiche_titre('Historique des validations', '', 'check');
global $db, $conf;
$sql = 'SELECT v.ref, e.ref AS expense_ref, v.action, v.from_status, v.to_status, u.login, v.actor_role, v.action_date, v.comment';
$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense';
$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
$sql .= ' WHERE v.entity = '.((int) $conf->entity).' ORDER BY v.action_date DESC, v.rowid DESC LIMIT 200';
$resql = $db->query($sql);
print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
print '<tr class="liste_titre"><th>Ref</th><th>Depense</th><th>Action</th><th>De</th><th>Vers</th><th>Acteur</th><th>Role</th><th>Date</th><th>Commentaire</th></tr>';
if ($resql) while ($obj = $db->fetch_object($resql)) {
	print '<tr class="oddeven"><td>'.dol_escape_htmltag($obj->ref).'</td><td>'.dol_escape_htmltag($obj->expense_ref).'</td><td>'.dol_escape_htmltag($obj->action).'</td><td>'.dol_escape_htmltag($obj->from_status).'</td><td>'.dol_escape_htmltag($obj->to_status).'</td><td>'.dol_escape_htmltag($obj->login).'</td><td>'.dol_escape_htmltag($obj->actor_role).'</td><td>'.dol_escape_htmltag($obj->action_date).'</td><td>'.dol_escape_htmltag($obj->comment).'</td></tr>';
}
print '</table></div>';
if (!$resql) print '<div class="error">'.$db->lasterror().'</div>';
print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();
