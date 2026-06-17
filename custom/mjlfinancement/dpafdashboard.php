<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';

if (!$user->hasRight('mjlfinancement', 'report', 'read')) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');

llxHeader('', 'Tableau de bord DPAF');
print load_fiche_titre('Tableau de bord DPAF', '', 'stats');

mjl_dpaf_kpis();
mjl_dpaf_activity_deadlines();
mjl_dpaf_pending_reviews();
mjl_dpaf_budget_expense_summary();
mjl_dpaf_recent_funds();
mjl_dpaf_recent_audit();

llxFooter();
$db->close();

function mjl_dpaf_kpis()
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$items = array(
		'Activites en cours' => 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity WHERE entity = '.$entity.' AND status = '.MjlActivity::STATUS_ONGOING,
		'Activites en revue' => 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity WHERE entity = '.$entity.' AND status = '.MjlActivity::STATUS_SUBMITTED,
		'Depenses soumises' => 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_expense WHERE entity = '.$entity.' AND status = '.MjlExpense::STATUS_SUBMITTED,
		'Budget revise' => 'SELECT COALESCE(SUM(revised_budget), 0) AS nb FROM '.$db->prefix().'mjlfinancement_budget_line WHERE entity = '.$entity,
		'Depenses validees' => 'SELECT COALESCE(SUM(amount), 0) AS nb FROM '.$db->prefix().'mjlfinancement_expense WHERE entity = '.$entity.' AND status = '.MjlExpense::STATUS_VALIDATED,
	);

	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Indicateur</th><th class="right">Valeur</th></tr>';
	foreach ($items as $label => $sql) {
		$value = mjl_dpaf_scalar($sql);
		$isAmount = in_array($label, array('Budget revise', 'Depenses validees'), true);
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($label).'</td><td class="right">'.($isAmount ? price($value) : (int) $value).'</td></tr>';
	}
	print '</table></div><br>';
}

function mjl_dpaf_activity_deadlines()
{
	global $db, $conf;

	$sql = 'SELECT a.ref, a.label, a.date_end, a.status, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND a.date_end IS NOT NULL';
	$sql .= ' AND a.status NOT IN ('.MjlActivity::STATUS_COMPLETED.', '.MjlActivity::STATUS_CANCELLED.')';
	$sql .= " AND a.date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	$sql .= ' ORDER BY a.date_end ASC LIMIT 20';
	$rows = mjl_dpaf_rows($sql);

	print load_fiche_titre('Alertes echeances activites', '', 'clock');
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Activite</th><th>Libelle</th><th>Projet</th><th>Convention</th><th>Fin</th><th>Alerte</th></tr>';
	if (empty($rows)) {
		print '<tr class="oddeven"><td colspan="6">Aucune alerte</td></tr>';
	}
	foreach ($rows as $row) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($row['ref']).'</td><td>'.dol_escape_htmltag($row['label']).'</td><td>'.dol_escape_htmltag($row['project_ref']).'</td><td>'.dol_escape_htmltag($row['convention_ref']).'</td><td>'.dol_escape_htmltag($row['date_end']).'</td><td>'.dol_escape_htmltag(mjl_dpaf_deadline_alert($row['date_end'])).'</td></tr>';
	}
	print '</table></div><br>';
}

function mjl_dpaf_pending_reviews()
{
	global $db, $conf;

	print load_fiche_titre('Revues en attente', '', 'check');
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Type</th><th>Ref</th><th>Libelle</th><th>Date</th><th class="right">Montant</th></tr>';

	$sql = 'SELECT \'Activite\' AS item_type, ref, label, date_end AS item_date, 0 AS amount FROM '.$db->prefix().'mjlfinancement_activity WHERE entity = '.((int) $conf->entity).' AND status = '.MjlActivity::STATUS_SUBMITTED;
	$sql .= ' UNION ALL ';
	$sql .= 'SELECT \'Depense\' AS item_type, ref, description AS label, expense_date AS item_date, amount FROM '.$db->prefix().'mjlfinancement_expense WHERE entity = '.((int) $conf->entity).' AND status = '.MjlExpense::STATUS_SUBMITTED;
	$sql .= ' ORDER BY item_date ASC LIMIT 30';
	$rows = mjl_dpaf_rows($sql);
	if (empty($rows)) {
		print '<tr class="oddeven"><td colspan="5">Aucune revue en attente</td></tr>';
	}
	foreach ($rows as $row) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($row['item_type']).'</td><td>'.dol_escape_htmltag($row['ref']).'</td><td>'.dol_escape_htmltag($row['label']).'</td><td>'.dol_escape_htmltag($row['item_date']).'</td><td class="right">'.(((float) $row['amount'] > 0) ? price($row['amount']) : '').'</td></tr>';
	}
	print '</table></div><br>';
}

