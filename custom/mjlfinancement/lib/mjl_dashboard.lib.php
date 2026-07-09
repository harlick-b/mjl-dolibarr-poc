<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlfundreceipt.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alerts.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_metrics.lib.php';
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
	return mjl_dashboard_workspace_metrics_filtered(null);
}

function mjl_dashboard_workspace_metrics_filtered($filters = null)
{
	return array(
		'deadline_risks' => mjl_dashboard_deadline_risk_count($filters),
		'missing_expense_documents' => mjl_dashboard_missing_expense_document_count($filters),
		'pending_reviews' => mjl_dashboard_pending_review_count($filters),
		'physical_execution_percent' => mjl_dashboard_physical_execution_percent($filters),
	);
}

function mjl_dashboard_filters_from_request(User $targetUser)
{
	return mjl_dashboard_normalize_filters(array(
		'fk_soc' => GETPOSTINT('fk_soc'),
		'fk_project' => GETPOSTINT('fk_project'),
		'date_start' => GETPOST('date_start', 'alphanohtml'),
		'date_end' => GETPOST('date_end', 'alphanohtml'),
		'status_bucket' => GETPOST('status_bucket', 'alphanohtml'),
	), $targetUser);
}

function mjl_dashboard_default_filters()
{
	return array(
		'fk_soc' => 0,
		'fk_project' => 0,
		'date_start' => '',
		'date_end' => '',
		'status_bucket' => 'all',
		'invalid' => false,
		'invalid_reasons' => array(),
	);
}

function mjl_dashboard_normalize_filters(array $raw, User $targetUser)
{
	global $db, $conf;

	$filters = mjl_dashboard_default_filters();
	$filters['fk_soc'] = max(0, (int) (isset($raw['fk_soc']) ? $raw['fk_soc'] : 0));
	$filters['fk_project'] = max(0, (int) (isset($raw['fk_project']) ? $raw['fk_project'] : 0));
	$filters['date_start'] = mjl_dashboard_valid_date(isset($raw['date_start']) ? $raw['date_start'] : '');
	$filters['date_end'] = mjl_dashboard_valid_date(isset($raw['date_end']) ? $raw['date_end'] : '');
	$filters['status_bucket'] = mjl_dashboard_valid_status_bucket(isset($raw['status_bucket']) ? $raw['status_bucket'] : 'all');
	$filters['invalid_reasons'] = array();

	$rawDateStart = trim((string) (isset($raw['date_start']) ? $raw['date_start'] : ''));
	$rawDateEnd = trim((string) (isset($raw['date_end']) ? $raw['date_end'] : ''));
	if (($rawDateStart !== '' && $filters['date_start'] === '') || ($rawDateEnd !== '' && $filters['date_end'] === '')) {
		$filters['invalid_reasons'][] = 'Date invalide.';
	}
	if ($filters['date_start'] !== '' && $filters['date_end'] !== '' && $filters['date_start'] > $filters['date_end']) {
		$filters['invalid_reasons'][] = 'Période invalide.';
	}
	if ($filters['fk_soc'] > 0 && !mjl_scope_can_access_fk_soc($targetUser, $filters['fk_soc'], (int) $conf->entity)) {
		$filters['invalid_reasons'][] = 'Partenaire / Programme hors périmètre.';
	}
	if ($filters['fk_project'] > 0 && !mjl_scope_can_access_object($targetUser, 'project', $filters['fk_project'], (int) $conf->entity)) {
		$filters['invalid_reasons'][] = 'Projet hors périmètre.';
	}
	if ($filters['fk_project'] > 0 && $filters['fk_soc'] > 0) {
		$sql = 'SELECT rowid FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' AND rowid = '.$filters['fk_project'].' AND fk_soc = '.$filters['fk_soc'];
		if ((int) mjl_dashboard_scalar($sql, 'rowid') <= 0) {
			$filters['invalid_reasons'][] = 'Projet incompatible avec le Partenaire / Programme sélectionné.';
		}
	}
	$filters['invalid'] = !empty($filters['invalid_reasons']);
	return $filters;
}

function mjl_dashboard_valid_date($value)
{
	$value = trim((string) $value);
	if ($value === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
		return '';
	}
	$parts = explode('-', $value);
	return checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0]) ? $value : '';
}

function mjl_dashboard_status_bucket_options()
{
	return array(
		'all' => 'Tous les statuts',
		'to_prevalidate' => 'À prévalider',
		'to_final_validate' => 'À valider définitivement',
		'to_disburse' => 'À décaisser',
		'correction' => 'Corrections',
		'overdue' => 'En retard',
	);
}

function mjl_dashboard_valid_status_bucket($value)
{
	$value = (string) $value;
	$options = mjl_dashboard_status_bucket_options();
	return isset($options[$value]) ? $value : 'all';
}

