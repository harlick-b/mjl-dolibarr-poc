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
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alert_condition.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alert_presentation.lib.php';

function mjl_alerts_user_can_read(User $targetUser)
{
	return mjl_workspace_can_access_activity($targetUser)
		|| mjl_workspace_can_access_expense($targetUser)
		|| mjl_workspace_can_access_reference_data($targetUser, 'budgetline')
		|| mjl_workspace_can_access_reference_data($targetUser, 'convention');
}

function mjl_alerts_for_user(User $targetUser, $limit = 100, $scope = 'all', $partnerId = 0)
{
	$result = mjl_alerts_result_for_user($targetUser, $limit, $scope, $partnerId);
	return $result['items'];
}

function mjl_alerts_result_for_user(User $targetUser, $limit = 100, $scope = 'all', $partnerId = 0)
{
	$result = mjl_alert_conditions_result_for_user($targetUser, $limit, $scope, $partnerId);
	$items = array();
	foreach ($result['items'] as $condition) $items[] = mjl_alert_present_condition($condition);
	return array('items' => $items, 'errors' => $result['errors']);
}

function mjl_alert_conditions_for_user(User $targetUser, $limit = 100, $scope = 'all', $partnerId = 0)
{
	$result = mjl_alert_conditions_result_for_user($targetUser, $limit, $scope, $partnerId);
	return $result['items'];
}

function mjl_alert_conditions_result_for_user(User $targetUser, $limit = 100, $scope = 'all', $partnerId = 0)
{
	$scope = mjl_alerts_normalize_scope($scope);
	$limit = max(1, (int) $limit);
	$partnerId = max(0, (int) $partnerId);
	if ($partnerId > 0 && !mjl_scope_can_access_fk_soc($targetUser, $partnerId)) return array('items' => array(), 'errors' => array());
	$GLOBALS['mjl_alerts_load_errors'] = array();
	$sources = array();

	if (($scope === 'all' || $scope === 'activities') && mjl_workspace_can_access_activity($targetUser)) {
		$sources[] = mjl_alerts_capture_source('activities', function () use ($targetUser, $limit, $partnerId) {
			return mjl_alerts_activity_alerts($targetUser, $limit, $partnerId);
		});
	}
	if (($scope === 'all' || $scope === 'expenses') && mjl_workspace_can_access_expense($targetUser)) {
		$sources[] = mjl_alerts_capture_source('expenses', function () use ($targetUser, $limit, $partnerId) {
			return mjl_alerts_expense_alerts($targetUser, $limit, $partnerId);
		});
	}
	if ($scope === 'all' || $scope === 'finance') {
		$sources[] = mjl_alerts_capture_source('finance', function () use ($targetUser, $limit, $partnerId) {
			return mjl_alerts_finance_alerts($targetUser, $limit, $partnerId);
		});
	}
	$alerts = array();
	$errors = array();
	foreach ($sources as $source) {
		$alerts = array_merge($alerts, $source['items']);
		foreach ($source['errors'] as $category) $errors[] = array('source' => $source['source'], 'category' => $category);
	}
	usort($alerts, 'mjl_alerts_sort');
	return array('items' => array_slice($alerts, 0, $limit), 'errors' => $errors);
}

function mjl_alerts_render_result($result)
{
	$alerts = (array) ($result['items'] ?? array());
	if (!empty($result['errors'])) {
		print mjl_ui_system_state('partial-error', 'Alertes partiellement disponibles', mjl_ui_safe_error_message('alerts'));
	}
	if (empty($alerts)) {
		print '<div class="mjl-empty-state">Aucune alerte active dans votre périmètre.</div>';
		return;
	}
	print '<div class="mjl-alert-grid">';
	foreach ($alerts as $alert) {
		mjl_alerts_render_card($alert);
	}
	print '</div>';
}

