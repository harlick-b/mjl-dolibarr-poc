<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlbudgetline.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_expense_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_metrics.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

function mjl_alerts_user_can_read(User $targetUser)
{
	return mjl_workspace_can_access_activity($targetUser)
		|| mjl_workspace_can_access_expense($targetUser)
		|| mjl_workspace_can_access_reference_data($targetUser, 'budgetline')
		|| mjl_workspace_can_access_reference_data($targetUser, 'convention');
}

function mjl_alerts_for_user(User $targetUser, $limit = 100, $scope = 'all')
{
	$scope = mjl_alerts_normalize_scope($scope);
	$alerts = array();
	$limit = max(1, (int) $limit);

	if (($scope === 'all' || $scope === 'activities') && mjl_workspace_can_access_activity($targetUser)) {
		$alerts = array_merge($alerts, mjl_alerts_activity_alerts($targetUser, $limit));
	}
	if (($scope === 'all' || $scope === 'expenses') && mjl_workspace_can_access_expense($targetUser)) {
		$alerts = array_merge($alerts, mjl_alerts_expense_alerts($targetUser, $limit));
	}
	if ($scope === 'all' || $scope === 'finance') {
		$alerts = array_merge($alerts, mjl_alerts_finance_alerts($targetUser, $limit));
	}

	usort($alerts, 'mjl_alerts_sort');
	return array_slice($alerts, 0, $limit);
}

function mjl_alerts_count_for_user(User $targetUser, $scope = 'all')
{
	return count(mjl_alerts_for_user($targetUser, 500, $scope));
}

function mjl_alerts_normalize_scope($scope)
{
	$scope = strtolower((string) $scope);
	return in_array($scope, array('all', 'activities', 'expenses', 'finance'), true) ? $scope : 'all';
}

function mjl_alerts_activity_alerts(User $targetUser, $limit)
{
	$alerts = array();
	$alerts = array_merge($alerts, mjl_alerts_activity_deadlines($targetUser, $limit));
	$alerts = array_merge($alerts, mjl_alerts_activity_pending_reviews($targetUser, $limit));
	$alerts = array_merge($alerts, mjl_alerts_activity_corrections($targetUser, $limit));
	$alerts = array_merge($alerts, mjl_alerts_activity_stale_execution($targetUser, $limit));
	return $alerts;
}