function mjl_dpaf_budget_expense_summary()
{
	global $db, $conf;

	$sql = 'SELECT c.ref AS convention_ref,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = c.entity AND bl.fk_convention = c.rowid), 0) AS budget_revise,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_VALIDATED.'), 0) AS depenses_validees,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_SUBMITTED.'), 0) AS depenses_soumises';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity);
	$sql .= ' ORDER BY c.ref';
	$rows = mjl_dpaf_rows($sql);

	print load_fiche_titre('Budgets et depenses', '', 'money-bill');
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Convention</th><th class="right">Budget revise</th><th class="right">Depenses validees</th><th class="right">Depenses soumises</th><th class="right">Disponible</th></tr>';
	if (empty($rows)) {
		print '<tr class="oddeven"><td colspan="5">Aucune donnee</td></tr>';
	}
	foreach ($rows as $row) {
		$available = (float) $row['budget_revise'] - (float) $row['depenses_validees'];
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($row['convention_ref']).'</td><td class="right">'.price($row['budget_revise']).'</td><td class="right">'.price($row['depenses_validees']).'</td><td class="right">'.price($row['depenses_soumises']).'</td><td class="right">'.price($available).'</td></tr>';
	}
	print '</table></div><br>';
}

function mjl_dpaf_recent_funds()
{
	global $db, $conf;

	$sql = 'SELECT fr.ref, fr.reception_date, fr.amount, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_fund_receipt fr';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = fr.fk_project';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = fr.fk_convention';
	$sql .= ' WHERE fr.entity = '.((int) $conf->entity);
	$sql .= ' ORDER BY fr.reception_date DESC, fr.rowid DESC LIMIT 10';
	$rows = mjl_dpaf_rows($sql);

	print load_fiche_titre('Dernieres receptions de fonds', '', 'bank');
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Ref</th><th>Date</th><th>Projet</th><th>Convention</th><th class="right">Montant</th></tr>';
	if (empty($rows)) {
		print '<tr class="oddeven"><td colspan="5">Aucune reception</td></tr>';
	}
	foreach ($rows as $row) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($row['ref']).'</td><td>'.dol_escape_htmltag($row['reception_date']).'</td><td>'.dol_escape_htmltag($row['project_ref']).'</td><td>'.dol_escape_htmltag($row['convention_ref']).'</td><td class="right">'.price($row['amount']).'</td></tr>';
	}
	print '</table></div><br>';
}

function mjl_dpaf_recent_audit()
{
	global $db, $conf;

	print load_fiche_titre('Dernieres actions auditees', '', 'list');
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Source</th><th>Objet</th><th>Action</th><th>De</th><th>Vers</th><th>Acteur</th><th>Date</th><th>Commentaire</th></tr>';

	$sql = 'SELECT \'Activite\' AS source, a.ref AS object_ref, w.action, w.from_status, w.to_status, u.login, w.action_date, w.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity);
	$sql .= ' UNION ALL ';
	$sql .= 'SELECT \'Depense\' AS source, e.ref AS object_ref, v.action, v.from_status, v.to_status, u.login, v.action_date, v.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
	$sql .= ' WHERE v.entity = '.((int) $conf->entity);
	$sql .= ' ORDER BY action_date DESC LIMIT 30';
	$rows = mjl_dpaf_rows($sql);
	if (empty($rows)) {
		print '<tr class="oddeven"><td colspan="8">Aucune action</td></tr>';
	}
	foreach ($rows as $row) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($row['source']).'</td><td>'.dol_escape_htmltag($row['object_ref']).'</td><td>'.dol_escape_htmltag($row['action']).'</td><td>'.dol_escape_htmltag($row['from_status']).'</td><td>'.dol_escape_htmltag($row['to_status']).'</td><td>'.dol_escape_htmltag($row['login']).'</td><td>'.dol_escape_htmltag($row['action_date']).'</td><td>'.dol_escape_htmltag($row['comment']).'</td></tr>';
	}
	print '</table></div>';
}

function mjl_dpaf_deadline_alert($dateEnd)
{
	$end = strtotime((string) $dateEnd);
	if ($end <= 0) {
		return '';
	}
	$today = strtotime(date('Y-m-d'));
	if ($end < $today) {
		return 'En retard';
	}
	if ($end <= strtotime('+7 days', $today)) {
		return 'Echeance proche';
	}
	return '';
}

function mjl_dpaf_scalar($sql)
{
	$rows = mjl_dpaf_rows($sql);
	return empty($rows) ? 0 : $rows[0]['nb'];
}

function mjl_dpaf_rows($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return array();
	}
	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}
