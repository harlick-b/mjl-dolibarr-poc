<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlfundreceipt.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reporting.lib.php';

function mjl_dashboard_count($table)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().$table.' WHERE entity = '.((int) $conf->entity);
	return (int) mjl_dashboard_scalar($sql);
}

function mjl_dashboard_fetch_id($table, $where)
{
	global $db, $conf;

	$sql = 'SELECT rowid FROM '.$db->prefix().$table.' WHERE '.$where;
	$sql .= ' AND entity = '.((int) $conf->entity);
	return (int) mjl_dashboard_scalar($sql, 'rowid');
}

function mjl_dashboard_project_summary($projectId)
{
	return mjl_report_project_summary($projectId);
}

function mjl_dashboard_convention_budget($conventionId)
{
	return mjl_report_convention_budget($conventionId);
}

function mjl_dashboard_workspace_metrics()
{
	return array(
		'deadline_risks' => mjl_dashboard_deadline_risk_count(),
		'missing_expense_documents' => mjl_dashboard_missing_expense_document_count(),
		'pending_reviews' => mjl_dashboard_pending_review_count(),
	);
}

function mjl_dashboard_dpaf_kpis()
{
	return array(
		array('label' => 'Activites en cours', 'value' => mjl_dashboard_activity_count(array(MjlActivity::STATUS_ONGOING)), 'context' => 'Activites ouvertes dans l entite active', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites'),
		array('label' => 'Activites en validation', 'value' => mjl_dashboard_activity_count(array(MjlActivity::STATUS_SUBMITTED, MjlActivity::STATUS_PREVALIDATED)), 'context' => 'Dossiers en attente de prevalidation ou validation definitive', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Examiner'),
		array('label' => 'Depenses soumises', 'value' => mjl_dashboard_expense_count(array(MjlExpense::STATUS_SUBMITTED)), 'context' => 'Depenses a controler', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Ouvrir les depenses'),
		array('label' => 'Budget revise', 'value' => price(mjl_dashboard_budget_total()), 'context' => 'Total des lignes budgetaires', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Ouvrir les rapports'),
		array('label' => 'Depenses validees', 'value' => price(mjl_dashboard_validated_expense_total()), 'context' => 'Montant deja valide', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Voir les exports'),
	);
}

function mjl_dashboard_deadline_risks($limit = 20)
{
	global $db, $conf;

	$statuses = MjlActivity::openStatuses();
	$sql = 'SELECT a.rowid, a.ref, a.label, a.date_end, a.status, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status IN ('.implode(',', array_map('intval', $statuses)).')';
	$sql .= " AND a.date_end IS NOT NULL AND a.date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);
	$rows = mjl_dashboard_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['urgency'] = mjl_dashboard_deadline_alert($row['date_end']);
		$row['status_label'] = mjl_dashboard_activity_status_label($row['status']);
	}
	unset($row);
	return $rows;
}

function mjl_dashboard_pending_reviews($limit = 30)
{
	global $db, $conf;

	$sql = 'SELECT \'Activite\' AS item_type, rowid AS item_id, ref, label, date_end AS item_date, 0 AS amount, \'/custom/mjlfinancement/activities.php\' AS href';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity WHERE entity = '.((int) $conf->entity).' AND status IN ('.MjlActivity::STATUS_SUBMITTED.', '.MjlActivity::STATUS_PREVALIDATED.')';
	$sql .= ' UNION ALL ';
	$sql .= 'SELECT \'Depense\' AS item_type, rowid AS item_id, ref, description AS label, expense_date AS item_date, amount, \'/custom/mjlfinancement/expenses.php\' AS href';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense WHERE entity = '.((int) $conf->entity).' AND status = '.MjlExpense::STATUS_SUBMITTED;
	$sql .= ' ORDER BY item_date ASC, ref ASC LIMIT '.((int) $limit);
	return mjl_dashboard_fetch_rows($sql);
}

function mjl_dashboard_budget_expense_rows()
{
	global $db, $conf;

	$sql = 'SELECT c.ref AS convention_ref,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = c.entity AND bl.fk_convention = c.rowid), 0) AS budget_revise,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_VALIDATED.'), 0) AS depenses_validees,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_SUBMITTED.'), 0) AS depenses_soumises';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity);
	$sql .= ' ORDER BY c.ref';
	return mjl_dashboard_fetch_rows($sql);
}

function mjl_dashboard_recent_funds($limit = 10)
{
	global $db, $conf;

	$sql = 'SELECT fr.rowid, fr.entity AS evidence_entity, fr.supporting_document AS stored_supporting_document, fr.ref, fr.reception_date, fr.amount, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_fund_receipt fr';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = fr.fk_project AND p.entity = fr.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = fr.fk_convention AND c.entity = fr.entity';
	$sql .= ' WHERE fr.entity = '.((int) $conf->entity);
	$sql .= ' AND fr.status = '.MjlFundReceipt::STATUS_RECEIVED;
	$sql .= ' ORDER BY fr.reception_date DESC, fr.rowid DESC LIMIT '.((int) $limit);
	$rows = mjl_dashboard_fetch_rows($sql);
	foreach ($rows as &$row) {
		$state = mjl_fund_receipt_evidence_state((int) $row['rowid'], (int) $row['evidence_entity'], $row['stored_supporting_document']);
		$row['document_state'] = $state === 'downloadable' ? 'Disponible' : ($state === 'unavailable' ? 'Référence indisponible' : 'Manquante');
		unset($row['rowid'], $row['evidence_entity'], $row['stored_supporting_document']);
	}
	unset($row);
	return $rows;
}

function mjl_dashboard_recent_audit($limit = 30)
{
	global $db, $conf;

	$sql = 'SELECT CASE WHEN w.object_type = \'mjlfinancement_activity\' THEN \'Activite\' WHEN w.object_type = \'mjlfinancement_convention\' THEN \'Convention\' WHEN w.object_type = \'mjlfinancement_budget_line\' THEN \'Ligne budgetaire\' WHEN w.object_type = \'mjlfinancement_fund_receipt\' THEN \'Réception de fonds\' ELSE w.object_type END AS source,';
	$sql .= ' CASE WHEN w.object_type = \'mjlfinancement_activity\' THEN a.ref WHEN w.object_type = \'mjlfinancement_convention\' THEN c.ref WHEN w.object_type = \'mjlfinancement_budget_line\' THEN bl.ref WHEN w.object_type = \'mjlfinancement_fund_receipt\' THEN fr.ref ELSE NULL END AS object_ref,';
	$sql .= ' w.action, w.from_status, w.to_status, u.login, w.action_date, w.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = w.object_id AND w.object_type = \'mjlfinancement_convention\' AND c.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = w.object_id AND w.object_type = \'mjlfinancement_budget_line\' AND bl.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = w.object_id AND w.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity);
	$sql .= ' UNION ALL ';
	$sql .= 'SELECT \'Depense\' AS source, e.ref AS object_ref, v.action, v.from_status, v.to_status, u.login, v.action_date, v.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
	$sql .= ' WHERE v.entity = '.((int) $conf->entity);
	$sql .= ' ORDER BY action_date DESC LIMIT '.((int) $limit);
	return mjl_dashboard_fetch_rows($sql);
}

function mjl_dashboard_activity_count($statuses)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND status IN ('.implode(',', array_map('intval', $statuses)).')';
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_expense_count($statuses)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_expense';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND status IN ('.implode(',', array_map('intval', $statuses)).')';
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_deadline_risk_count()
{
	global $db, $conf;

	$statuses = MjlActivity::openStatuses();
	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND status IN ('.implode(',', array_map('intval', $statuses)).')';
	$sql .= " AND date_end IS NOT NULL AND date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_missing_expense_document_count()
{
	global $db, $conf;

	$sql = 'SELECT e.rowid, e.entity, e.supporting_document FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.MjlExpense::STATUS_DRAFT.', '.MjlExpense::STATUS_CORRECTED.', '.MjlExpense::STATUS_SUBMITTED.')';
	$resql = $db->query($sql);
	if (!$resql) {
		return 0;
	}
	$count = 0;
	while ($row = $db->fetch_object($resql)) {
		if (mjl_expense_evidence_state((int) $row->rowid, (int) $row->entity, $row->supporting_document) !== 'downloadable') {
			$count++;
		}
	}
	return $count;
}

function mjl_dashboard_pending_review_count()
{
	return mjl_dashboard_activity_count(array(MjlActivity::STATUS_SUBMITTED, MjlActivity::STATUS_PREVALIDATED)) + mjl_dashboard_expense_count(array(MjlExpense::STATUS_SUBMITTED));
}

function mjl_dashboard_budget_total()
{
	global $db, $conf;

	$sql = 'SELECT COALESCE(SUM(revised_budget), 0) AS nb FROM '.$db->prefix().'mjlfinancement_budget_line WHERE entity = '.((int) $conf->entity);
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_validated_expense_total()
{
	global $db, $conf;

	$sql = 'SELECT COALESCE(SUM(amount), 0) AS nb FROM '.$db->prefix().'mjlfinancement_expense WHERE entity = '.((int) $conf->entity).' AND status = '.MjlExpense::STATUS_VALIDATED;
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_render_header($title, $copy, $contextLabel, $contextValue)
{
	print '<section class="mjl-workspace-header">';
	print '<div>';
	print '<p class="mjl-kicker">MJL Clarity System</p>';
	print '<h1>'.dol_escape_htmltag($title).'</h1>';
	print '<p class="mjl-header-copy">'.dol_escape_htmltag($copy).'</p>';
	print '</div>';
	print '<div class="mjl-user-context">';
	print '<span>'.dol_escape_htmltag($contextLabel).'</span>';
	print '<strong>'.dol_escape_htmltag($contextValue).'</strong>';
	print '</div>';
	print '</section>';
}

function mjl_dashboard_render_card_section($title, $description, $cards)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading">';
	print '<h2>'.dol_escape_htmltag($title).'</h2>';
	print '<p>'.dol_escape_htmltag($description).'</p>';
	print '</div>';
	print '<div class="mjl-card-grid">';
	foreach ($cards as $card) {
		$tone = empty($card['tone']) ? 'neutral' : $card['tone'];
		print '<article class="mjl-dashboard-card mjl-dashboard-card-'.$tone.'">';
		print '<div>';
		print '<span class="mjl-card-label">'.dol_escape_htmltag($card['label']).'</span>';
		print '<strong class="mjl-card-value">'.dol_escape_htmltag((string) $card['value']).'</strong>';
		print '<p>'.dol_escape_htmltag($card['context']).'</p>';
		if (!empty($card['status'])) {
			print '<span class="mjl-status-pill mjl-status-'.$tone.'">'.dol_escape_htmltag($card['status']).'</span>';
		}
		print '</div>';
		print '<a class="mjl-card-link" href="'.mjl_dashboard_url($card['href']).'">'.dol_escape_htmltag($card['action']).'</a>';
		print '</article>';
	}
	print '</div>';
	print '</section>';
}

function mjl_dashboard_render_alert_section($title, $description, $alerts, $emptyLabel)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading">';
	print '<h2>'.dol_escape_htmltag($title).'</h2>';
	print '<p>'.dol_escape_htmltag($description).'</p>';
	print '</div>';
	if (empty($alerts)) {
		print '<div class="mjl-empty-state">'.dol_escape_htmltag($emptyLabel).'</div>';
		print '</section>';
		return;
	}
	print '<div class="mjl-alert-grid">';
	foreach ($alerts as $alert) {
		$urgency = empty($alert['urgency']) ? 'A surveiller' : $alert['urgency'];
		$tone = $urgency === 'En retard' ? 'danger' : 'warning';
		print '<article class="mjl-alert-card mjl-alert-'.$tone.'">';
		print '<div class="mjl-alert-card-main">';
		print '<span class="mjl-status-pill mjl-status-'.$tone.'">'.dol_escape_htmltag($urgency).'</span>';
		print '<h3>'.dol_escape_htmltag($alert['ref']).' - '.dol_escape_htmltag($alert['label']).'</h3>';
		print '<p>'.dol_escape_htmltag('Action attendue: examiner l activite et confirmer la prochaine decision.').'</p>';
		print '</div>';
		print '<dl class="mjl-alert-meta">';
		print '<div><dt>Projet</dt><dd>'.dol_escape_htmltag($alert['project_ref']).'</dd></div>';
		print '<div><dt>Convention</dt><dd>'.dol_escape_htmltag($alert['convention_ref']).'</dd></div>';
		print '<div><dt>Echeance</dt><dd>'.dol_escape_htmltag($alert['date_end']).'</dd></div>';
		print '<div><dt>Statut</dt><dd>'.dol_escape_htmltag($alert['status_label']).'</dd></div>';
		print '</dl>';
		print '<a class="mjl-card-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $alert['rowid']).'">Ouvrir l activite</a>';
		print '</article>';
	}
	print '</div>';
	print '</section>';
}

function mjl_dashboard_render_table_section($title, $description, $headers, $rows, $emptyLabel, $renderer)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading">';
	print '<h2>'.dol_escape_htmltag($title).'</h2>';
	print '<p>'.dol_escape_htmltag($description).'</p>';
	print '</div>';
	print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
	print '<tr class="liste_titre">';
	foreach ($headers as $header) {
		print '<th'.(!empty($header['class']) ? ' class="'.dol_escape_htmltag($header['class']).'"' : '').'>'.dol_escape_htmltag($header['label']).'</th>';
	}
	print '</tr>';
	if (empty($rows)) {
		print '<tr class="oddeven"><td colspan="'.count($headers).'">'.dol_escape_htmltag($emptyLabel).'</td></tr>';
	} else {
		foreach ($rows as $row) {
			call_user_func($renderer, $row);
		}
	}
	print '</table></div>';
	print '</section>';
}