function mjl_dashboard_render_filters(array $filters, $action)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Filtres tableau de bord</h2><p>Les indicateurs, files et lignes affichées restent limités à l’entité active et au périmètre autorisé.</p></div>';
	if (!empty($filters['invalid_reasons'])) {
		print '<div class="mjl-empty-state mjl-empty-state-warning">'.dol_escape_htmltag(implode(' ', $filters['invalid_reasons'])).'</div>';
	}
	print '<form class="mjl-report-filter-bar" method="GET" action="'.dol_escape_htmltag($action).'">';
	print '<label>Partenaire / Programme'.mjl_dashboard_select('fk_soc', mjl_dashboard_partner_options(), $filters['fk_soc'], 'Tous les périmètres').'</label>';
	print '<label>Projet'.mjl_dashboard_select('fk_project', mjl_dashboard_project_options($filters), $filters['fk_project'], 'Tous les projets').'</label>';
	print '<label>Période début<input type="date" name="date_start" value="'.dol_escape_htmltag($filters['date_start']).'"></label>';
	print '<label>Période fin<input type="date" name="date_end" value="'.dol_escape_htmltag($filters['date_end']).'"></label>';
	print '<label>Statut'.mjl_dashboard_status_bucket_select($filters['status_bucket']).'</label>';
	print '<div class="mjl-report-filter-actions"><input class="button" type="submit" value="Afficher"><a class="button button-cancel" href="'.dol_escape_htmltag($action).'">Réinitialiser</a></div>';
	print '</form>';
	print '<div class="mjl-report-active-filters"><strong>Filtres actifs</strong><span>'.dol_escape_htmltag(mjl_dashboard_filter_summary($filters)).'</span></div>';
	print '</section>';
}

function mjl_dashboard_partner_options()
{
	global $db, $conf, $user;

	$options = array();
	$sql = 'SELECT rowid, nom FROM '.$db->prefix().'societe WHERE entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('rowid', $user).' ORDER BY nom';
	foreach (mjl_dashboard_fetch_rows($sql) as $row) {
		$options[(int) $row['rowid']] = $row['nom'];
	}
	return $options;
}

function mjl_dashboard_project_options(array $filters)
{
	global $db, $conf, $user;

	$options = array();
	if (!empty($filters['invalid'])) {
		return $options;
	}
	$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('fk_soc', $user);
	if (!empty($filters['fk_soc'])) {
		$sql .= ' AND fk_soc = '.((int) $filters['fk_soc']);
	}
	$sql .= ' ORDER BY ref';
	foreach (mjl_dashboard_fetch_rows($sql) as $row) {
		$options[(int) $row['rowid']] = $row['ref'].' - '.$row['title'];
	}
	return $options;
}