function mjl_alerts_render_card($alert)
{
	$tone = isset($alert['tone']) && in_array($alert['tone'], array('neutral', 'info', 'success', 'warning', 'danger'), true) ? $alert['tone'] : 'neutral';
	print '<article class="mjl-alert-card mjl-alert-'.$tone.'">';
	print '<div class="mjl-alert-card-main">';
	print '<span class="mjl-status-pill mjl-status-'.$tone.'">'.dol_escape_htmltag($alert['severity']).'</span>';
	print '<h3>'.dol_escape_htmltag($alert['object_type']).' '.dol_escape_htmltag($alert['ref']).'</h3>';
	print '<p>'.dol_escape_htmltag($alert['label']).'</p>';
	print '</div>';
	print '<dl class="mjl-alert-meta">';
	print '<div><dt>Acteur concerné</dt><dd>'.dol_escape_htmltag($alert['audience']).'</dd></div>';
	print '<div><dt>Action attendue</dt><dd>'.dol_escape_htmltag($alert['expected_action']).'</dd></div>';
	foreach ((array) ($alert['meta'] ?? array()) as $label => $value) {
		if ((string) $value === '') {
			continue;
		}
		print '<div><dt>'.dol_escape_htmltag($label).'</dt><dd>'.dol_escape_htmltag($value).'</dd></div>';
	}
	print '</dl>';
	if (mjl_safe_internal_path($alert['href']) !== '') print '<a class="mjl-card-link" href="'.mjl_dashboard_url($alert['href']).'">Ouvrir l’objet concerné</a>';
	print '</article>';
}

function mjl_alerts_capture_source($source, $loader)
{
	$before = count((array) ($GLOBALS['mjl_alerts_load_errors'] ?? array()));
	$items = call_user_func($loader);
	$allErrors = (array) ($GLOBALS['mjl_alerts_load_errors'] ?? array());
	$errors = array_slice($allErrors, $before);
	return array('source' => (string) $source, 'items' => $items, 'errors' => array_values(array_unique($errors)));
}

function mjl_alerts_count_for_user(User $targetUser, $scope = 'all')
{
	return count(mjl_alert_conditions_for_user($targetUser, 500, $scope));
}

function mjl_alert_condition_partner_overallocation(User $targetUser, array $partner)
{
	$partnerId = isset($partner['rowid']) ? (int) $partner['rowid'] : 0;
	$unallocated = isset($partner['unallocated_budget']) ? (float) $partner['unallocated_budget'] : 0.0;
	if ($partnerId <= 0 || $unallocated >= 0 || (!mjl_scope_is_final_validator($targetUser) && !mjl_scope_is_platform_admin($targetUser))) return array();
	$condition = mjl_alerts_payload($targetUser, array(
		'type' => 'partner_overallocated',
		'domain' => 'partners',
		'object_type' => 'societe',
		'object_id' => $partnerId,
		'partner_id' => $partnerId,
		'ref' => isset($partner['nom']) ? (string) $partner['nom'] : '',
		'label' => isset($partner['nom']) ? (string) $partner['nom'] : '',
		'sort_date' => '',
		'facts' => array('overallocation_amount' => abs($unallocated)),
	));
	return mjl_alerts_user_can_open_alert($targetUser, $condition) ? $condition : array();
}

function mjl_alerts_normalize_scope($scope)
{
	$scope = strtolower((string) $scope);
	return in_array($scope, array('all', 'activities', 'expenses', 'finance'), true) ? $scope : 'all';
}

