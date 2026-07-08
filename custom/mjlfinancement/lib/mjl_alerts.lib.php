<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

function mjl_alerts_user_can_read(User $targetUser)
{
	return $targetUser->hasRight('mjlfinancement', 'activity', 'read') || $targetUser->hasRight('mjlfinancement', 'expense', 'read');
}

function mjl_alerts_for_user(User $targetUser, $limit = 100)
{
	$alerts = array();
	if ($targetUser->hasRight('mjlfinancement', 'activity', 'read')) {
		$alerts = array_merge($alerts, mjl_alerts_activity_deadlines($targetUser, $limit));
		$alerts = array_merge($alerts, mjl_alerts_activity_pending_reviews($targetUser, $limit));
	}
	if ($targetUser->hasRight('mjlfinancement', 'expense', 'read')) {
		$alerts = array_merge($alerts, mjl_alerts_expense_pending_reviews($targetUser, $limit));
		$alerts = array_merge($alerts, mjl_alerts_expense_missing_documents($targetUser, $limit));
	}

	usort($alerts, 'mjl_alerts_sort');
	return array_slice($alerts, 0, (int) $limit);
}

function mjl_alerts_count_for_user(User $targetUser)
{
	return count(mjl_alerts_for_user($targetUser, 500));
}

function mjl_alerts_activity_deadlines(User $targetUser, $limit)
{
	global $db, $conf;

	$where = mjl_alerts_activity_scope_where($targetUser, 'a', 'deadline');
	if ($where === null) {
		return array();
	}
	$statuses = mjl_alerts_open_activity_statuses();
	$sql = 'SELECT a.rowid, a.ref, a.label, a.date_end, a.status, a.fk_user_creat, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status IN ('.implode(',', array_map('intval', $statuses)).')';
	$sql .= " AND a.date_end IS NOT NULL AND a.date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	$sql .= $where;
	$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);
	$rows = mjl_alerts_fetch_rows($sql);
	$alerts = array();
	foreach ($rows as $row) {
		$severity = mjl_alerts_deadline_severity($row['date_end']);
		$alerts[] = array(
			'type' => 'activity_deadline',
			'object_type' => 'Activite',
			'ref' => $row['ref'],
			'label' => $row['label'],
			'severity' => $severity,
			'tone' => $severity === 'En retard' ? 'danger' : 'warning',
			'audience' => mjl_alerts_audience_label($targetUser, 'activity_deadline'),
			'expected_action' => 'Examiner l echeance et confirmer la prochaine action.',
			'href' => '/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']),
			'sort_date' => $row['date_end'],
			'meta' => array(
				'Projet' => $row['project_ref'],
				'Convention' => $row['convention_ref'],
				'Echeance' => mjl_alerts_format_date($row['date_end']),
				'Statut' => mjl_alerts_activity_status_label($row['status']),
			),
		);
	}
	return $alerts;
}

function mjl_alerts_activity_pending_reviews(User $targetUser, $limit)
{
	global $db, $conf;

	$where = mjl_alerts_activity_scope_where($targetUser, 'a', 'review');
	if ($where === null) {
		return array();
	}
	$sql = 'SELECT a.rowid, a.ref, a.label, a.date_end, a.status, a.fk_user_creat, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status IN ('.MjlActivity::STATUS_SUBMITTED.', '.MjlActivity::STATUS_PREVALIDATED.')';
	$sql .= $where;
	$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);
	$rows = mjl_alerts_fetch_rows($sql);
	$alerts = array();
	foreach ($rows as $row) {
		$alerts[] = array(
			'type' => 'activity_review',
			'object_type' => 'Activite',
			'ref' => $row['ref'],
			'label' => $row['label'],
			'severity' => 'Decision attendue',
			'tone' => 'warning',
			'audience' => 'Validateur',
			'expected_action' => 'Examiner l activite soumise et enregistrer une decision.',
			'href' => '/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']),
			'sort_date' => $row['date_end'],
			'meta' => array(
				'Projet' => $row['project_ref'],
				'Convention' => $row['convention_ref'],
				'Echeance' => mjl_alerts_format_date($row['date_end']),
				'Statut' => mjl_alerts_activity_status_label($row['status']),
			),
		);
	}
	return $alerts;
}

