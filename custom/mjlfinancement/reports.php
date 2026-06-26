<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reporting.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_csv_export.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

mjl_workspace_require_supervision_access($user);

$langs->load('mjlfinancement@mjlfinancement');

$report = GETPOST('report', 'alpha') ?: 'project_summary';
$action = GETPOST('action', 'alpha');
$filters = array(
	'project_id' => GETPOSTINT('project_id'),
	'convention_id' => GETPOSTINT('convention_id'),
	'status' => GETPOST('status', 'intcomma'),
	'date_start' => GETPOST('date_start', 'alphanohtml'),
	'date_end' => GETPOST('date_end', 'alphanohtml'),
);

if ($action === 'export_csv') {
	if (empty($user->admin) && !$user->hasRight('mjlfinancement', 'export', 'write')) {
		accessforbidden();
	}
	$def = mjl_reports_def($report);
	mjl_csv_export_output(mjl_csv_export_filename($def['slug']), $def['headers'], mjl_reports_rows($report, $filters));
	exit;
}

llxHeader('', 'Rapports MJL');
print load_fiche_titre('Rapports MJL', '', 'generic');

print '<form method="GET" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
print '<tr class="liste_titre"><th>Rapport</th><th>Projet</th><th>Convention</th><th>Statut</th><th>Date debut</th><th>Date fin</th><th></th></tr>';
print '<tr class="oddeven">';
print '<td><select name="report">';
foreach (mjl_reports_defs() as $key => $def) {
	print '<option value="'.$key.'"'.($report === $key ? ' selected' : '').'>'.dol_escape_htmltag($def['label']).'</option>';
}
print '</select></td>';
print '<td>'.mjl_reports_select('project_id', mjl_reports_project_options(), $filters['project_id'], 'Tous').'</td>';
print '<td>'.mjl_reports_select('convention_id', mjl_reports_convention_options(), $filters['convention_id'], 'Toutes').'</td>';
print '<td><input type="number" name="status" value="'.dol_escape_htmltag($filters['status']).'"></td>';
print '<td><input type="date" name="date_start" value="'.dol_escape_htmltag($filters['date_start']).'"></td>';
print '<td><input type="date" name="date_end" value="'.dol_escape_htmltag($filters['date_end']).'"></td>';
print '<td><input class="button" type="submit" value="Afficher"> ';
if (!empty($user->admin) || $user->hasRight('mjlfinancement', 'export', 'write')) {
	print '<button class="button" type="submit" name="action" value="export_csv">CSV</button>';
}
print '</td></tr></table></div></form>';

mjl_reports_render($report, $filters);

llxFooter();
$db->close();