function mjl_alerts_activity_alerts(User $targetUser, $limit, $partnerId = 0)
{
	$alerts = array();
	$alerts = array_merge($alerts, mjl_alerts_activity_deadlines($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_activity_pending_reviews($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_activity_corrections($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_activity_stale_execution($targetUser, $limit, $partnerId));
	return $alerts;
}

function mjl_alerts_activity_deadlines(User $targetUser, $limit, $partnerId = 0)
{
	global $db, $conf;

	$sql = mjl_alerts_activity_base_sql();
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status IN ('.implode(',', array_map('intval', MjlActivity::openStatuses())).')';
	$sql .= " AND a.date_end IS NOT NULL AND a.date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
	$sql .= mjl_alerts_activity_role_sql($targetUser, 'deadline');
	$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_activity_payload($targetUser, $row, array(
			'type' => mjl_alerts_deadline_is_overdue($row['date_end']) ? 'activity_overdue' : 'activity_deadline_soon',
			'sort_date' => $row['date_end'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_pending_reviews(User $targetUser, $limit, $partnerId = 0)
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
			'allowed' => mjl_scope_is_verifier($targetUser) || mjl_scope_is_platform_admin($targetUser),
		),
		array(
			'status' => MjlActivity::STATUS_PREVALIDATED,
			'type' => 'activity_awaiting_final_validation',
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
		$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
		$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);
		foreach (mjl_alerts_fetch_rows($sql) as $row) {
			$alerts[] = mjl_alerts_activity_payload($targetUser, $row, array(
				'type' => $config['type'],
				'sort_date' => $row['date_end'],
			));
		}
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_corrections(User $targetUser, $limit, $partnerId = 0)
{
	global $conf;

	$sql = mjl_alerts_activity_base_sql();
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status = '.MjlActivity::STATUS_CORRECTION_REQUESTED;
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
	$sql .= ' AND (a.fk_user_creat = '.((int) $targetUser->id).' OR a.fk_user_responsible = '.((int) $targetUser->id).')';
	$sql .= ' ORDER BY a.date_end ASC, a.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_activity_payload($targetUser, $row, array(
			'type' => 'activity_returned_for_correction',
			'sort_date' => $row['date_end'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_stale_execution(User $targetUser, $limit, $partnerId = 0)
{
	global $db, $conf;

	$sql = 'SELECT a.rowid, a.ref, a.label, a.date_end, a.status, a.fk_user_creat, a.fk_user_responsible, c.fk_soc AS partner_id, p.ref AS project_ref, c.ref AS convention_ref, COALESCE((SELECT MAX(w.action_date) FROM '.$db->prefix().'mjlfinancement_workflow_action w WHERE w.entity = a.entity AND w.object_type = \'mjlfinancement_activity\' AND w.object_id = a.rowid AND w.action = \'execution_updated\'), a.date_creation) AS last_execution_update';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status IN ('.implode(',', array_map('intval', MjlActivity::executionEditableStatuses())).')';
	$sql .= " AND COALESCE((SELECT MAX(w2.action_date) FROM ".$db->prefix()."mjlfinancement_workflow_action w2 WHERE w2.entity = a.entity AND w2.object_type = 'mjlfinancement_activity' AND w2.object_id = a.rowid AND w2.action = 'execution_updated'), a.date_creation) < '".$db->escape(date('Y-m-d H:i:s', strtotime('-14 days')))."'";
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
	$sql .= mjl_alerts_activity_role_sql($targetUser, 'correction');
	$sql .= ' ORDER BY last_execution_update ASC, a.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_activity_payload($targetUser, $row, array(
			'type' => 'activity_stale_execution',
			'sort_date' => $row['last_execution_update'],
			'facts_extra' => array('last_execution_update' => $row['last_execution_update']),
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_base_sql()
{
	global $db;

	$sql = 'SELECT a.rowid, a.ref, a.label, a.date_end, a.status, a.fk_user_creat, a.fk_user_responsible, c.fk_soc AS partner_id, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	return $sql;
}

function mjl_alerts_expense_alerts(User $targetUser, $limit, $partnerId = 0)
{
	$alerts = array();
	$alerts = array_merge($alerts, mjl_alerts_expense_pending_reviews($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_expense_corrections($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_expense_missing_documents($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_expense_over_budget($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_expense_validated_not_disbursed($targetUser, $limit, $partnerId));
	return $alerts;
}

function mjl_alerts_expense_pending_reviews(User $targetUser, $limit, $partnerId = 0)
{
	global $conf;

	if (!mjl_scope_is_verifier($targetUser) && !mjl_scope_is_final_validator($targetUser) && !mjl_scope_is_platform_admin($targetUser)) {
		return array();
	}

	$configs = array(
		array(
			'status' => MjlExpense::STATUS_SUBMITTED,
			'type' => 'expense_awaiting_prevalidation',
			'allowed' => mjl_scope_is_verifier($targetUser) || mjl_scope_is_platform_admin($targetUser),
		),
		array(
			'status' => MjlExpense::STATUS_PREVALIDATED,
			'type' => 'expense_awaiting_final_validation',
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
		$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
		$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.((int) $limit);
		foreach (mjl_alerts_fetch_rows($sql) as $row) {
			$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
				'type' => $config['type'],
				'sort_date' => $row['expense_date'],
			));
		}
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_corrections(User $targetUser, $limit, $partnerId = 0)
{
	global $conf;

	$sql = mjl_alerts_expense_base_sql();
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status = '.MjlExpense::STATUS_REJECTED;
	$sql .= ' AND e.fk_user_creat = '.((int) $targetUser->id);
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
			'type' => 'expense_returned_for_correction',
			'sort_date' => $row['expense_date'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_missing_documents(User $targetUser, $limit, $partnerId = 0)
{
	global $conf;

	$sql = mjl_alerts_expense_base_sql();
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.MjlExpense::STATUS_DRAFT.', '.MjlExpense::STATUS_CORRECTED.', '.MjlExpense::STATUS_SUBMITTED.')';
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
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
			'document_state' => $state,
			'sort_date' => $row['expense_date'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_over_budget(User $targetUser, $limit, $partnerId = 0)
{
	global $db, $conf;

	$sql = 'SELECT e.rowid, e.entity AS evidence_entity, e.ref, e.description, e.expense_date, e.amount, e.prevalidated_amount, e.final_validated_amount, e.status, e.fk_user_creat, e.supporting_document AS evidence_supporting_document, c.fk_soc AS partner_id, p.ref AS project_ref, c.ref AS convention_ref, a.ref AS activity_ref, bl.revised_budget, COALESCE((SELECT SUM(CASE WHEN ex.status IN ('.mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses()).') AND ex.rowid <> e.rowid THEN '.mjl_expense_budget_amount_sql('ex').' ELSE 0 END) FROM '.$db->prefix().'mjlfinancement_expense ex WHERE ex.entity = e.entity AND ex.fk_budget_line = e.fk_budget_line), 0) AS spent_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line AND bl.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.MjlExpense::STATUS_DRAFT.', '.MjlExpense::STATUS_CORRECTED.', '.MjlExpense::STATUS_SUBMITTED.', '.MjlExpense::STATUS_PREVALIDATED.')';
	$sql .= ' AND '.mjl_alerts_expense_candidate_amount_sql('e').' > (COALESCE(bl.revised_budget, 0) - COALESCE((SELECT SUM(CASE WHEN ex2.status IN ('.mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses()).') AND ex2.rowid <> e.rowid THEN '.mjl_expense_budget_amount_sql('ex2').' ELSE 0 END) FROM '.$db->prefix().'mjlfinancement_expense ex2 WHERE ex2.entity = e.entity AND ex2.fk_budget_line = e.fk_budget_line), 0)) + 0.001';
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
	$sql .= mjl_alerts_expense_role_sql($targetUser, 'document');
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$candidate = mjl_alerts_expense_candidate_amount($row);
		$available = (float) $row['revised_budget'] - (float) $row['spent_amount'];
		$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
			'type' => 'expense_exceeds_budget',
			'sort_date' => $row['expense_date'],
			'facts_extra' => array(
				'candidate_amount' => $candidate,
				'available_amount' => $available,
			),
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_validated_not_disbursed(User $targetUser, $limit, $partnerId = 0)
{
	global $conf;

	if (!mjl_scope_is_final_validator($targetUser) && !mjl_scope_is_platform_admin($targetUser)) {
		return array();
	}
	$sql = mjl_alerts_expense_base_sql();
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.MjlExpense::STATUS_VALIDATED.', '.MjlExpense::STATUS_FINAL_VALIDATED.')';
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
	$sql .= ' ORDER BY e.expense_date ASC, e.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_expense_payload($targetUser, $row, array(
			'type' => 'expense_validated_not_disbursed',
			'sort_date' => $row['expense_date'],
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_expense_base_sql()
{
	global $db;

	$sql = 'SELECT e.rowid, e.entity AS evidence_entity, e.ref, e.description, e.expense_date, e.amount, e.prevalidated_amount, e.final_validated_amount, e.status, e.fk_user_creat, e.supporting_document AS evidence_supporting_document, c.fk_soc AS partner_id, p.ref AS project_ref, c.ref AS convention_ref, a.ref AS activity_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	return $sql;
}

function mjl_alerts_finance_alerts(User $targetUser, $limit, $partnerId = 0)
{
	$alerts = array();
	$alerts = array_merge($alerts, mjl_alerts_budget_consumption($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_funding_envelope_near_end($targetUser, $limit, $partnerId));
	$alerts = array_merge($alerts, mjl_alerts_partner_overallocations($targetUser, $limit, $partnerId));
	return $alerts;
}

function mjl_alerts_partner_overallocations(User $targetUser, $limit, $partnerId = 0)
{
	global $db, $conf;
	if (!mjl_scope_is_final_validator($targetUser) && !mjl_scope_is_platform_admin($targetUser)) return array();
	$sql = 'SELECT s.rowid, s.nom,';
	$sql .= ' (COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = s.entity AND fr.fk_soc = s.rowid AND fr.status = 1), 0)';
	$sql .= ' - COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0)) AS unallocated_budget';
	$sql .= ' FROM '.$db->prefix().'societe s WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1';
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 's.rowid');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 's.rowid');
	$sql .= ' HAVING unallocated_budget < 0 ORDER BY unallocated_budget ASC, s.nom ASC LIMIT '.((int) $limit);
	$conditions = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$condition = mjl_alert_condition_partner_overallocation($targetUser, $row);
		if (!empty($condition)) $conditions[] = $condition;
	}
	return $conditions;
}

function mjl_alerts_budget_consumption(User $targetUser, $limit, $partnerId = 0)
{
	global $db, $conf;

	if (!mjl_workspace_can_access_reference_data($targetUser, 'budgetline')) {
		return array();
	}
	$sql = 'SELECT bl.rowid, bl.ref, bl.label, bl.revised_budget, c.fk_soc AS partner_id, p.ref AS project_ref, c.ref AS convention_ref, COALESCE(SUM('.mjl_finance_final_validated_amount_sql('e').'), 0) AS final_validated_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = bl.fk_project AND p.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.fk_budget_line = bl.rowid AND e.entity = bl.entity';
	$sql .= ' WHERE bl.entity = '.((int) $conf->entity);
	$sql .= ' AND bl.status = '.MjlBudgetLine::STATUS_ACTIVE;
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
	$sql .= ' GROUP BY bl.rowid, bl.ref, bl.label, bl.revised_budget, c.fk_soc, p.ref, c.ref';
	$sql .= ' HAVING bl.revised_budget > 0 AND (final_validated_amount / bl.revised_budget) >= 0.80';
	$sql .= ' ORDER BY (final_validated_amount / bl.revised_budget) DESC, bl.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$rate = ((float) $row['final_validated_amount'] / (float) $row['revised_budget']) * 100;
		$critical = $rate >= 95;
		$alerts[] = mjl_alerts_payload($targetUser, array(
			'type' => $critical ? 'budget_critical' : 'budget_warning',
			'domain' => 'finance',
			'object_type' => 'mjlfinancement_budget_line',
			'object_id' => (int) $row['rowid'],
			'partner_id' => (int) $row['partner_id'],
			'ref' => $row['ref'],
			'label' => $row['label'],
			'sort_date' => sprintf('%010.2f', 100 - $rate),
			'facts' => array(
				'project_reference' => $row['project_ref'],
				'envelope_reference' => $row['convention_ref'],
				'revised_budget' => (float) $row['revised_budget'],
				'validated_amount' => (float) $row['final_validated_amount'],
				'rate' => $rate,
			),
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_funding_envelope_near_end(User $targetUser, $limit, $partnerId = 0)
{
	global $db, $conf;

	if (!mjl_workspace_can_access_reference_data($targetUser, 'convention')) {
		return array();
	}
	$sql = 'SELECT c.rowid, c.ref, c.title, c.date_end, c.fk_soc AS partner_id, p.ref AS project_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity);
	$sql .= ' AND c.status = '.MjlConvention::STATUS_ACTIVE;
	$sql .= " AND c.date_end IS NOT NULL AND c.date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	$sql .= " AND c.date_end >= '".$db->escape(date('Y-m-d'))."'";
	$sql .= mjl_alerts_partner_scope_sql($targetUser, 'c.fk_soc');
	$sql .= mjl_alerts_partner_filter_sql($partnerId, 'c.fk_soc');
	$sql .= ' ORDER BY c.date_end ASC, c.ref ASC LIMIT '.((int) $limit);

	$alerts = array();
	foreach (mjl_alerts_fetch_rows($sql) as $row) {
		$alerts[] = mjl_alerts_payload($targetUser, array(
			'type' => 'funding_envelope_near_end',
			'domain' => 'finance',
			'object_type' => 'mjlfinancement_convention',
			'object_id' => (int) $row['rowid'],
			'partner_id' => (int) $row['partner_id'],
			'ref' => $row['ref'],
			'label' => $row['title'],
			'sort_date' => $row['date_end'],
			'facts' => array(
				'project_reference' => $row['project_ref'],
				'deadline' => $row['date_end'],
			),
		));
	}
	return mjl_alerts_filter_route_access($targetUser, $alerts);
}

function mjl_alerts_activity_payload(User $targetUser, $row, $options)
{
	$facts = array(
		'project_reference' => $row['project_ref'],
		'envelope_reference' => $row['convention_ref'],
		'deadline' => $row['date_end'],
	);
	if (!empty($options['facts_extra'])) {
		$facts = array_merge($facts, $options['facts_extra']);
	}
	return mjl_alerts_payload($targetUser, array(
		'type' => $options['type'],
		'domain' => 'activities',
		'object_type' => 'mjlfinancement_activity',
		'object_id' => (int) $row['rowid'],
		'partner_id' => (int) $row['partner_id'],
		'ref' => $row['ref'],
		'label' => $row['label'],
		'status_code' => (int) $row['status'],
		'sort_date' => $options['sort_date'],
		'facts' => $facts,
	));
}

function mjl_alerts_expense_payload(User $targetUser, $row, $options)
{
	$facts = array(
		'project_reference' => $row['project_ref'],
		'envelope_reference' => $row['convention_ref'],
		'activity_reference' => $row['activity_ref'],
		'amount' => (float) $row['amount'],
		'expense_date' => $row['expense_date'],
	);
	if (!empty($options['facts_extra'])) {
		$facts = array_merge($facts, $options['facts_extra']);
	}
	if (isset($options['document_state'])) $facts['document_state'] = (string) $options['document_state'];
	return mjl_alerts_payload($targetUser, array(
		'type' => $options['type'],
		'domain' => 'expenses',
		'object_type' => 'mjlfinancement_expense',
		'object_id' => (int) $row['rowid'],
		'partner_id' => (int) $row['partner_id'],
		'ref' => $row['ref'],
		'label' => $row['description'],
		'status_code' => (int) $row['status'],
		'sort_date' => $options['sort_date'],
		'facts' => $facts,
	));
}

function mjl_alerts_payload(User $targetUser, $alert)
{
	$defaults = array(
		'type' => '',
		'domain' => '',
		'object_type' => '',
		'object_id' => 0,
		'partner_id' => 0,
		'ref' => '',
		'label' => '',
		'status_code' => null,
		'sort_date' => '',
		'facts' => array(),
	);
	$payload = array_merge($defaults, $alert);
	$definition = mjl_alert_presentation_registry();
	$semanticKey = (string) $payload['type'];
	return mjl_alert_condition(array(
		'semantic_key' => $semanticKey,
		'domain' => (string) $payload['domain'],
		'object_type' => (string) $payload['object_type'],
		'object_id' => (int) $payload['object_id'],
		'partner_id' => (int) $payload['partner_id'],
		'reference' => (string) $payload['ref'],
		'domain_label' => (string) $payload['label'],
		'status_code' => $payload['status_code'],
		'sort_date' => (string) $payload['sort_date'],
		'priority' => isset($definition[$semanticKey]['priority']) ? (int) $definition[$semanticKey]['priority'] : 999,
		'dynamic_actor_role_key' => isset($payload['dynamic_actor_role_key']) ? (string) $payload['dynamic_actor_role_key'] : '',
		'facts' => (array) $payload['facts'],
	));
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
	if ($domain === 'finance' && $alert['object_type'] === 'mjlfinancement_budget_line') {
		return mjl_workspace_can_access_reference_data($targetUser, 'budgetline')
			&& mjl_scope_can_access_object($targetUser, 'mjlfinancement_budget_line', $id);
	}
	if ($domain === 'finance' && $alert['object_type'] === 'mjlfinancement_convention') {
		return mjl_workspace_can_access_reference_data($targetUser, 'convention')
			&& mjl_scope_can_access_object($targetUser, 'mjlfinancement_convention', $id);
	}
	if ($domain === 'partners' && $alert['object_type'] === 'societe') {
		return (mjl_scope_is_final_validator($targetUser) || mjl_scope_is_platform_admin($targetUser))
			&& mjl_scope_can_access_fk_soc($targetUser, $id);
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

function mjl_alerts_partner_filter_sql($partnerId, $partnerColumn)
{
	$partnerId = (int) $partnerId;
	return $partnerId > 0 ? ' AND '.$partnerColumn.' = '.$partnerId : '';
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

function mjl_alerts_deadline_is_overdue($dateEnd)
{
	$end = strtotime((string) $dateEnd);
	$today = strtotime(date('Y-m-d'));
	return $end > 0 && $end < $today;
}

function mjl_alerts_format_date($value)
{
	return mjl_format_date($value, 'date', 'Non renseigné');
}

function mjl_alerts_actor_label(User $targetUser)
{
	if (mjl_scope_is_platform_admin($targetUser)) return 'Administrateur plateforme';
	if (mjl_scope_is_final_validator($targetUser)) return 'Validateur définitif';
	if (mjl_scope_is_verifier($targetUser)) return 'Agent vérificateur et prévalidateur';
	if (mjl_scope_is_input_agent($targetUser)) return 'Agent de saisie';
	return 'Utilisateur concerné';
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
	$leftRank = isset($left['priority']) ? (int) $left['priority'] : 999;
	$rightRank = isset($right['priority']) ? (int) $right['priority'] : 999;
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
		if (!isset($GLOBALS['mjl_alerts_load_errors'])) $GLOBALS['mjl_alerts_load_errors'] = array();
		$GLOBALS['mjl_alerts_load_errors'][] = 'database';
		$entity = isset($GLOBALS['conf']->entity) ? (int) $GLOBALS['conf']->entity : 0;
		$userId = isset($GLOBALS['user']->id) ? (int) $GLOBALS['user']->id : 0;
		mjl_ui_log_error('database', array('route' => 'alerts', 'action' => 'load_source', 'entity' => $entity, 'user_id' => $userId), $db->lasterror());
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
	return mjl_ui_activity_status($status)['label'];
}

function mjl_alerts_expense_status_label($status)
{
	return mjl_ui_expense_status($status)['label'];
}