function mjl_alerts_expense_pending_reviews(User $targetUser, $limit)
{
	global $db, $conf;

	$where = mjl_alerts_expense_scope_where($targetUser, 'e', 'review');
	if ($where === null) {
		return array();
	}
	$sql = 'SELECT e.rowid, e.entity, e.ref, e.description, e.expense_date, e.amount, e.status, e.fk_user_creat, e.supporting_document, p.ref AS project_ref, c.ref AS convention_ref, a.ref AS activity_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status = '.MjlExpense::STATUS_SUBMITTED;
	$sql .= $where;
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.max((int) $limit * 5, (int) $limit);
	$rows = mjl_alerts_fetch_rows($sql);
	$alerts = array();
	foreach ($rows as $row) {
		$alerts[] = array(
			'type' => 'expense_review',
			'object_type' => 'Depense',
			'ref' => $row['ref'],
			'label' => $row['description'],
			'severity' => 'Decision attendue',
			'tone' => 'warning',
			'audience' => 'Validateur',
			'expected_action' => 'Controler la depense soumise et enregistrer une decision.',
			'href' => '/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']),
			'sort_date' => $row['expense_date'],
			'meta' => array(
				'Projet' => $row['project_ref'],
				'Convention' => $row['convention_ref'],
				'Activite' => $row['activity_ref'],
				'Montant' => price($row['amount']),
				'Date depense' => mjl_alerts_format_date($row['expense_date']),
				'Statut' => mjl_alerts_expense_status_label($row['status']),
			),
		);
	}
	return $alerts;
}

function mjl_alerts_expense_missing_documents(User $targetUser, $limit)
{
	global $db, $conf;

	$where = mjl_alerts_expense_scope_where($targetUser, 'e', 'document');
	if ($where === null) {
		return array();
	}
	$sql = 'SELECT e.rowid, e.entity AS evidence_entity, e.supporting_document AS evidence_supporting_document, e.ref, e.description, e.expense_date, e.amount, e.status, e.fk_user_creat, p.ref AS project_ref, c.ref AS convention_ref, a.ref AS activity_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.MjlExpense::STATUS_DRAFT.', '.MjlExpense::STATUS_CORRECTED.', '.MjlExpense::STATUS_SUBMITTED.')';
	$sql .= $where;
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.max((int) $limit * 5, (int) $limit);
	$rows = mjl_alerts_fetch_rows($sql);
	$alerts = array();
	foreach ($rows as $row) {
		$state = mjl_expense_evidence_state((int) $row['rowid'], (int) $row['evidence_entity'], $row['evidence_supporting_document']);
		if ($state === 'downloadable') {
			continue;
		}
		$alerts[] = array(
			'type' => 'expense_missing_document',
			'object_type' => 'Depense',
			'ref' => $row['ref'],
			'label' => $row['description'],
			'severity' => $state === 'unavailable' ? 'Piece indisponible' : 'Piece manquante',
			'tone' => 'danger',
			'audience' => mjl_alerts_audience_label($targetUser, 'expense_document'),
			'expected_action' => $state === 'unavailable' ? 'Remplacer la piece indisponible avant validation.' : 'Ajouter la piece justificative avant validation.',
			'href' => '/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']),
			'sort_date' => $row['expense_date'],
			'meta' => array(
				'Projet' => $row['project_ref'],
				'Convention' => $row['convention_ref'],
				'Activite' => $row['activity_ref'],
				'Montant' => price($row['amount']),
				'Date depense' => mjl_alerts_format_date($row['expense_date']),
				'Statut' => mjl_alerts_expense_status_label($row['status']),
			),
		);
	}
	return $alerts;
}

function mjl_alerts_activity_scope_where(User $targetUser, $alias, $mode)
{
	$a = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	if (mjl_workspace_can_access_supervision($targetUser)) {
		return '';
	}
	if (mjl_alerts_is_level1_operational($targetUser)) {
		return $mode === 'deadline' ? ' AND '.$a.'.fk_user_creat = '.((int) $targetUser->id) : null;
	}
	if (mjl_workspace_can_apply_activity_validation($targetUser)) {
		$statuses = mjl_scope_is_final_validator($targetUser) ? MjlActivity::finalReviewStatuses() : MjlActivity::verifierReviewStatuses();
		return ' AND '.$a.'.status IN ('.implode(',', array_map('intval', $statuses)).') AND '.$a.'.fk_user_creat <> '.((int) $targetUser->id).' AND ('.$a.'.fk_user_responsible IS NULL OR '.$a.'.fk_user_responsible <> '.((int) $targetUser->id).')';
	}
	if ($targetUser->hasRight('mjlfinancement', 'activity', 'read') && !$targetUser->hasRight('mjlfinancement', 'activity', 'write')) {
		return $mode === 'deadline' ? '' : null;
	}
	return null;
}