function mjl_reports_defs()
{
	return array(
		'project_summary' => array(
			'label' => 'Synthese financiere par projet',
			'slug' => 'synthese-projet',
			'headers' => array('project_ref' => 'Projet', 'project_title' => 'Titre projet', 'budget_total' => 'Budget total', 'funds_received' => 'Fonds recus', 'total_expenses' => 'Depenses totales', 'validated_expenses' => 'Depenses validees', 'pending_expenses' => 'Depenses soumises'),
		),
		'convention_budget' => array(
			'label' => 'Execution budgetaire par convention',
			'slug' => 'budget-convention',
			'headers' => array('ref' => 'Ligne budgetaire', 'label' => 'Libelle', 'initial_budget' => 'Budget initial', 'revised_budget' => 'Budget revise', 'status' => 'Statut', 'validated_expenses' => 'Depenses validees', 'submitted_expenses' => 'Depenses soumises', 'remaining_amount' => 'Restant'),
		),
		'expense_documents' => array(
			'label' => 'Liste des depenses avec pieces justificatives',
			'slug' => 'depenses-pieces',
			'headers' => array('expense_ref' => 'Depense', 'expense_date' => 'Date depense', 'budget_line' => 'Ligne budgetaire', 'amount' => 'Montant', 'status' => 'Statut', 'document_present' => 'Piece presente', 'supporting_document' => 'Piece justificative', 'validator' => 'Validateur', 'correction_reason' => 'Motif correction'),
		),
		'activities' => array(
			'label' => 'Suivi des activites',
			'slug' => 'suivi-activites',
			'headers' => array('partner' => 'Partenaire', 'project' => 'Projet', 'envelope' => 'Mission / enveloppe de financement', 'activity_ref' => 'Référence activité', 'activity_title' => 'Titre activité', 'date_start' => 'Date de début', 'date_end' => 'Date de fin', 'status_label' => 'Statut', 'physical_progress_percent' => 'Taux d’exécution physique', 'performance_index' => 'Indice de performance', 'current_reviewer' => 'Responsable actuel', 'deadline_alert' => 'Alerte échéance', 'allocated_budget' => 'Budget alloué', 'validated_expenses' => 'Dépenses validées', 'remaining_budget' => 'Budget restant'),
		),
		'workflow_actions' => array(
			'label' => 'Historique decisions / audit',
			'slug' => 'historique-decisions-audit',
			'headers' => array('object_type_label' => 'Type d’objet', 'object_ref' => 'Référence objet', 'decision' => 'Action / décision', 'from_status' => 'Ancien statut', 'to_status' => 'Nouveau statut', 'previous_value' => 'Ancienne valeur', 'new_value' => 'Nouvelle valeur', 'actor' => 'Acteur', 'actor_role' => 'Rôle', 'action_date' => 'Date', 'comment' => 'Commentaire / motif'),
		),
		'expenses_validations' => array(
			'label' => 'Suivi des depenses',
			'slug' => 'suivi-depenses',
			'headers' => array('partner' => 'Partenaire', 'project' => 'Projet', 'envelope' => 'Mission / enveloppe de financement', 'activity' => 'Activité', 'expense_ref' => 'Référence dépense', 'expense_date' => 'Date dépense', 'amount' => 'Montant', 'expense_status' => 'Statut', 'document_present' => 'Pièce justificative présente', 'creator' => 'Créée par', 'validator' => 'Validée par', 'validation_date' => 'Date de validation', 'correction_reason' => 'Motif de correction'),
		),
		'exchanges' => array(
			'label' => 'Export echanges',
			'slug' => 'echanges',
			'headers' => array('ref' => 'Ref echange', 'object_type' => 'Type objet', 'object_id' => 'ID objet', 'activity_ref' => 'Activite', 'exchange_date' => 'Date echange', 'login' => 'Acteur', 'actor_role' => 'Role acteur', 'channel' => 'Canal', 'subject' => 'Sujet', 'message' => 'Message'),
		),
		'dpaf_summary' => array(
			'label' => 'Export synthese DPAF',
			'slug' => 'synthese-dpaf',
			'headers' => array('convention_ref' => 'Convention', 'budget_revise' => 'Budget revise', 'depenses_validees' => 'Depenses validees', 'depenses_soumises' => 'Depenses soumises', 'fonds_recus' => 'Fonds recus', 'activites_en_revue' => 'Activites en revue', 'depenses_en_revue' => 'Depenses en revue'),
		),
	);
}

function mjl_reports_def($report)
{
	$defs = mjl_reports_defs();
	return isset($defs[$report]) ? $defs[$report] : $defs['project_summary'];
}

function mjl_reports_rows($report, $filters)
{
	if ($report === 'project_summary') {
		if (empty($filters['project_id'])) return array();
		$row = mjl_report_project_summary($filters['project_id'], $filters);
		return empty($row) ? array() : array($row);
	}
	if ($report === 'convention_budget') {
		if (empty($filters['convention_id'])) return array();
		return mjl_report_convention_budget($filters['convention_id'], $filters);
	}
	if ($report === 'expense_documents') {
		return mjl_report_expense_documents($filters);
	}
	if ($report === 'activities') {
		return mjl_reports_activities_rows($filters);
	}
	if ($report === 'workflow_actions') {
		return mjl_reports_workflow_rows($filters);
	}
	if ($report === 'expenses_validations') {
		return mjl_reports_expenses_validations_rows($filters);
	}
	if ($report === 'exchanges') {
		return mjl_reports_exchange_rows($filters);
	}
	if ($report === 'dpaf_summary') {
		return mjl_reports_dpaf_rows($filters);
	}
	return array();
}

