<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

mjl_workspace_require_advanced_traceability_access($user, 'workflowaction');

$langs->load('mjlfinancement@mjlfinancement');

$filters = array(
	'object_type' => GETPOST('object_type', 'alphanohtml'),
	'action' => GETPOST('workflow_action', 'alphanohtml'),
	'actor_role' => GETPOST('actor_role', 'alphanohtml'),
	'date_start' => GETPOST('date_start', 'alphanohtml'),
	'date_end' => GETPOST('date_end', 'alphanohtml'),
);

llxHeader('', 'Actions workflow MJL');
mjl_navigation_shell_start($user, 'workflowactions');
print '<div class="mjl-workspace">';
print load_fiche_titre('Actions workflow MJL', '', 'check');

mjl_workflowactions_filter_form($filters);
mjl_workflowactions_list($filters);

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_workflowactions_filter_form($filters)
{
	print '<form method="GET" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Objet</th><th>Action</th><th>Role acteur</th><th>Date debut</th><th>Date fin</th><th></th></tr>';
	print '<tr class="oddeven">';
	print '<td>'.mjl_workflowactions_select('object_type', mjl_workflowactions_distinct_options('object_type'), $filters['object_type'], 'Tous').'</td>';
	print '<td>'.mjl_workflowactions_select('workflow_action', mjl_workflowactions_distinct_options('action'), $filters['action'], 'Toutes').'</td>';
	print '<td>'.mjl_workflowactions_select('actor_role', mjl_workflowactions_distinct_options('actor_role'), $filters['actor_role'], 'Tous').'</td>';
	print '<td><input type="date" name="date_start" value="'.dol_escape_htmltag($filters['date_start']).'"></td>';
	print '<td><input type="date" name="date_end" value="'.dol_escape_htmltag($filters['date_end']).'"></td>';
	print '<td><input class="button" type="submit" value="Afficher"></td>';
	print '</tr></table></div></form><br>';
}

function mjl_workflowactions_list($filters)
{
	global $db, $conf;

	$where = array('w.entity = '.((int) $conf->entity));
	if ($filters['object_type'] !== '') {
		$where[] = "w.object_type = '".$db->escape($filters['object_type'])."'";
	}
	if ($filters['action'] !== '') {
		$where[] = "w.action = '".$db->escape($filters['action'])."'";
	}
	if ($filters['actor_role'] !== '') {
		$where[] = "w.actor_role = '".$db->escape($filters['actor_role'])."'";
	}
	if ($filters['date_start'] !== '') {
		$where[] = "w.action_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	}
	if ($filters['date_end'] !== '') {
		$where[] = "w.action_date <= '".$db->escape($filters['date_end'])." 23:59:59'";
	}

	$sql = 'SELECT w.ref, w.object_type, w.object_id,';
	$sql .= ' CASE WHEN w.object_type = \'mjlfinancement_activity\' THEN a.ref WHEN w.object_type = \'mjlfinancement_convention\' THEN c.ref WHEN w.object_type = \'mjlfinancement_budget_line\' THEN bl.ref WHEN w.object_type = \'mjlfinancement_fund_receipt\' THEN fr.ref ELSE NULL END AS object_ref,';
	$sql .= ' w.action, w.from_status, w.to_status, u.login, w.actor_role, w.action_date, w.reason, w.comment, w.changes_json';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = w.object_id AND w.object_type = \'mjlfinancement_convention\' AND c.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = w.object_id AND w.object_type = \'mjlfinancement_budget_line\' AND bl.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = w.object_id AND w.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY w.action_date DESC, w.rowid DESC LIMIT 200';

	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return;
	}

	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Ref</th><th>Objet</th><th>ID</th><th>Ref objet</th><th>Action</th><th>De</th><th>Vers</th><th>Acteur</th><th>Role</th><th>Date</th><th>Motif</th><th>Commentaire</th><th>Changements</th></tr>';
	while ($obj = $db->fetch_object($resql)) {
		print '<tr class="oddeven">';
		print '<td>'.dol_escape_htmltag($obj->ref).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_workflowactions_object_type_label($obj->object_type)).'</td>';
		print '<td>'.((int) $obj->object_id).'</td>';
		print '<td>'.dol_escape_htmltag($obj->object_ref).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_workflowactions_action_label($obj->action)).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_workflowactions_status_label($obj->from_status)).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_workflowactions_status_label($obj->to_status)).'</td>';
		print '<td>'.dol_escape_htmltag($obj->login).'</td>';
		print '<td>'.dol_escape_htmltag($obj->actor_role).'</td>';
		print '<td>'.dol_escape_htmltag($obj->action_date).'</td>';
		print '<td>'.dol_escape_htmltag($obj->reason).'</td>';
		print '<td>'.dol_escape_htmltag($obj->comment).'</td>';
		print '<td>'.dol_escape_htmltag($obj->changes_json).'</td>';
		print '</tr>';
	}
	print '</table></div>';
}

function mjl_workflowactions_object_type_label($objectType)
{
	$map = array(
		'mjlfinancement_activity' => 'Activite',
		'mjlfinancement_convention' => 'Convention',
		'mjlfinancement_budget_line' => 'Ligne budgetaire',
		'mjlfinancement_fund_receipt' => 'Reception de fonds',
	);
	return isset($map[(string) $objectType]) ? $map[(string) $objectType] : (string) $objectType;
}

function mjl_workflowactions_action_label($action)
{
	$map = array(
		'created' => 'Creation',
		'field_changed' => 'Modification',
		'document_uploaded' => 'Document ajoute',
		'proof_uploaded' => 'Preuve ajoutee',
		'unsafe_edit_rejected' => 'Modification refusee',
		'received' => 'Reception',
		'not_received' => 'Non-reception',
		'submitted' => 'Soumission',
		'validated' => 'Validation',
		'rejected' => 'Rejet',
		'corrected' => 'Correction',
		'correction_requested' => 'Correction demandee',
		'deleted' => 'Suppression',
		'activated' => 'Activation',
		'closed' => 'Cloture',
	);
	return isset($map[(string) $action]) ? $map[(string) $action] : (string) $action;
}

function mjl_workflowactions_status_label($status)
{
	$map = array(
		'draft' => 'Brouillon',
		'active' => 'Active',
		'closed' => 'Cloturee',
		'deleted' => 'Supprimee',
		'submitted' => 'Soumise',
		'validated' => 'Validee',
		'rejected' => 'Rejetee',
		'corrected' => 'Corrigee',
		'correction_requested' => 'Correction demandee',
		'completed' => 'Terminee',
		'cancelled' => 'Annulee',
		'received' => 'Recu',
		'not_received' => 'Non recu',
	);
	return isset($map[(string) $status]) ? $map[(string) $status] : (string) $status;
}

function mjl_workflowactions_distinct_options($column)
{
	global $db, $conf;

	if (!in_array($column, array('object_type', 'action', 'actor_role'), true)) {
		return array();
	}

	$sql = 'SELECT DISTINCT '.$column.' AS value FROM '.$db->prefix().'mjlfinancement_workflow_action';
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND '.$column.' IS NOT NULL AND '.$column." <> ''";
	$sql .= ' ORDER BY '.$column;
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}

	$options = array();
	while ($obj = $db->fetch_object($resql)) {
		$options[(string) $obj->value] = (string) $obj->value;
	}
	return $options;
}

function mjl_workflowactions_select($name, $options, $selected, $emptyLabel)
{
	$html = '<select name="'.dol_escape_htmltag($name).'">';
	$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	foreach ($options as $value => $label) {
		$html .= '<option value="'.dol_escape_htmltag($value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	$html .= '</select>';
	return $html;
}