function mjl_alerts_activity_deadlines(User $targetUser, $limit)
{
	global $db, $conf;

	$sql = mjl_alerts_activity_base_sql();
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status IN ('.implode(',', array_map('intval', MjlActivity::openStatuses())).')';
	$sql .= " AND a.date_end IS NOT NULL AND a.date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_activity_role_sql($targetUser, 'deadline');
	$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$severity = mjl_alerts_deadline_severity($row['date_end']);
		$alerts[] = mjl_alerts_activity_payload($targetUser, $row, array(
			'type' => $severity === 'En retard' ? 'activity_overdue' : 'activity_deadline_soon',
			'severity' => $severity,
			'tone' => $severity === 'En retard' ? 'danger' : 'warning',
			'audience' => 'Agent de saisie',
			'expected_action' => 'Examiner l echeance et confirmer la prochaine action.',
			'sort_date' => $row['date_end'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_pending_reviews(User $targetUser, $limit)
{
	global $conf;

	if (!mjl_scope_is_verifier($targetUser) && !mjl_scope_is_final_validator($targetUser) && !mjl_scope_is_platform_admin($targetUser)) {
		return array();
	}

	$alerts = array();
	$reviewConfigs = array(
		array(
			'status' => MjlActivity::STATUS_SUBMITTED,
			'type' => 'activity_awaiting_prevalidation',
			'audience' => 'Agent verificateur',
			'expected_action' => 'Prevalider l activite ou demander une correction.',
			'allowed' => mjl_scope_is_verifier($targetUser) || mjl_scope_is_platform_admin($targetUser),
		),
		array(
			'status' => MjlActivity::STATUS_PREVALIDATED,
			'type' => 'activity_awaiting_final_validation',
			'audience' => 'Validateur definitif',
			'expected_action' => 'Valider definitivement l activite ou demander une correction.',
			'allowed' => mjl_scope_is_final_validator($targetUser) || mjl_scope_is_platform_admin($targetUser),
		),
	);
	foreach ($reviewConfigs as $config) {
		if (!$config['allowed']) {
			continue;
		}
		$sql = mjl_alerts_activity_base_sql();
		$sql .= ' WHERE a.entity = '.((int) $conf->entity);
		$sql .= ' AND a.status = '.((int) $config['status']);
		$sql .= ' AND a.fk_user_creat <> '.((int) $targetUser->id);
		$sql .= ' AND (a.fk_user_responsible IS NULL OR a.fk_user_responsible <> '.((int) $targetUser->id).')';
		$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
		$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);
		foreach (mjl_alerts_fetch_rows($sql) as $row) {
			$alerts[] = mjl_alerts_activity_payload($targetUser, $row, array(
				'type' => $config['type'],
				'severity' => 'Decision attendue',
				'tone' => 'warning',
				'audience' => $config['audience'],
				'expected_action' => $config['expected_action'],
				'sort_date' => $row['date_end'],
			));
		}
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_corrections(User $targetUser, $limit)
{
	global $conf;

	$sql = mjl_alerts_activity_base_sql();
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status = '.MjlActivity::STATUS_CORRECTION_REQUESTED;
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= ' AND (a.fk_user_creat = '.((int) $targetUser->id).' OR a.fk_user_responsible = '.((int) $targetUser->id).')';
	$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_activity_payload($targetUser, $row, array(
			'type' => 'activity_returned_for_correction',
			'severity' => 'Correction demandee',
			'tone' => 'danger',
			'audience' => 'Agent de saisie',
			'expected_action' => 'Corriger l activite puis la resoumettre.',
			'sort_date' => $row['date_end'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_stale_execution(User $targetUser, $limit)
{
	global $db, $conf;

	$sql = 'SELECT a.rowid, a.ref, a.label, a.date_end, a.status, a.fk_user_creat, a.fk_user_responsible, p.ref AS project_ref, c.ref AS convention_ref, COALESCE((SELECT MAX(w.action_date) FROM '.$db->prefix().'mjlfinancement_workflow_action w WHERE w.entity = a.entity AND w.object_type = \'mjlfinancement_activity\' AND w.object_id = a.rowid AND w.action = \'execution_updated\'), a.date_creation) AS last_execution_update';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status IN ('.implode(',', array_map('intval', MjlActivity::executionEditableStatuses())).')';
	$sql .= " AND COALESCE((SELECT MAX(w2.action_date) FROM ".$db->prefix()."mjlfinancement_workflow_action w2 WHERE w2.entity = a.entity AND w2.object_type = 'mjlfinancement_activity' AND w2.object_id = a.rowid AND w2.action = 'execution_updated'), a.date_creation) < '".$db->escape(date('Y-m-d H:i:s', strtotime('-14 days')))."'";
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_activity_role_sql($targetUser, 'correction');
	$sql .= ' ORDER BY last_execution_update ASC, a.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_activity_payload($targetUser, $row, array(
			'type' => 'activity_stale_execution',
			'severity' => 'Execution a actualiser',
			'tone' => 'warning',
			'audience' => 'Agent de saisie',
			'expected_action' => 'Mettre a jour l execution physique de l activite.',
			'sort_date' => $row['last_execution_update'],
			'meta_extra' => array('Derniere mise a jour' => mjl_alerts_format_date($row['last_execution_update'])),
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_base_sql()
{
	global $db;

	$sql = 'SELECT a.rowid, a.ref, a.label, a.date_end, a.status, a.fk_user_creat, a.fk_user_responsible, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	return $sql;
}

function mjl_alerts_expense_alerts(User $targetUser, $limit)
{
	$alerts = array();
	$alerts = array_merge($alerts, mjl_alerts_expense_pending_reviews($targetUser, $limit));
	$alerts = array_merge($alerts, mjl_alerts_expense_corrections($targetUser, $limit));
	$alerts = array_merge($alerts, mjl_alerts_expense_missing_documents($targetUser, $limit));
	$alerts = array_merge($alerts, mjl_alerts_expense_over_budget($targetUser, $limit));
	$alerts = array_merge($alerts, mjl_alerts_expense_validated_not_disbursed($targetUser, $limit));
	return $alerts;
}

function mjl_alerts_expense_pending_reviews(User $targetUser, $limit)
{
	global $conf;

	if (!mjl_scope_is_verifier($targetUser) && !mjl_scope_is_final_validator($targetUser) && !mjl_scope_is_platform_admin($targetUser)) {
		return array();
	}

	$configs = array(
		array(
			'status' => MjlExpense::STATUS_SUBMITTED,
			'type' => 'expense_awaiting_prevalidation',
			'audience' => 'Agent verificateur',
			'expected_action' => 'Controler la depense et la prevalider ou la rejeter.',
			'allowed' => mjl_scope_is_verifier($targetUser) || mjl_scope_is_platform_admin($targetUser),
		),
		array(
			'status' => MjlExpense::STATUS_PREVALIDATED,
			'type' => 'expense_awaiting_final_validation',
			'audience' => 'Validateur definitif',
			'expected_action' => 'Valider definitivement la depense ou la rejeter.',
			'allowed' => mjl_scope_is_final_validator($targetUser) || mjl_scope_is_platform_admin($targetUser),
		),
	);
	$alerts = array();
	foreach ($configs as $config) {
		if (!$config['allowed']) {
			continue;
		}
		$sql = mjl_alerts_expense_base_sql();
		$sql .= ' WHERE e.entity = '.((int) $conf->entity);
		$sql .= ' AND e.status = '.((int) $config['status']);
		$sql .= ' AND e.fk_user_creat <> '.((int) $targetUser->id);
		$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
		$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.((int) $limit);
		foreach (mjl_alerts_fetch_rows($sql) as $row) {
			$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
				'type' => $config['type'],
				'severity' => 'Decision attendue',
				'tone' => 'warning',
				'audience' => $config['audience'],
				'expected_action' => $config['expected_action'],
				'sort_date' => $row['expense_date'],
			));
		}
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_corrections(User $targetUser, $limit)
{
	global $conf;

	$sql = mjl_alerts_expense_base_sql();
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status = '.MjlExpense::STATUS_REJECTED;
	$sql .= ' AND e.fk_user_creat = '.((int) $targetUser->id);
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
			'type' => 'expense_returned_for_correction',
			'severity' => 'Correction demandee',
			'tone' => 'danger',
			'audience' => 'Agent de saisie',
			'expected_action' => 'Corriger la depense rejetee puis la resoumettre.',
			'sort_date' => $row['expense_date'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_missing_documents(User $targetUser, $limit)
{
	global $conf;

	$sql = mjl_alerts_expense_base_sql();
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.MjlExpense::STATUS_DRAFT.', '.MjlExpense::STATUS_CORRECTED.', '.MjlExpense::STATUS_SUBMITTED.')';
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_expense_role_sql($targetUser, 'document');
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.max((int) $limit * 5, (int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$state = mjl_expense_evidence_state((int) $row['rowid'], (int) $row['evidence_entity'], $row['evidence_supporting_document']);
		if ($state === 'downloadable') {
			continue;
		}
		$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
			'type' => 'expense_missing_document',
			'severity' => $state === 'unavailable' ? 'Piece indisponible' : 'Piece manquante',
			'tone' => 'danger',
			'audience' => mjl_alerts_actor_label($targetUser),
			'expected_action' => $state === 'unavailable' ? 'Remplacer la piece justificative indisponible avant validation.' : 'Ajouter la piece justificative avant validation.',
			'sort_date' => $row['expense_date'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_over_budget(User $targetUser, $limit)
{
	global $db, $conf;

	$sql = 'SELECT e.rowid, e.entity AS evidence_entity, e.ref, e.description, e.expense_date, e.amount, e.prevalidated_amount, e.final_validated_amount, e.status, e.fk_user_creat, e.supporting_document AS evidence_supporting_document, p.ref AS project_ref, c.ref AS convention_ref, a.ref AS activity_ref, bl.revised_budget, COALESCE((SELECT SUM(CASE WHEN ex.status IN ('.mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses()).') AND ex.rowid <> e.rowid THEN '.mjl_expense_budget_amount_sql('ex').' ELSE 0 END) FROM '.$db->prefix().'mjlfinancement_expense ex WHERE ex.entity = e.entity AND ex.fk_budget_line = e.fk_budget_line), 0) AS spent_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line AND bl.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.MjlExpense::STATUS_DRAFT.', '.MjlExpense::STATUS_CORRECTED.', '.MjlExpense::STATUS_SUBMITTED.', '.MjlExpense::STATUS_PREVALIDATED.')';
	$sql .= ' AND '.mjl_alerts_expense_candidate_amount_sql('e').' > (COALESCE(bl.revised_budget, 0) - COALESCE((SELECT SUM(CASE WHEN ex2.status IN ('.mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses()).') AND ex2.rowid <> e.rowid THEN '.mjl_expense_budget_amount_sql('ex2').' ELSE 0 END) FROM '.$db->prefix().'mjlfinancement_expense ex2 WHERE ex2.entity = e.entity AND ex2.fk_budget_line = e.fk_budget_line), 0)) + 0.001';
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_expense_role_sql($targetUser, 'document');
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$candidate = mjl_alerts_expense_candidate_amount($row);
		$available = (float) $row['revised_budget'] - (float) $row['spent_amount'];
		$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
			'type' => 'expense_exceeds_budget',
			'severity' => 'Budget depasse',
			'tone' => 'danger',
			'audience' => mjl_alerts_actor_label($targetUser),
			'expected_action' => 'Reviser la depense ou la ligne budgetaire avant validation.',
			'sort_date' => $row['expense_date'],
			'meta_extra' => array(
				'Montant candidat' => price($candidate),
				'Solde disponible' => price($available),
			),
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_validated_not_disbursed(User $targetUser, $limit)
{
	global $conf;

	if (!mjl_scope_is_final_validator($targetUser) && !mjl_scope_is_platform_admin($targetUser)) {
		return array();
	}
	$sql = mjl_alerts_expense_base_sql();
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.MjlExpense::STATUS_VALIDATED.', '.MjlExpense::STATUS_FINAL_VALIDATED.')';
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
			'type' => 'expense_validated_not_disbursed',
			'severity' => 'Decaissement attendu',
			'tone' => 'warning',
			'audience' => 'Validateur definitif',
			'expected_action' => 'Enregistrer le decaissement si le paiement a ete effectue.',
			'sort_date' => $row['expense_date'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_base_sql()
{
	global $db;

	$sql = 'SELECT e.rowid, e.entity AS evidence_entity, e.ref, e.description, e.expense_date, e.amount, e.prevalidated_amount, e.final_validated_amount, e.status, e.fk_user_creat, e.supporting_document AS evidence_supporting_document, p.ref AS project_ref, c.ref AS convention_ref, a.ref AS activity_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	return $sql;
}

function mjl_alerts_finance_alerts(User $targetUser, $limit)
{
	$alerts = array();
	$alerts = array_merge($alerts, mjl_alerts_budget_consumption($targetUser, $limit));
	$alerts = array_merge($alerts, mjl_alerts_funding_envelope_near_end($targetUser, $limit));
	return $alerts;
}

function mjl_alerts_budget_consumption(User $targetUser, $limit)
{
	global $db, $conf;

	if (!mjl_workspace_can_access_reference_data($targetUser, 'budgetline')) {
		return array();
	}
	$sql = 'SELECT bl.rowid, bl.ref, bl.label, bl.revised_budget, p.ref AS project_ref, c.ref AS convention_ref, COALESCE(SUM('.mjl_finance_final_validated_amount_sql('e').'), 0) AS final_validated_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = bl.fk_project AND p.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.fk_budget_line = bl.rowid AND e.entity = bl.entity';
	$sql .= ' WHERE bl.entity = '.((int) $conf->entity);
	$sql .= ' AND bl.status = '.MjlBudgetLine::STATUS_ACTIVE;
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= ' GROUP BY bl.rowid, bl.ref, bl.label, bl.revised_budget, p.ref, c.ref';
	$sql .= ' HAVING bl.revised_budget > 0 AND (final_validated_amount / bl.revised_budget) >= 0.80';
	$sql .= ' ORDER BY (final_validated_amount / bl.revised_budget) DESC, bl.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$rate = ((float) $row['final_validated_amount'] / (float) $row['revised_budget']) * 100;
		$critical = $rate >= 95;
		$alerts[] = mjl_alerts_payload($targetUser, array(
			'type' => $critical ? 'budget_critical' : 'budget_warning',
			'domain' => 'finance',
			'object_type' => 'Ligne budgetaire',
			'object_id' => (int) $row['rowid'],
			'ref' => $row['ref'],
			'label' => $row['label'],
			'severity' => $critical ? 'Budget critique' : 'Budget sous surveillance',
			'tone' => $critical ? 'danger' : 'warning',
			'audience' => 'Validateur definitif',
			'expected_action' => 'Verifier la consommation finalisee de la ligne budgetaire.',
			'href' => '/custom/mjlfinancement/budgetlines.php?id='.((int) $row['rowid']),
			'sort_date' => sprintf('%010.2f', 100 - $rate),
			'meta' => array(
				'Projet' => $row['project_ref'],
				'Convention' => $row['convention_ref'],
				'Budget revise' => price($row['revised_budget']),
				'Consommation validee' => price($row['final_validated_amount']),
				'Taux' => round($rate, 2).'%',
			),
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_funding_envelope_near_end(User $targetUser, $limit)
{
	global $db, $conf;

	if (!mjl_workspace_can_access_reference_data($targetUser, 'convention')) {
		return array();
	}
	$sql = 'SELECT c.rowid, c.ref, c.title, c.date_end, p.ref AS project_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity);
	$sql .= ' AND c.status = '.MjlConvention::STATUS_ACTIVE;
	$sql .= " AND c.date_end IS NOT NULL AND c.date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	$sql .= " AND c.date_end >= '".$db->escape(date('Y-m-d'))."'";
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= ' ORDER BY c.date_end ASC, c.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_payload($targetUser, array(
			'type' => 'funding_envelope_near_end',
			'domain' => 'finance',
			'object_type' => 'Enveloppe de financement',
			'object_id' => (int) $row['rowid'],
			'ref' => $row['ref'],
			'label' => $row['title'],
			'severity' => 'Fin proche',
			'tone' => 'warning',
			'audience' => 'Validateur definitif',
			'expected_action' => 'Verifier la cloture ou la prolongation de l enveloppe.',
			'href' => '/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']),
			'sort_date' => $row['date_end'],
			'meta' => array(
				'Projet' => $row['project_ref'],
				'Date fin' => mjl_alerts_format_date($row['date_end']),
			),
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_payload(User $targetUser, $row, $options)
{
	$meta = array(
		'Projet' => $row['project_ref'],
		'Convention' => $row['convention_ref'],
		'Echeance' => mjl_alerts_format_date($row['date_end']),
		'Statut' => mjl_alerts_activity_status_label($row['status']),
	);
	if (!empty($options['meta_extra'])) {
		$meta = array_merge($meta, $options['meta_extra']);
	}
	return mjl_alerts_payload($targetUser, array(
		'type' => $options['type'],
		'domain' => 'activities',
		'object_type' => 'Activite',
		'object_id' => (int) $row['rowid'],
		'ref' => $row['ref'],
		'label' => $row['label'],
		'severity' => $options['severity'],
		'tone' => $options['tone'],
		'audience' => $options['audience'],
		'expected_action' => $options['expected_action'],
		'href' => '/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']),
		'sort_date' => $options['sort_date'],
		'meta' => $meta,
	));
}

function mjl_alerts_expense_payload(User $targetUser, $row, $options)
{
	$meta = array(
		'Projet' => $row['project_ref'],
		'Convention' => $row['convention_ref'],
		'Activite' => $row['activity_ref'],
		'Montant' => price($row['amount']),
		'Date depense' => mjl_alerts_format_date($row['expense_date']),
		'Statut' => mjl_alerts_expense_status_label($row['status']),
	);
	if (!empty($options['meta_extra'])) {
		$meta = array_merge($meta, $options['meta_extra']);
	}
	return mjl_alerts_payload($targetUser, array(
		'type' => $options['type'],
		'domain' => 'expenses',
		'object_type' => 'Depense',
		'object_id' => (int) $row['rowid'],
		'ref' => $row['ref'],
		'label' => $row['description'],
		'severity' => $options['severity'],
		'tone' => $options['tone'],
		'audience' => $options['audience'],
		'expected_action' => $options['expected_action'],
		'href' => '/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']),
		'sort_date' => $options['sort_date'],
		'meta' => $meta,
	));
}

function mjl_alerts_payload(User $targetUser, $alert)
{
	$defaults = array(
		'type' => '',
		'domain' => '',
		'object_type' => '',
		'object_id' => 0,
		'ref' => '',
		'label' => '',
		'severity' => 'A surveiller',
		'tone' => 'warning',
		'audience' => mjl_alerts_actor_label($targetUser),
		'expected_action' => '',
		'href' => '',
		'sort_date' => '',
		'meta' => array(),
	);
	return array_merge($defaults, $alert);
}

function mjl_alerts_filter_route_access(User $targetUser, $alerts)
{
	$filtered = array();
	foreach ($alerts as $alert) {
		if (mjl_alerts_user_can_open_alert($targetUser, $alert)) {
			$filtered[] = $alert;
		}
	}
	return $filtered;
}

function mjl_alerts_user_can_open_alert(User $targetUser, $alert)
{
	$domain = isset($alert['domain']) ? (string) $alert['domain'] : '';
	$id = isset($alert['object_id']) ? (int) $alert['object_id'] : 0;
	if ($id <= 0) {
		return false;
	}
	if ($domain === 'activities') {
		return mjl_workspace_can_access_activity($targetUser)
			&& mjl_alerts_can_open_activity_for_user($targetUser, $id);
	}
	if ($domain === 'expenses') {
		return mjl_workspace_can_access_expense($targetUser)
			&& mjl_alerts_can_open_expense_for_user($targetUser, $id);
	}
	if ($domain === 'finance' && $alert['object_type'] === 'Ligne budgetaire') {
		return mjl_workspace_can_access_reference_data($targetUser, 'budgetline')
			&& mjl_scope_can_access_object($targetUser, 'mjlfinancement_budget_line', $id);
	}
	if ($domain === 'finance' && $alert['object_type'] === 'Enveloppe de financement') {
		return mjl_workspace_can_access_reference_data($targetUser, 'convention')
			&& mjl_scope_can_access_object($targetUser, 'mjlfinancement_convention', $id);
	}
	return false;
}

function mjl_alerts_can_open_activity_for_user(User $targetUser, $activityId)
{
	global $user, $db, $conf;
	$previous = $user;
	$user = $targetUser;
	$row = mjl_alerts_fetch_one('SELECT rowid, fk_user_creat, fk_user_responsible, status FROM '.$db->prefix().'mjlfinancement_activity WHERE entity = '.((int) $conf->entity).' AND rowid = '.((int) $activityId));
	$canOpen = !empty($row) && mjl_activities_can_open($row);
	$user = $previous;
	return $canOpen;
}

function mjl_alerts_can_open_expense_for_user(User $targetUser, $expenseId)
{
	global $user, $db, $conf;
	$previous = $user;
	$user = $targetUser;
	$row = mjl_alerts_fetch_one('SELECT rowid, fk_user_creat, status FROM '.$db->prefix().'mjlfinancement_expense WHERE entity = '.((int) $conf->entity).' AND rowid = '.((int) $expenseId));
	$canOpen = !empty($row) && mjl_expenses_can_open($row);
	$user = $previous;
	return $canOpen;
}

function mjl_alerts_partner_scope_sql(User $targetUser, $partnerColumn)
{
	return mjl_scope_partner_sql_filter($partnerColumn, $targetUser);
}

function mjl_alerts_activity_role_sql(User $targetUser, $mode)
{
	if (mjl_scope_is_platform_admin($targetUser) || mjl_scope_is_final_validator($targetUser)) {
		return '';
	}
	if (mjl_scope_is_input_agent($targetUser)) {
		return ' AND (a.fk_user_creat = '.((int) $targetUser->id).' OR a.fk_user_responsible = '.((int) $targetUser->id).')';
	}
	if (mjl_scope_is_verifier($targetUser)) {
		return $mode === 'deadline' ? '' : ' AND a.fk_user_creat <> '.((int) $targetUser->id).' AND (a.fk_user_responsible IS NULL OR a.fk_user_responsible <> '.((int) $targetUser->id).')';
	}
	return '';
}

function mjl_alerts_expense_role_sql(User $targetUser, $mode)
{
	if (mjl_scope_is_platform_admin($targetUser) || mjl_scope_is_final_validator($targetUser)) {
		return '';
	}
	if (mjl_scope_is_input_agent($targetUser)) {
		return ' AND e.fk_user_creat = '.((int) $targetUser->id);
	}
	if (mjl_scope_is_verifier($targetUser)) {
		return $mode === 'review' ? ' AND e.fk_user_creat <> '.((int) $targetUser->id) : '';
	}
	return '';
}

function mjl_alerts_expense_candidate_amount_sql($alias)
{
	$alias = preg_replace('/[^A-Za-z0-9_]/', '', (string) $alias);
	return '(CASE WHEN '.$alias.'.status = '.MjlExpense::STATUS_PREVALIDATED.' THEN COALESCE('.$alias.'.prevalidated_amount, '.$alias.'.amount) ELSE '.$alias.'.amount END)';
}

function mjl_alerts_expense_candidate_amount($row)
{
	if ((int) $row['status'] === MjlExpense::STATUS_PREVALIDATED) {
		return (float) ($row['prevalidated_amount'] > 0 ? $row['prevalidated_amount'] : $row['amount']);
	}
	return (float) $row['amount'];
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

function mjl_alerts_actor_label(User $targetUser)
{
	if (mjl_scope_is_platform_admin($targetUser)) return 'Admin plateforme';
	if (mjl_scope_is_final_validator($targetUser)) return 'Validateur definitif';
	if (mjl_scope_is_verifier($targetUser)) return 'Agent verificateur';
	if (mjl_scope_is_input_agent($targetUser)) return 'Agent de saisie';
	return 'Utilisateur concerne';
}

function mjl_alerts_is_level1_operational(User $targetUser)
{
	return mjl_scope_is_input_agent($targetUser)
		&& (mjl_workspace_can_apply_activity_write($targetUser) || mjl_workspace_can_apply_expense_write($targetUser))
		&& !mjl_workspace_can_apply_activity_validation($targetUser)
		&& !mjl_workspace_can_apply_expense_validation($targetUser)
		&& !mjl_workspace_can_access_supervision($targetUser);
}

function mjl_alerts_audience_label(User $targetUser, $type)
{
	return mjl_alerts_actor_label($targetUser);
}

function mjl_alerts_sort($left, $right)
{
	$severityOrder = array(
		'En retard' => 0,
		'Budget depasse' => 1,
		'Budget critique' => 2,
		'Piece manquante' => 3,
		'Piece indisponible' => 4,
		'Correction demandee' => 5,
		'Decision attendue' => 6,
		'Decaissement attendu' => 7,
		'Execution a actualiser' => 8,
		'Echeance proche' => 9,
		'Budget sous surveillance' => 10,
		'Fin proche' => 11,
	);
	$leftRank = isset($severityOrder[$left['severity']]) ? $severityOrder[$left['severity']] : 99;
	$rightRank = isset($severityOrder[$right['severity']]) ? $severityOrder[$right['severity']] : 99;
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

function mjl_alerts_fetch_one($sql)
{
	$rows = mjl_alerts_fetch_rows($sql);
	return empty($rows) ? array() : $rows[0];
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
		MjlExpense::STATUS_VALIDATED => 'Validee legacy',
		MjlExpense::STATUS_CORRECTED => 'Corrigee',
		MjlExpense::STATUS_PREVALIDATED => 'Prevalidee',
		MjlExpense::STATUS_FINAL_VALIDATED => 'Validee definitivement',
		MjlExpense::STATUS_DISBURSED => 'Decaissee',
		MjlExpense::STATUS_REJECTED => 'Rejetee',
	);
	return isset($map[(int) $status]) ? $map[(int) $status] : (string) $status;
}