function mjl_reports_render($report, $filters)
{
	$def = mjl_reports_def($report);
	$rows = mjl_reports_rows($report, $filters);
	print '<br><div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre">';
	foreach ($def['headers'] as $header) print '<th>'.dol_escape_htmltag($header).'</th>';
	print '</tr>';
	if (empty($rows)) {
		print '<tr class="oddeven"><td colspan="'.count($def['headers']).'">Aucune donnee</td></tr></table></div>';
		return;
	}
	foreach ($rows as $row) {
		print '<tr class="oddeven">';
		foreach (array_keys($def['headers']) as $key) print '<td>'.dol_escape_htmltag(isset($row[$key]) ? $row[$key] : '').'</td>';
		print '</tr>';
	}
	print '</table></div>';
}

function mjl_reports_activities_rows($filters)
{
	global $db, $conf;

	$where = array('a.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'a.fk_project = '.((int) $filters['project_id']);
	if (!empty($filters['convention_id'])) $where[] = 'a.fk_convention = '.((int) $filters['convention_id']);
	if ($filters['status'] !== '') $where[] = 'a.status = '.((int) $filters['status']);
	if ($filters['date_start'] !== '') $where[] = "a.date_start >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $where[] = "a.date_end <= '".$db->escape($filters['date_end'])."'";

	$sql = 'SELECT s.nom AS partner, p.ref AS project, c.ref AS envelope, a.ref AS activity_ref, a.label AS activity_title, a.date_start, a.date_end, a.status, COALESCE(t.progress, 0) AS physical_progress_percent,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = a.entity AND bl.fk_mjl_activity = a.rowid), 0) AS allocated_budget,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = a.entity AND e.fk_mjl_activity = a.rowid AND e.status = '.MjlExpense::STATUS_VALIDATED.'), 0) AS validated_expenses';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet_task t ON t.rowid = a.fk_task AND t.entity = a.entity';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY a.date_end ASC, a.ref';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['status_label'] = mjl_reports_activity_status_label($row['status']);
		$row['deadline_alert'] = mjl_reports_deadline_alert($row['date_end'], $row['status']);
		$row['performance_index'] = mjl_reports_activity_performance_index($row['date_end'], $row['status'], $row['physical_progress_percent']);
		$row['current_reviewer'] = '';
		$row['remaining_budget'] = (float) $row['allocated_budget'] - (float) $row['validated_expenses'];
	}
	unset($row);
	return $rows;
}

function mjl_reports_workflow_rows($filters)
{
	global $db, $conf;

	$where = array('w.entity = '.((int) $conf->entity));
	if ($filters['date_start'] !== '') $where[] = "w.action_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "w.action_date <= '".$db->escape($filters['date_end'])." 23:59:59'";

	$sql = 'SELECT w.object_type, w.object_id, CASE WHEN w.object_type = \'mjlfinancement_activity\' THEN a.ref ELSE NULL END AS object_ref, w.action, w.from_status, w.to_status, u.login AS actor, w.actor_role, w.action_date, COALESCE(w.comment, w.reason) AS comment, w.changes_json';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY w.action_date DESC, w.rowid DESC';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$values = mjl_reports_changes_values(isset($row['changes_json']) ? $row['changes_json'] : '');
		$row['object_type_label'] = mjl_reports_object_type_label($row['object_type']);
		$row['decision'] = $row['action'];
		$row['previous_value'] = $values['previous'];
		$row['new_value'] = $values['new'];
	}
	unset($row);

	$expenseRows = mjl_reports_expense_audit_rows($filters);
	return array_merge($rows, $expenseRows);
}