function mjl_dashboard_render_link_section($title, $description, $items)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading">';
	print '<h2>'.dol_escape_htmltag($title).'</h2>';
	print '<p>'.dol_escape_htmltag($description).'</p>';
	print '</div>';
	print '<div class="mjl-link-grid">';
	foreach ($items as $item) {
		print '<a class="mjl-nav-card" href="'.mjl_dashboard_url($item[1]).'">';
		print '<strong>'.dol_escape_htmltag($item[0]).'</strong>';
		print '<span>'.dol_escape_htmltag($item[2]).'</span>';
		print '</a>';
	}
	print '</div>';
	print '</section>';
}

function mjl_dashboard_url($href)
{
	if (strpos($href, DOL_URL_ROOT) === 0) {
		return dol_escape_htmltag($href);
	}
	return DOL_URL_ROOT.dol_escape_htmltag($href);
}

function mjl_dashboard_scalar($sql, $field = 'nb')
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return 0;
	}

	$obj = $db->fetch_object($resql);
	return $obj && isset($obj->{$field}) ? $obj->{$field} : 0;
}

function mjl_dashboard_fetch_row($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return array();
	}

	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_dashboard_fetch_rows($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return array();
	}

	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}

function mjl_dashboard_error($message)
{
	if (function_exists('setEventMessages')) {
		setEventMessages($message, null, 'errors');
	}
}

function mjl_dashboard_deadline_alert($dateEnd)
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

function mjl_dashboard_activity_status_label($status)
{
	$map = array(
		MjlActivity::STATUS_DRAFT => 'Brouillon',
		MjlActivity::STATUS_ONGOING => 'En cours',
		MjlActivity::STATUS_COMPLETED => 'Terminee',
		MjlActivity::STATUS_SUBMITTED => 'Soumise',
		MjlActivity::STATUS_CORRECTION_REQUESTED => 'Correction demandee',
		MjlActivity::STATUS_CORRECTED => 'Corrigee',
		MjlActivity::STATUS_VALIDATED => 'Validee definitivement',
		MjlActivity::STATUS_PREVALIDATED => 'Prevalidee',
		MjlActivity::STATUS_REJECTED => 'Rejetee',
		MjlActivity::STATUS_CANCELLED => 'Annulee',
	);
	return isset($map[(int) $status]) ? $map[(int) $status] : (string) $status;
}