function mjl_dashboard_select($name, array $options, $selected, $emptyLabel)
{
	$html = '<select name="'.dol_escape_htmltag($name).'">';
	$html .= '<option value="0">'.dol_escape_htmltag($emptyLabel).'</option>';
	foreach ($options as $value => $label) {
		$html .= '<option value="'.((int) $value).'"'.((int) $selected === (int) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_dashboard_status_bucket_select($selected)
{
	$html = '<select name="status_bucket">';
	foreach (mjl_dashboard_status_bucket_options() as $value => $label) {
		$html .= '<option value="'.dol_escape_htmltag($value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_dashboard_filter_summary(array $filters)
{
	$parts = array();
	if (!empty($filters['fk_soc'])) {
		$options = mjl_dashboard_partner_options();
		$parts[] = 'Partenaire / Programme: '.(isset($options[$filters['fk_soc']]) ? $options[$filters['fk_soc']] : '#'.$filters['fk_soc']);
	}
	if (!empty($filters['fk_project'])) {
		$options = mjl_dashboard_project_options($filters);
		$parts[] = 'Projet: '.(isset($options[$filters['fk_project']]) ? $options[$filters['fk_project']] : '#'.$filters['fk_project']);
	}
	if ($filters['date_start'] !== '') {
		$parts[] = 'Début: '.$filters['date_start'];
	}
	if ($filters['date_end'] !== '') {
		$parts[] = 'Fin: '.$filters['date_end'];
	}
	$statusOptions = mjl_dashboard_status_bucket_options();
	if ($filters['status_bucket'] !== 'all') {
		$parts[] = 'Statut: '.$statusOptions[$filters['status_bucket']];
	}
	return empty($parts) ? 'Aucun filtre.' : implode(' ; ', $parts);
}

function mjl_dashboard_invalid_filter_sql(array $filters)
{
	return !empty($filters['invalid']) ? ' AND 1=0' : '';
}

function mjl_dashboard_partner_filter_sql($column, $filters = null)
{
	global $user;

	$filters = mjl_dashboard_filters_or_default($filters);
	$sql = mjl_dashboard_invalid_filter_sql($filters);
	$sql .= mjl_scope_partner_sql_filter($column, $user);
	if (!empty($filters['fk_soc'])) {
		$sql .= ' AND '.mjl_scope_sanitized_sql_identifier($column).' = '.((int) $filters['fk_soc']);
	}
	return $sql;
}

function mjl_dashboard_project_filter_sql($column, $filters = null)
{
	$filters = mjl_dashboard_filters_or_default($filters);
	if (!empty($filters['invalid'])) {
		return ' AND 1=0';
	}
	if (!empty($filters['fk_project'])) {
		return ' AND '.mjl_scope_sanitized_sql_identifier($column).' = '.((int) $filters['fk_project']);
	}
	return '';
}

function mjl_dashboard_date_filter_sql($column, $filters = null, $datetime = false)
{
	global $db;

	$filters = mjl_dashboard_filters_or_default($filters);
	$column = mjl_scope_sanitized_sql_identifier($column);
	$sql = '';
	if ($filters['date_start'] !== '') {
		$sql .= " AND ".$column." >= '".$db->escape($filters['date_start'].($datetime ? ' 00:00:00' : ''))."'";
	}
	if ($filters['date_end'] !== '') {
		$sql .= " AND ".$column." <= '".$db->escape($filters['date_end'].($datetime ? ' 23:59:59' : ''))."'";
	}
	return $sql;
}

function mjl_dashboard_activity_status_filter_sql($alias, $filters = null)
{
	global $db;

	$filters = mjl_dashboard_filters_or_default($filters);
	$alias = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	$bucket = $filters['status_bucket'];
	if ($bucket === 'to_prevalidate') {
		return ' AND '.$alias.'.status IN ('.implode(',', array_map('intval', MjlActivity::verifierReviewStatuses())).')';
	}
	if ($bucket === 'to_final_validate') {
		return ' AND '.$alias.'.status IN ('.implode(',', array_map('intval', MjlActivity::finalReviewStatuses())).')';
	}
	if ($bucket === 'to_disburse') {
		return ' AND 1=0';
	}
	if ($bucket === 'correction') {
		return ' AND '.$alias.'.status IN ('.MjlActivity::STATUS_CORRECTION_REQUESTED.', '.MjlActivity::STATUS_CORRECTED.')';
	}
	if ($bucket === 'overdue') {
		return ' AND '.$alias.'.status IN ('.implode(',', array_map('intval', MjlActivity::openStatuses())).") AND ".$alias.".date_end IS NOT NULL AND ".$alias.".date_end < '".$db->escape(date('Y-m-d'))."'";
	}
	return '';
}

function mjl_dashboard_expense_status_filter_sql($alias, $filters = null)
{
	$filters = mjl_dashboard_filters_or_default($filters);
	$alias = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	$bucket = $filters['status_bucket'];
	if ($bucket === 'to_prevalidate') {
		return ' AND '.$alias.'.status IN ('.mjl_expense_status_sql_list(mjl_expense_pending_verifier_statuses()).')';
	}
	if ($bucket === 'to_final_validate') {
		return ' AND '.$alias.'.status IN ('.mjl_expense_status_sql_list(mjl_expense_pending_final_validator_statuses()).')';
	}
	if ($bucket === 'to_disburse') {
		return ' AND '.$alias.'.status IN ('.MjlExpense::STATUS_VALIDATED.', '.MjlExpense::STATUS_FINAL_VALIDATED.')';
	}
	if ($bucket === 'correction') {
		return ' AND '.$alias.'.status IN ('.MjlExpense::STATUS_REJECTED.', '.MjlExpense::STATUS_CORRECTED.')';
	}
	if ($bucket === 'overdue') {
		return ' AND 1=0';
	}
	return '';
}

function mjl_dashboard_filters_or_default($filters)
{
	return is_array($filters) ? $filters : mjl_dashboard_default_filters();
}

function mjl_dashboard_dpaf_kpis()
{
	return mjl_dashboard_supervision_kpis(null);
}

function mjl_dashboard_supervision_kpis($filters = null)
{
	return array(
		array('label' => 'Activites en cours', 'value' => mjl_dashboard_activity_count(array(MjlActivity::STATUS_ONGOING), $filters), 'context' => 'Activites ouvertes dans l entite active', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites'),
		array('label' => 'Activites en validation', 'value' => mjl_dashboard_activity_count(array(MjlActivity::STATUS_SUBMITTED, MjlActivity::STATUS_PREVALIDATED), $filters), 'context' => 'Dossiers en attente de prevalidation ou validation definitive', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Examiner'),
		array('label' => 'Execution physique', 'value' => mjl_dashboard_physical_execution_percent($filters).'%', 'context' => 'Moyenne des activites visibles avec avancement renseigne', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites'),
		array('label' => 'Depenses en validation', 'value' => mjl_dashboard_expense_count(array_merge(mjl_expense_pending_verifier_statuses(), mjl_expense_pending_final_validator_statuses()), $filters), 'context' => 'Depenses a controler ou valider definitivement', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Ouvrir les depenses'),
		array('label' => 'Budget revise', 'value' => price(mjl_dashboard_budget_total($filters)), 'context' => 'Total des lignes budgetaires', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Ouvrir les rapports'),
		array('label' => 'Depenses validees', 'value' => price(mjl_dashboard_validated_expense_total($filters)), 'context' => 'Montant deja valide', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Voir les exports'),
	);
}

function mjl_dashboard_deadline_risks($limit = 20, $filters = null)
{
	global $user;

	$alerts = mjl_alerts_activity_deadlines($user, 500);
	return array_slice(mjl_dashboard_filter_alerts($alerts, $filters), 0, (int) $limit);
}

function mjl_dashboard_filter_alerts(array $alerts, $filters = null)
{
	$filters = mjl_dashboard_filters_or_default($filters);
	if (empty($alerts)) {
		return $alerts;
	}
	$rows = array();
	foreach ($alerts as $alert) {
		if (mjl_dashboard_alert_matches_filters($alert, $filters)) $rows[] = $alert;
	}
	return $rows;
}

function mjl_dashboard_alert_matches_filters(array $alert, array $filters)
{
	if (!empty($filters['invalid'])) {
		return false;
	}
	$objectType = empty($alert['object_type']) ? '' : (string) $alert['object_type'];
	$objectType = mjl_dashboard_scope_object_type($objectType);
	$objectId = empty($alert['object_id']) ? 0 : (int) $alert['object_id'];
	if (!empty($filters['fk_soc'])) {
		$fkSoc = $objectType !== '' && $objectId > 0 ? mjl_scope_object_fk_soc($objectType, $objectId) : null;
		if ((int) $fkSoc !== (int) $filters['fk_soc']) {
			return false;
		}
	}
	if (!empty($filters['fk_project'])) {
		$fkProject = $objectType !== '' && $objectId > 0 ? mjl_dashboard_object_project_id($objectType, $objectId) : 0;
		if ((int) $fkProject !== (int) $filters['fk_project']) {
			return false;
		}
	}
	if ($filters['date_start'] !== '' && !empty($alert['sort_date']) && substr((string) $alert['sort_date'], 0, 10) < $filters['date_start']) {
		return false;
	}
	if ($filters['date_end'] !== '' && !empty($alert['sort_date']) && substr((string) $alert['sort_date'], 0, 10) > $filters['date_end']) {
		return false;
	}
	return true;
}

function mjl_dashboard_object_project_id($objectType, $objectId)
{
	global $db, $conf;

	$objectType = mjl_dashboard_scope_object_type($objectType);
	$objectId = (int) $objectId;
	if ($objectId <= 0) {
		return 0;
	}
	if ($objectType === 'mjlfinancement_project' || $objectType === 'project' || $objectType === 'projet') {
		return $objectId;
	}
	if ($objectType === 'mjlfinancement_activity') {
		return (int) mjl_dashboard_scalar('SELECT fk_project AS nb FROM '.$db->prefix().'mjlfinancement_activity WHERE entity = '.((int) $conf->entity).' AND rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_expense') {
		return (int) mjl_dashboard_scalar('SELECT fk_project AS nb FROM '.$db->prefix().'mjlfinancement_expense WHERE entity = '.((int) $conf->entity).' AND rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_convention') {
		return (int) mjl_dashboard_scalar('SELECT fk_project AS nb FROM '.$db->prefix().'mjlfinancement_convention WHERE entity = '.((int) $conf->entity).' AND rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_budget_line') {
		return (int) mjl_dashboard_scalar('SELECT fk_project AS nb FROM '.$db->prefix().'mjlfinancement_budget_line WHERE entity = '.((int) $conf->entity).' AND rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_fund_receipt') {
		return (int) mjl_dashboard_scalar('SELECT fk_project AS nb FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE entity = '.((int) $conf->entity).' AND rowid = '.$objectId);
	}
	return 0;
}

function mjl_dashboard_scope_object_type($objectType)
{
	$map = array(
		'Activite' => 'mjlfinancement_activity',
		'Activité' => 'mjlfinancement_activity',
		'Depense' => 'mjlfinancement_expense',
		'Dépense' => 'mjlfinancement_expense',
		'Ligne budgetaire' => 'mjlfinancement_budget_line',
		'Ligne budgétaire' => 'mjlfinancement_budget_line',
		'Enveloppe de financement' => 'mjlfinancement_convention',
		'Projet' => 'mjlfinancement_project',
	);
	$objectType = (string) $objectType;
	return isset($map[$objectType]) ? $map[$objectType] : $objectType;
}

function mjl_dashboard_pending_reviews($limit = 30, $filters = null)
{
	global $db, $conf;

	$activityStatuses = mjl_dashboard_pending_activity_statuses($filters);
	$expenseStatuses = mjl_dashboard_pending_expense_statuses($filters);
	if (empty($activityStatuses) && empty($expenseStatuses)) {
		return array();
	}
	$sql = 'SELECT \'Activite\' AS item_type, a.rowid AS item_id, a.ref, a.label, a.date_end AS item_date, 0 AS amount, \'/custom/mjlfinancement/activities.php\' AS href';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND '.(empty($activityStatuses) ? '1=0' : 'a.status IN ('.implode(',', array_map('intval', $activityStatuses)).')');
	$sql .= mjl_dashboard_partner_filter_sql('c.fk_soc', $filters);
	$sql .= mjl_dashboard_project_filter_sql('a.fk_project', $filters);
	$sql .= mjl_dashboard_date_filter_sql('a.date_end', $filters);
	$sql .= ' UNION ALL ';
	$sql .= 'SELECT \'Depense\' AS item_type, e.rowid AS item_id, e.ref, e.description AS label, e.expense_date AS item_date, e.amount, \'/custom/mjlfinancement/expenses.php\' AS href';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention ce ON ce.rowid = e.fk_convention AND ce.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity).' AND '.(empty($expenseStatuses) ? '1=0' : 'e.status IN ('.mjl_expense_status_sql_list($expenseStatuses).')');
	$sql .= mjl_dashboard_partner_filter_sql('ce.fk_soc', $filters);
	$sql .= mjl_dashboard_project_filter_sql('e.fk_project', $filters);
	$sql .= mjl_dashboard_date_filter_sql('e.expense_date', $filters);
	$sql .= ' ORDER BY item_date ASC, ref ASC LIMIT '.((int) $limit);
	return mjl_dashboard_fetch_rows($sql);
}

function mjl_dashboard_pending_activity_statuses($filters = null)
{
	global $user;

	$filters = mjl_dashboard_filters_or_default($filters);
	if ($filters['status_bucket'] !== 'all') {
		if ($filters['status_bucket'] === 'to_prevalidate') return MjlActivity::verifierReviewStatuses();
		if ($filters['status_bucket'] === 'to_final_validate') return MjlActivity::finalReviewStatuses();
		return array();
	}
	if (mjl_scope_is_verifier($user) && !mjl_scope_is_final_validator($user)) {
		return MjlActivity::verifierReviewStatuses();
	}
	if (mjl_scope_is_final_validator($user)) {
		return MjlActivity::finalReviewStatuses();
	}
	return array_merge(MjlActivity::verifierReviewStatuses(), MjlActivity::finalReviewStatuses());
}

function mjl_dashboard_pending_expense_statuses($filters = null)
{
	global $user;

	$filters = mjl_dashboard_filters_or_default($filters);
	if ($filters['status_bucket'] !== 'all') {
		if ($filters['status_bucket'] === 'to_prevalidate') return mjl_expense_pending_verifier_statuses();
		if ($filters['status_bucket'] === 'to_final_validate') return mjl_expense_pending_final_validator_statuses();
		if ($filters['status_bucket'] === 'to_disburse') return array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_FINAL_VALIDATED);
		return array();
	}
	if (mjl_scope_is_verifier($user) && !mjl_scope_is_final_validator($user)) {
		return mjl_expense_pending_verifier_statuses();
	}
	if (mjl_scope_is_final_validator($user)) {
		return array_merge(mjl_expense_pending_final_validator_statuses(), array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_FINAL_VALIDATED));
	}
	return array_merge(mjl_expense_pending_verifier_statuses(), mjl_expense_pending_final_validator_statuses(), array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_FINAL_VALIDATED));
}

function mjl_dashboard_budget_expense_rows($filters = null)
{
	global $db, $conf;

	$sql = 'SELECT c.ref AS convention_ref,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = c.entity AND bl.fk_convention = c.rowid), 0) AS budget_revise,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_final_validated_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid'.mjl_dashboard_project_filter_sql('e.fk_project', $filters).mjl_dashboard_date_filter_sql('e.expense_date', $filters).mjl_dashboard_expense_status_filter_sql('e', $filters).'), 0) AS depenses_validees,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_disbursed_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid'.mjl_dashboard_project_filter_sql('e.fk_project', $filters).mjl_dashboard_date_filter_sql('e.expense_date', $filters).mjl_dashboard_expense_status_filter_sql('e', $filters).'), 0) AS depenses_decaissees,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_submitted_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid'.mjl_dashboard_project_filter_sql('e.fk_project', $filters).mjl_dashboard_date_filter_sql('e.expense_date', $filters).mjl_dashboard_expense_status_filter_sql('e', $filters).'), 0) AS depenses_soumises';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity);
	$sql .= mjl_dashboard_partner_filter_sql('c.fk_soc', $filters);
	$sql .= mjl_dashboard_project_filter_sql('c.fk_project', $filters);
	$sql .= ' ORDER BY c.ref';
	return mjl_dashboard_fetch_rows($sql);
}

function mjl_dashboard_recent_funds($limit = 10, $filters = null)
{
	global $db, $conf;

	$sql = 'SELECT fr.rowid, fr.entity AS evidence_entity, fr.supporting_document AS stored_supporting_document, fr.ref, fr.reception_date, fr.amount, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_fund_receipt fr';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = fr.fk_project AND p.entity = fr.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = fr.fk_convention AND c.entity = fr.entity';
	$sql .= ' WHERE fr.entity = '.((int) $conf->entity);
	$sql .= mjl_dashboard_partner_filter_sql('fr.fk_soc', $filters);
	$sql .= mjl_dashboard_project_filter_sql('fr.fk_project', $filters);
	$sql .= mjl_dashboard_date_filter_sql('fr.reception_date', $filters);
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

function mjl_dashboard_recent_audit($limit = 30, $filters = null)
{
	global $db, $conf;

	$scopeSql = mjl_dashboard_audit_partner_filter_sql('w', $filters);
	$projectSql = mjl_dashboard_audit_project_filter_sql('w', $filters);
	$sql = 'SELECT CASE WHEN w.object_type = \'mjlfinancement_activity\' THEN \'Activite\' WHEN w.object_type = \'mjlfinancement_expense\' THEN \'Depense\' WHEN w.object_type = \'mjlfinancement_convention\' THEN \'Convention\' WHEN w.object_type = \'mjlfinancement_budget_line\' THEN \'Ligne budgetaire\' WHEN w.object_type = \'mjlfinancement_fund_receipt\' THEN \'Réception de fonds\' WHEN w.object_type = \'mjlfinancement_project\' THEN \'Projet\' ELSE w.object_type END AS source,';
	$sql .= ' CASE WHEN w.object_type = \'mjlfinancement_activity\' THEN a.ref WHEN w.object_type = \'mjlfinancement_expense\' THEN e.ref WHEN w.object_type = \'mjlfinancement_convention\' THEN c.ref WHEN w.object_type = \'mjlfinancement_budget_line\' THEN bl.ref WHEN w.object_type = \'mjlfinancement_fund_receipt\' THEN fr.ref WHEN w.object_type = \'mjlfinancement_project\' THEN p.ref ELSE NULL END AS object_ref,';
	$sql .= ' w.action, w.from_status, w.to_status, u.login, w.action_date, w.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention ac ON ac.rowid = a.fk_convention AND ac.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = w.object_id AND w.object_type = \'mjlfinancement_expense\' AND e.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention ec ON ec.rowid = e.fk_convention AND ec.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = w.object_id AND w.object_type = \'mjlfinancement_convention\' AND c.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = w.object_id AND w.object_type = \'mjlfinancement_budget_line\' AND bl.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention blc ON blc.rowid = bl.fk_convention AND blc.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = w.object_id AND w.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = w.object_id AND w.object_type = \'mjlfinancement_project\' AND p.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity);
	$sql .= ' AND COALESCE(a.rowid, e.rowid, c.rowid, bl.rowid, fr.rowid, p.rowid) IS NOT NULL';
	$sql .= $scopeSql.$projectSql.mjl_dashboard_date_filter_sql('w.action_date', $filters, true);
	$sql .= ' UNION ALL ';
	$sql .= 'SELECT \'Depense\' AS source, e.ref AS object_ref, v.action, v.from_status, v.to_status, u.login, v.action_date, v.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention vc ON vc.rowid = e.fk_convention AND vc.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
	$sql .= ' WHERE v.entity = '.((int) $conf->entity);
	$sql .= ' AND e.rowid IS NOT NULL';
	$sql .= mjl_dashboard_partner_filter_sql('vc.fk_soc', $filters);
	$sql .= mjl_dashboard_project_filter_sql('e.fk_project', $filters);
	$sql .= mjl_dashboard_date_filter_sql('v.action_date', $filters, true);
	$sql .= mjl_dashboard_expense_status_filter_sql('e', $filters);
	$sql .= ' ORDER BY action_date DESC LIMIT '.((int) $limit);
	return mjl_dashboard_fetch_rows($sql);
}

function mjl_dashboard_audit_partner_filter_sql($auditAlias, $filters = null)
{
	global $user;

	$filters = mjl_dashboard_filters_or_default($filters);
	if (!empty($filters['invalid'])) {
		return ' AND 1=0';
	}
	$scopeIds = mjl_scope_partner_ids_for_sql($user);
	$case = mjl_dashboard_audit_partner_case_sql($auditAlias);
	$sql = '';
	if ($scopeIds !== null) {
		if (empty($scopeIds)) {
			return ' AND 1=0';
		}
		$sql .= ' AND '.$case.' IN ('.implode(',', array_map('intval', $scopeIds)).')';
	}
	if (!empty($filters['fk_soc'])) {
		$sql .= ' AND '.$case.' = '.((int) $filters['fk_soc']);
	}
	return $sql;
}

function mjl_dashboard_audit_project_filter_sql($auditAlias, $filters = null)
{
	$filters = mjl_dashboard_filters_or_default($filters);
	if (!empty($filters['invalid'])) {
		return ' AND 1=0';
	}
	if (empty($filters['fk_project'])) {
		return '';
	}
	return ' AND '.mjl_dashboard_audit_project_case_sql($auditAlias).' = '.((int) $filters['fk_project']);
}

function mjl_dashboard_audit_partner_case_sql($auditAlias)
{
	$auditAlias = preg_replace('/[^A-Za-z0-9_]/', '', $auditAlias);
	return '(CASE'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_activity\' THEN ac.fk_soc'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_expense\' THEN ec.fk_soc'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_convention\' THEN c.fk_soc'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_budget_line\' THEN blc.fk_soc'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_fund_receipt\' THEN fr.fk_soc'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_project\' THEN p.fk_soc'
		.' ELSE NULL END)';
}

function mjl_dashboard_audit_project_case_sql($auditAlias)
{
	$auditAlias = preg_replace('/[^A-Za-z0-9_]/', '', $auditAlias);
	return '(CASE'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_activity\' THEN a.fk_project'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_expense\' THEN e.fk_project'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_convention\' THEN c.fk_project'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_budget_line\' THEN bl.fk_project'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_fund_receipt\' THEN fr.fk_project'
		.' WHEN '.$auditAlias.'.object_type = \'mjlfinancement_project\' THEN p.rowid'
		.' ELSE NULL END)';
}

function mjl_dashboard_activity_count($statuses, $filters = null)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.status IN ('.implode(',', array_map('intval', $statuses)).')';
	$sql .= mjl_dashboard_partner_filter_sql('c.fk_soc', $filters);
	$sql .= mjl_dashboard_project_filter_sql('a.fk_project', $filters);
	$sql .= mjl_dashboard_date_filter_sql('a.date_end', $filters);
	$sql .= mjl_dashboard_activity_status_filter_sql('a', $filters);
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_expense_count($statuses, $filters = null)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.status IN ('.implode(',', array_map('intval', $statuses)).')';
	$sql .= mjl_dashboard_partner_filter_sql('c.fk_soc', $filters);
	$sql .= mjl_dashboard_project_filter_sql('e.fk_project', $filters);
	$sql .= mjl_dashboard_date_filter_sql('e.expense_date', $filters);
	$sql .= mjl_dashboard_expense_status_filter_sql('e', $filters);
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_deadline_risk_count($filters = null)
{
	return count(mjl_dashboard_deadline_risks(500, $filters));
}

function mjl_dashboard_physical_execution_percent($filters = null)
{
	global $db, $conf;

	$sql = 'SELECT ROUND(COALESCE(AVG(a.physical_execution_percent), 0)) AS nb';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' AND a.physical_execution_percent IS NOT NULL';
	$sql .= mjl_dashboard_partner_filter_sql('c.fk_soc', $filters);
	$sql .= mjl_dashboard_project_filter_sql('a.fk_project', $filters);
	$sql .= mjl_dashboard_date_filter_sql('a.date_end', $filters);
	$sql .= mjl_dashboard_activity_status_filter_sql('a', $filters);
	return (int) mjl_dashboard_scalar($sql);
}

function mjl_dashboard_missing_expense_document_count($filters = null)
{
	global $user;
	return count(mjl_dashboard_filter_alerts(mjl_alerts_expense_missing_documents($user, 500), $filters));
}

function mjl_dashboard_pending_review_count($filters = null)
{
	return count(mjl_dashboard_pending_reviews(500, $filters));
}

function mjl_dashboard_budget_total($filters = null)
{
	global $db, $conf;

	$sql = 'SELECT COALESCE(SUM(bl.revised_budget), 0) AS nb FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE bl.entity = '.((int) $conf->entity).mjl_dashboard_partner_filter_sql('c.fk_soc', $filters).mjl_dashboard_project_filter_sql('bl.fk_project', $filters);
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_validated_expense_total($filters = null)
{
	global $db, $conf;

	$sql = 'SELECT COALESCE(SUM('.mjl_finance_final_validated_amount_sql('e').'), 0) AS nb FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE e.entity = '.((int) $conf->entity).mjl_dashboard_partner_filter_sql('c.fk_soc', $filters).mjl_dashboard_project_filter_sql('e.fk_project', $filters).mjl_dashboard_date_filter_sql('e.expense_date', $filters).mjl_dashboard_expense_status_filter_sql('e', $filters);
	return mjl_dashboard_scalar($sql);
}

function mjl_dashboard_unresolved_scope_count()
{
	global $db;

	$queries = array(
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'projet WHERE entity > 0 AND (fk_soc IS NULL OR fk_soc <= 0)',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_convention WHERE fk_soc IS NULL OR fk_soc <= 0',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity a LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE c.rowid IS NULL OR c.fk_soc IS NULL OR c.fk_soc <= 0',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_expense e LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.rowid IS NULL OR c.fk_soc IS NULL OR c.fk_soc <= 0',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_budget_line b LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = b.fk_convention AND c.entity = b.entity WHERE c.rowid IS NULL OR c.fk_soc IS NULL OR c.fk_soc <= 0',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE fk_soc IS NULL OR fk_soc <= 0',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_workflow_action WHERE object_type IS NULL OR object_type = \'\' OR object_id IS NULL OR object_id <= 0',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_workflow_action w LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = w.object_id AND w.object_type = \'mjlfinancement_expense\' AND e.entity = w.entity LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = w.object_id AND w.object_type = \'mjlfinancement_convention\' AND c.entity = w.entity LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = w.object_id AND w.object_type = \'mjlfinancement_budget_line\' AND bl.entity = w.entity LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = w.object_id AND w.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = w.entity LEFT JOIN '.$db->prefix().'projet p ON p.rowid = w.object_id AND w.object_type = \'mjlfinancement_project\' AND p.entity = w.entity WHERE w.object_type IS NOT NULL AND w.object_type <> \'\' AND w.object_id > 0 AND COALESCE(a.rowid, e.rowid, c.rowid, bl.rowid, fr.rowid, p.rowid) IS NULL',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_exchange_log WHERE object_type IS NULL OR object_type = \'\' OR object_id IS NULL OR object_id <= 0',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_exchange_log x LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND x.object_type = \'mjlfinancement_activity\' AND a.entity = x.entity LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = x.object_id AND x.object_type = \'mjlfinancement_expense\' AND e.entity = x.entity LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = x.object_id AND x.object_type = \'mjlfinancement_convention\' AND c.entity = x.entity LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = x.object_id AND x.object_type = \'mjlfinancement_budget_line\' AND bl.entity = x.entity LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = x.object_id AND x.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = x.entity LEFT JOIN '.$db->prefix().'projet p ON p.rowid = x.object_id AND x.object_type = \'mjlfinancement_project\' AND p.entity = x.entity WHERE x.object_type IS NOT NULL AND x.object_type <> \'\' AND x.object_id > 0 AND COALESCE(a.rowid, e.rowid, c.rowid, bl.rowid, fr.rowid, p.rowid) IS NULL',
		'SELECT COUNT(*) AS nb FROM '.$db->prefix().'ecm_files WHERE src_object_type LIKE \'mjlfinancement_%\' AND (src_object_id IS NULL OR src_object_id <= 0)',
	);
	$total = 0;
	foreach ($queries as $sql) {
		$total += (int) mjl_dashboard_scalar($sql);
	}
	return $total;
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
		$urgency = empty($alert['severity']) ? (empty($alert['urgency']) ? 'A surveiller' : $alert['urgency']) : $alert['severity'];
		$tone = empty($alert['tone']) ? ($urgency === 'En retard' ? 'danger' : 'warning') : $alert['tone'];
		print '<article class="mjl-alert-card mjl-alert-'.$tone.'">';
		print '<div class="mjl-alert-card-main">';
		print '<span class="mjl-status-pill mjl-status-'.$tone.'">'.dol_escape_htmltag($urgency).'</span>';
		print '<h3>'.dol_escape_htmltag($alert['ref']).' - '.dol_escape_htmltag($alert['label']).'</h3>';
		print '<p>'.dol_escape_htmltag(empty($alert['expected_action']) ? 'Action attendue: examiner l activite et confirmer la prochaine decision.' : $alert['expected_action']).'</p>';
		print '</div>';
		print '<dl class="mjl-alert-meta">';
		if (!empty($alert['meta'])) {
			foreach ($alert['meta'] as $label => $value) {
				if ((string) $value === '') continue;
				print '<div><dt>'.dol_escape_htmltag($label).'</dt><dd>'.dol_escape_htmltag($value).'</dd></div>';
			}
		} else {
			print '<div><dt>Projet</dt><dd>'.dol_escape_htmltag($alert['project_ref']).'</dd></div>';
			print '<div><dt>Convention</dt><dd>'.dol_escape_htmltag($alert['convention_ref']).'</dd></div>';
			print '<div><dt>Echeance</dt><dd>'.dol_escape_htmltag($alert['date_end']).'</dd></div>';
			print '<div><dt>Statut</dt><dd>'.dol_escape_htmltag($alert['status_label']).'</dd></div>';
		}
		print '</dl>';
		$href = empty($alert['href']) ? '/custom/mjlfinancement/activities.php?id='.((int) $alert['rowid']) : $alert['href'];
		print '<a class="mjl-card-link" href="'.mjl_dashboard_url($href).'">Ouvrir l objet concerne</a>';
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