function mjl_reports_expenses_validations_rows($filters)
{
	global $db, $conf;

	$where = array('e.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'e.fk_project = '.((int) $filters['project_id']);
	if (!empty($filters['convention_id'])) $where[] = 'e.fk_convention = '.((int) $filters['convention_id']);
	if ($filters['status'] !== '') $where[] = 'e.status = '.((int) $filters['status']);
	if ($filters['date_start'] !== '') $where[] = "e.expense_date >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $where[] = "e.expense_date <= '".$db->escape($filters['date_end'])."'";

	$sql = 'SELECT s.nom AS partner, p.ref AS project, c.ref AS envelope, a.ref AS activity, e.ref AS expense_ref, e.expense_date, e.amount, e.status AS expense_status,';
	$sql .= ' CASE WHEN '.mjl_expense_document_present_sql('e').' THEN 1 ELSE 0 END AS document_present,';
	$sql .= ' creator.login AS creator, validator.login AS validator, e.validation_date, e.correction_reason';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user creator ON creator.rowid = e.fk_user_creat';
	$sql .= ' LEFT JOIN '.$db->prefix().'user validator ON validator.rowid = e.fk_user_valid';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY e.expense_date ASC, e.ref';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['expense_status'] = mjl_reports_expense_status_label($row['expense_status']);
		$row['document_present'] = ((int) $row['document_present'] === 1) ? 'Oui' : 'Non';
	}
	unset($row);
	return $rows;
}

function mjl_reports_exchange_rows($filters)
{
	global $db, $conf;

	$where = array('x.entity = '.((int) $conf->entity));
	if ($filters['date_start'] !== '') $where[] = "x.exchange_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "x.exchange_date <= '".$db->escape($filters['date_end'])." 23:59:59'";

	$sql = 'SELECT x.ref, x.object_type, x.object_id, a.ref AS activity_ref, x.exchange_date, u.login, x.actor_role, x.channel, x.subject, x.message';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND x.object_type = \'mjlfinancement_activity\' AND a.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = x.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY x.exchange_date DESC, x.rowid DESC';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_dpaf_rows($filters)
{
	global $db, $conf;

	$where = array('c.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'c.fk_project = '.((int) $filters['project_id']);
	if (!empty($filters['convention_id'])) $where[] = 'c.rowid = '.((int) $filters['convention_id']);

	$sql = 'SELECT c.ref AS convention_ref,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = c.entity AND bl.fk_convention = c.rowid), 0) AS budget_revise,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_VALIDATED.'), 0) AS depenses_validees,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_SUBMITTED.'), 0) AS depenses_soumises,';
	$sql .= ' COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = c.entity AND fr.fk_convention = c.rowid AND fr.status = 1), 0) AS fonds_recus,';
	$sql .= ' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a WHERE a.entity = c.entity AND a.fk_convention = c.rowid AND a.status = '.MjlActivity::STATUS_SUBMITTED.'), 0) AS activites_en_revue,';
	$sql .= ' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_SUBMITTED.'), 0) AS depenses_en_revue';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY c.ref';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_project_options()
{
	global $db, $conf;

	$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' ORDER BY ref';
	$resql = $db->query($sql);
	$options = array();
	if ($resql) while ($obj = $db->fetch_object($resql)) $options[(int) $obj->rowid] = $obj->ref.' - '.$obj->title;
	return $options;
}

function mjl_reports_convention_options()
{
	global $db, $conf;

	$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'mjlfinancement_convention WHERE entity = '.((int) $conf->entity).' ORDER BY ref';
	$resql = $db->query($sql);
	$options = array();
	if ($resql) while ($obj = $db->fetch_object($resql)) $options[(int) $obj->rowid] = $obj->ref.' - '.$obj->title;
	return $options;
}