function mjl_alerts_expense_scope_where(User $targetUser, $alias, $mode)
{
	$a = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	if (mjl_workspace_can_access_supervision($targetUser)) {
		return '';
	}
	if (mjl_alerts_is_level1_operational($targetUser)) {
		return $mode === 'document' ? ' AND '.$a.'.fk_user_creat = '.((int) $targetUser->id) : null;
	}
	if ($targetUser->hasRight('mjlfinancement', 'expense', 'validate')) {
		return $mode === 'review' ? ' AND '.$a.'.status = '.MjlExpense::STATUS_SUBMITTED.' AND '.$a.'.fk_user_creat <> '.((int) $targetUser->id) : null;
	}
	if ($targetUser->hasRight('mjlfinancement', 'expense', 'read') && !$targetUser->hasRight('mjlfinancement', 'expense', 'write')) {
		return $mode === 'document' ? '' : null;
	}
	return null;
}

function mjl_alerts_is_level1_operational(User $targetUser)
{
	return ($targetUser->hasRight('mjlfinancement', 'activity', 'write') || $targetUser->hasRight('mjlfinancement', 'expense', 'write'))
		&& !$targetUser->hasRight('mjlfinancement', 'activity', 'validate')
		&& !$targetUser->hasRight('mjlfinancement', 'expense', 'validate')
		&& !mjl_workspace_can_access_supervision($targetUser);
}

function mjl_alerts_open_activity_statuses()
{
	return MjlActivity::openStatuses();
}

function mjl_alerts_deadline_severity($dateEnd)
{
	$end = strtotime((string) $dateEnd);
	$today = strtotime(date('Y-m-d'));
	if ($end > 0 && $end < $today) {
		return 'En retard';
	}
	return 'Echeance proche';
}

function mjl_alerts_format_date($value)
{
	$value = (string) $value;
	if ($value === '') {
		return '';
	}
	$date = substr($value, 0, 10);
	if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
		return $value;
	}
	return substr($date, 8, 2).'/'.substr($date, 5, 2).'/'.substr($date, 0, 4);
}

function mjl_alerts_audience_label(User $targetUser, $type)
{
	if (mjl_workspace_can_access_supervision($targetUser)) {
		return 'Supervision';
	}
	if ($targetUser->hasRight('mjlfinancement', 'activity', 'validate') || $targetUser->hasRight('mjlfinancement', 'expense', 'validate')) {
		return 'Validateur';
	}
	if (strpos($type, 'expense') === 0 || strpos($type, 'activity') === 0) {
		return 'Responsable operationnel';
	}
	return 'Utilisateur concerne';
}

function mjl_alerts_sort($left, $right)
{
	$severityOrder = array('En retard' => 0, 'Piece manquante' => 1, 'Decision attendue' => 2, 'Echeance proche' => 3);
	$leftRank = isset($severityOrder[$left['severity']]) ? $severityOrder[$left['severity']] : 9;
	$rightRank = isset($severityOrder[$right['severity']]) ? $severityOrder[$right['severity']] : 9;
	if ($leftRank !== $rightRank) {
		return $leftRank - $rightRank;
	}
	return strcmp((string) $left['sort_date'], (string) $right['sort_date']);
}

function mjl_alerts_fetch_rows($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		if (function_exists('setEventMessages')) {
			setEventMessages($db->lasterror(), null, 'errors');
		}
		return array();
	}
	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}

function mjl_alerts_activity_status_label($status)
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

function mjl_alerts_expense_status_label($status)
{
	$map = array(
		MjlExpense::STATUS_DRAFT => 'Brouillon',
		MjlExpense::STATUS_SUBMITTED => 'Soumise',
		MjlExpense::STATUS_VALIDATED => 'Validee',
		MjlExpense::STATUS_CORRECTED => 'Corrigee',
		MjlExpense::STATUS_REJECTED => 'Rejetee',
	);
	return isset($map[(int) $status]) ? $map[(int) $status] : (string) $status;
}