function mjl_reports_select($name, $options, $selected, $emptyLabel)
{
	$html = '<select name="'.dol_escape_htmltag($name).'">';
	$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	foreach ($options as $value => $label) {
		$html .= '<option value="'.((int) $value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	$html .= '</select>';
	return $html;
}

function mjl_reports_fetch_rows($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}
	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}

function mjl_reports_activity_status_label($status)
{
	$map = array(
		MjlActivity::STATUS_DRAFT => 'Brouillon',
		MjlActivity::STATUS_ONGOING => 'En cours',
		MjlActivity::STATUS_COMPLETED => 'Terminée',
		MjlActivity::STATUS_SUBMITTED => 'Soumise',
		MjlActivity::STATUS_CORRECTION_REQUESTED => 'Correction demandée',
		MjlActivity::STATUS_CORRECTED => 'Corrigée',
		MjlActivity::STATUS_VALIDATED => 'Validée',
		MjlActivity::STATUS_REJECTED => 'Rejetée',
		MjlActivity::STATUS_CANCELLED => 'Annulée',
	);
	return isset($map[(int) $status]) ? $map[(int) $status] : (string) $status;
}

function mjl_reports_expense_status_label($status)
{
	$map = array(0 => 'Brouillon', 1 => 'Soumise', 2 => 'Validée', 3 => 'Corrigée', 8 => 'Rejetée');
	return isset($map[(int) $status]) ? $map[(int) $status] : (string) $status;
}

function mjl_reports_deadline_alert($dateEnd, $status)
{
	if (in_array((int) $status, array(MjlActivity::STATUS_COMPLETED, MjlActivity::STATUS_CANCELLED), true) || empty($dateEnd)) {
		return '';
	}
	$end = strtotime((string) $dateEnd);
	if ($end <= 0) {
		return '';
	}
	$today = strtotime(date('Y-m-d'));
	if ($end < $today) {
		return 'En retard';
	}
	if ($end <= strtotime('+7 days', $today)) {
		return 'Échéance proche';
	}
	return '';
}

function mjl_reports_activity_performance_index($dateEnd, $status, $physicalProgress)
{
	$status = (int) $status;
	$physicalProgress = max(0, min(100, (float) $physicalProgress));
	$deadlineScore = mjl_reports_deadline_score($dateEnd, $status);
	$validationScore = mjl_reports_validation_score($status);

	return round((0.4 * $deadlineScore) + (0.4 * $physicalProgress) + (0.2 * $validationScore), 2);
}

function mjl_reports_deadline_score($dateEnd, $status)
{
	if ((int) $status === MjlActivity::STATUS_COMPLETED) {
		return 100;
	}
	$end = strtotime((string) $dateEnd);
	if ($end <= 0) {
		return 70;
	}
	$today = strtotime(date('Y-m-d'));
	if ($end >= $today) {
		return 70;
	}
	$daysLate = floor(($today - $end) / 86400);
	return $daysLate <= 7 ? 40 : 0;
}

function mjl_reports_validation_score($status)
{
	$map = array(
		MjlActivity::STATUS_VALIDATED => 100,
		MjlActivity::STATUS_SUBMITTED => 60,
		MjlActivity::STATUS_ONGOING => 60,
		MjlActivity::STATUS_CORRECTION_REQUESTED => 30,
		MjlActivity::STATUS_REJECTED => 0,
		MjlActivity::STATUS_CANCELLED => 0,
	);
	return isset($map[(int) $status]) ? $map[(int) $status] : 0;
}

function mjl_reports_object_type_label($objectType)
{
	if ($objectType === 'mjlfinancement_activity') {
		return 'Activité';
	}
	if ($objectType === 'mjlfinancement_expense') {
		return 'Dépense';
	}
	return (string) $objectType;
}

function mjl_reports_changes_values($changesJson)
{
	$decoded = json_decode((string) $changesJson, true);
	if (!is_array($decoded)) {
		return array('previous' => '', 'new' => '');
	}
	$previous = array();
	$new = array();
	foreach ($decoded as $field => $change) {
		if (is_array($change)) {
			$previous[] = $field.': '.(array_key_exists('before', $change) ? (string) $change['before'] : '');
			$new[] = $field.': '.(array_key_exists('after', $change) ? (string) $change['after'] : '');
		}
	}
	return array('previous' => implode(' | ', $previous), 'new' => implode(' | ', $new));
}

function mjl_reports_expense_audit_rows($filters)
{
	global $db, $conf;

	$where = array('v.entity = '.((int) $conf->entity));
	if ($filters['date_start'] !== '') $where[] = "v.action_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "v.action_date <= '".$db->escape($filters['date_end'])." 23:59:59'";

	$sql = 'SELECT \'Dépense\' AS object_type_label, e.ref AS object_ref, v.action AS decision, v.from_status, v.to_status,';
	$sql .= ' v.from_status AS previous_value, v.to_status AS new_value, u.login AS actor, \'\' AS actor_role, v.action_date, v.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY v.action_date DESC, v.rowid DESC';
	return mjl_reports_fetch_rows($sql);
}
