<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once DOL_DOCUMENT_ROOT.'/projet/class/project.class.php';
require_once DOL_DOCUMENT_ROOT.'/projet/class/task.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_sample_data.lib.php';

global $conf, $db, $user;

$adminUser = new User($db);
if ($adminUser->fetch(0, 'admin') <= 0) {
	fail('Unable to load Dolibarr admin user.');
}
$user = $adminUser;
$entity = (int) $conf->entity;
$importKey = mjl_poc_import_key();

mjl_ensure_schema();

$roles = mjl_csv_map('roles_permissions.csv', 'role_code');
$users = mjl_csv_map('users.csv', 'user_id');
$ptfs = mjl_csv_map('ptfs_bailleurs.csv', 'ptf_id');
$projects = mjl_csv_map('projects.csv', 'project_id');
$conventions = mjl_csv_map('conventions.csv', 'convention_id');
$activities = mjl_csv_map('activities.csv', 'activity_id');
$budgetLines = mjl_csv_map('budget_lines.csv', 'budget_line_id');
$documents = mjl_csv_map('supporting_documents.csv', 'document_id');
$fundReceipts = mjl_csv_map('fund_receipts.csv', 'fund_receipt_id');
$expenses = mjl_csv_map('expenses.csv', 'expense_id');
$validations = mjl_csv_map('validation_events.csv', 'validation_id');
$reports = mjl_csv_map('fixed_reports.csv', 'report_id');

cleanupStaleCustomRows(array_keys($conventions), array_keys($activities), array_keys($budgetLines), array_keys($fundReceipts), array_keys($expenses), array_keys($validations), array_keys($reports), $entity, $importKey);

$userIds = ensureSampleUsersExist($users);
$ptfIds = array();
$projectIds = array();
$conventionIds = array();
$taskIds = array();
$activityIds = array();
$budgetLineIds = array();
$fundReceiptIds = array();
$expenseIds = array();

foreach ($ptfs as $ptfId => $row) {
	$ptfIds[$ptfId] = ensureThirdparty($row, $entity, $importKey, $adminUser);
}
mjl_out('PTF/Bailleurs: '.count($ptfIds));

foreach ($projects as $projectId => $row) {
	$projectIds[$projectId] = ensureProject($row, $ptfIds[$row['ptf_id']], $entity, $importKey, $adminUser);
}
mjl_out('Projects: '.count($projectIds));

foreach ($conventions as $conventionId => $row) {
	$conventionIds[$conventionId] = upsertConvention($row, $projectIds[$row['project_id']], $ptfIds[$row['ptf_id']], $entity, $importKey, $adminUser);
}
mjl_out('Conventions: '.count($conventionIds));

foreach ($activities as $activityId => $row) {
	$taskIds[$activityId] = ensureTask($row, $projectIds[$row['project_id']], $entity, $importKey, $adminUser);
	$activityIds[$activityId] = upsertActivity($row, $projectIds[$row['project_id']], $conventionIds[$row['convention_id']], $taskIds[$activityId], $entity, $importKey, $adminUser);
}
mjl_out('Activities: '.count($activityIds));

foreach ($budgetLines as $budgetLineId => $row) {
	$budgetLineIds[$budgetLineId] = upsertBudgetLine($row, $projectIds[$row['project_id']], $conventionIds[$row['convention_id']], $activityIds[$row['activity_id']], $taskIds[$row['activity_id']], $entity, $importKey, $adminUser);
}
mjl_out('Budget lines: '.count($budgetLineIds));

foreach ($fundReceipts as $fundReceiptId => $row) {
	$fundReceiptIds[$fundReceiptId] = upsertFundReceipt($row, $ptfIds[$row['ptf_id']], $projectIds[$row['project_id']], $conventionIds[$row['convention_id']], $entity, $importKey, $adminUser);
}
mjl_out('Fund receipts: '.count($fundReceiptIds));

foreach ($expenses as $expenseId => $row) {
	$expenseIds[$expenseId] = upsertExpense($row, $projectIds[$row['project_id']], $conventionIds[$row['convention_id']], $activityIds[$row['activity_id']], $budgetLineIds[$row['budget_line_id']], $userIds, $entity, $importKey, $adminUser);
}
mjl_out('Expenses: '.count($expenseIds));

foreach ($validations as $validationId => $row) {
	upsertValidation($row, $expenseIds[$row['expense_id']], $userIds[$row['actor_user_id']], $entity, $importKey, $adminUser);
}
mjl_out('Validation events: '.count($validations));

foreach ($reports as $reportId => $row) {
	upsertReport($row, $entity, $importKey, $adminUser);
}
mjl_out('Fixed reports: '.count($reports));

attachDocuments($documents, $fundReceiptIds, $expenseIds, $entity, $importKey, $adminUser);
recalculateBudgetLines($entity, $importKey);

mjl_out('MJL CSV sample data seeded.');

function cleanupStaleCustomRows($conventionRefs, $activityRefs, $budgetLineRefs, $receiptRefs, $expenseRefs, $validationRefs, $reportRefs, $entity, $importKey)
{
	global $db;

	deleteStale('mjlfinancement_validation', $validationRefs, $entity, $importKey);
	deleteStale('mjlfinancement_expense', $expenseRefs, $entity, $importKey);
	deleteStale('mjlfinancement_fund_receipt', $receiptRefs, $entity, $importKey);
	deleteStale('mjlfinancement_budget_line', $budgetLineRefs, $entity, $importKey);
	deleteStale('mjlfinancement_activity', $activityRefs, $entity, $importKey);
	deleteStale('mjlfinancement_report', $reportRefs, $entity, $importKey);
	deleteStale('mjlfinancement_convention', $conventionRefs, $entity, $importKey);

	$sql = 'DELETE FROM '.$db->prefix()."ecm_files WHERE entity = ".$entity." AND filepath = 'mjlfinancement_sample' AND filename NOT IN (";
	$filenames = array();
	foreach (mjl_csv_rows('supporting_documents.csv') as $row) {
		if ($row['exists_in_placeholder_folder'] === 'yes' && $row['filename'] !== '') {
			$filenames[] = mjl_sql_string($row['filename']);
		}
	}
	$sql .= implode(',', $filenames).')';
	mjl_query($sql, 'remove stale MJL ECM files');
}

function deleteStale($table, $refs, $entity, $importKey)
{
	global $db;

	if (empty($refs)) {
		return;
	}
	$quotedRefs = array_map('mjl_sql_string', $refs);
	$sql = 'DELETE FROM '.$db->prefix().$table;
	$sql .= ' WHERE entity = '.$entity." AND import_key = '".$db->escape($importKey)."'";
	$sql .= ' AND ref NOT IN ('.implode(',', $quotedRefs).')';
	mjl_query($sql, 'delete stale '.$table);
}

function ensureSampleUsersExist($users)
{
	global $db;

	$ids = array();
	foreach ($users as $userId => $row) {
		$id = mjl_fetch_id('user', "login = '".$db->escape($row['login'])."'");
		if ($id <= 0) {
			fail('Sample user '.$row['login'].' is missing. Run bootstrap_poc.php first.');
		}
		$ids[$userId] = $id;
	}
	return $ids;
}

function ensureThirdparty($row, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('societe', "entity = ".$entity." AND nom = '".$db->escape($row['name'])."'");
	if ($id <= 0) {
		$thirdparty = new Societe($db);
		$thirdparty->name = $row['name'];
		$thirdparty->nom = $row['name'];
		$thirdparty->email = $row['email'];
		$thirdparty->phone = $row['phone'];
		$thirdparty->entity = $entity;
		$thirdparty->status = $row['active'] === 'yes' ? 1 : 0;
		$thirdparty->client = 0;
		$thirdparty->fournisseur = 0;
		$thirdparty->import_key = $importKey;
		$id = $thirdparty->create($adminUser, 1);
		if ($id <= 0) {
			fail('Unable to create thirdparty '.$row['name'].': '.$thirdparty->error);
		}
	}

	$sql = 'UPDATE '.$db->prefix().'societe SET';
	$sql .= " nom = '".$db->escape($row['name'])."'";
	$sql .= ", email = '".$db->escape($row['email'])."', phone = '".$db->escape($row['phone'])."'";
	$sql .= ", statut = ".($row['active'] === 'yes' ? 1 : 0).", status = ".($row['active'] === 'yes' ? 1 : 0);
	$sql .= ", import_key = '".$db->escape($importKey)."' WHERE rowid = ".$id;
	mjl_query($sql, 'update thirdparty '.$row['name']);
	return $id;
}

function ensureProject($row, $thirdpartyId, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('projet', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	if ($id <= 0) {
		$project = new Project($db);
		$project->ref = $row['ref'];
		$project->title = $row['title'];
		$project->description = $row['description'];
		$project->socid = $thirdpartyId;
		$project->fk_soc = $thirdpartyId;
		$project->public = 0;
		$project->status = mjl_status_project($row['status']);
		$project->statut = mjl_status_project($row['status']);
		$project->date_start = strtotime($row['start_date']);
		$project->date_end = strtotime($row['end_date']);
		$project->entity = $entity;
		$project->import_key = $importKey;
		$id = $project->create($adminUser, 1);
		if ($id <= 0) {
			fail('Unable to create project '.$row['ref'].': '.$project->error);
		}
	}

	$sql = 'UPDATE '.$db->prefix().'projet SET';
	$sql .= " title = '".$db->escape($row['title'])."', description = '".$db->escape($row['description'])."'";
	$sql .= ', fk_soc = '.((int) $thirdpartyId).', fk_statut = '.mjl_status_project($row['status']);
	$sql .= ', dateo = '.mjl_sql_date($row['start_date']).', datee = '.mjl_sql_date($row['end_date']);
	$sql .= ", usage_task = 1, import_key = '".$db->escape($importKey)."' WHERE rowid = ".$id;
	mjl_query($sql, 'update project '.$row['ref']);
	return $id;
}

function ensureTask($row, $projectId, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('projet_task', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	if ($id <= 0) {
		$task = new Task($db);
		$task->entity = $entity;
		$task->fk_project = $projectId;
		$task->ref = $row['ref'];
		$task->fk_task_parent = 0;
		$task->label = $row['label'];
		$task->description = 'MJL sample activity';
		$task->date_start = strtotime($row['start_date']);
		$task->date_end = strtotime($row['end_date']);
		$task->status = mjl_status_activity($row['status']) === 0 ? 0 : 1;
		$task->progress = mjl_status_activity($row['status']) === 2 ? 100 : 0;
		$task->billable = 0;
		$id = $task->create($adminUser, 1);
		if ($id <= 0) {
			fail('Unable to create task '.$row['ref'].': '.$task->error);
		}
	}

	$sql = 'UPDATE '.$db->prefix().'projet_task SET';
	$sql .= ' fk_projet = '.((int) $projectId).", label = '".$db->escape($row['label'])."'";
	$sql .= ', dateo = '.mjl_sql_date($row['start_date']).', datee = '.mjl_sql_date($row['end_date']);
	$sql .= ', fk_statut = '.(mjl_status_activity($row['status']) === 0 ? 0 : 1);
	$sql .= ', progress = '.(mjl_status_activity($row['status']) === 2 ? 100 : 0);
	$sql .= ", billable = 0, import_key = '".$db->escape($importKey)."' WHERE rowid = ".$id;
	mjl_query($sql, 'update task '.$row['ref']);
	return $id;
}

function upsertConvention($row, $projectId, $thirdpartyId, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('mjlfinancement_convention', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	if ($id <= 0) {
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, date_creation, fk_user_creat, import_key, status) VALUES (';
		$sql .= $entity.', '.mjl_sql_string($row['ref']).', '.mjl_sql_string($row['title']).', '.((int) $thirdpartyId).', '.((int) $projectId).', '.mjl_sql_date($row['start_date']).', '.mjl_sql_date($row['end_date']).', '.price2num($row['total_amount_xof']).', '.mjl_sql_string($row['currency']).", '".$db->idate(dol_now())."', ".((int) $adminUser->id).', '.mjl_sql_string($importKey).', '.mjl_status_convention($row['status']).')';
		mjl_query($sql, 'insert convention '.$row['ref']);
		return mjl_fetch_id('mjlfinancement_convention', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	}

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_convention SET title = '.mjl_sql_string($row['title']).', fk_soc = '.((int) $thirdpartyId).', fk_project = '.((int) $projectId);
	$sql .= ', date_start = '.mjl_sql_date($row['start_date']).', date_end = '.mjl_sql_date($row['end_date']).', total_amount = '.price2num($row['total_amount_xof']);
	$sql .= ', currency_code = '.mjl_sql_string($row['currency']).', status = '.mjl_status_convention($row['status']).', fk_user_modif = '.((int) $adminUser->id).', import_key = '.mjl_sql_string($importKey).' WHERE rowid = '.$id;
	mjl_query($sql, 'update convention '.$row['ref']);
	return $id;
}

function upsertActivity($row, $projectId, $conventionId, $taskId, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('mjlfinancement_activity', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	if ($id <= 0) {
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, fk_task, date_start, date_end, date_creation, fk_user_creat, import_key, status) VALUES (';
		$sql .= $entity.', '.mjl_sql_string($row['ref']).', '.mjl_sql_string($row['label']).', '.((int) $projectId).', '.((int) $conventionId).', '.((int) $taskId).', '.mjl_sql_date($row['start_date']).', '.mjl_sql_date($row['end_date']).", '".$db->idate(dol_now())."', ".((int) $adminUser->id).', '.mjl_sql_string($importKey).', '.mjl_status_activity($row['status']).')';
		mjl_query($sql, 'insert activity '.$row['ref']);
		return mjl_fetch_id('mjlfinancement_activity', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	}

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_activity SET label = '.mjl_sql_string($row['label']).', fk_project = '.((int) $projectId).', fk_convention = '.((int) $conventionId).', fk_task = '.((int) $taskId);
	$sql .= ', date_start = '.mjl_sql_date($row['start_date']).', date_end = '.mjl_sql_date($row['end_date']).', status = '.mjl_status_activity($row['status']).', fk_user_modif = '.((int) $adminUser->id).', import_key = '.mjl_sql_string($importKey).' WHERE rowid = '.$id;
	mjl_query($sql, 'update activity '.$row['ref']);
	return $id;
}

function upsertBudgetLine($row, $projectId, $conventionId, $activityId, $taskId, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('mjlfinancement_budget_line', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	$values = array(
		'label = '.mjl_sql_string($row['label']),
		'fk_project = '.((int) $projectId),
		'fk_convention = '.((int) $conventionId),
		'fk_mjl_activity = '.((int) $activityId),
		'fk_activity = '.((int) $taskId),
		'initial_budget = '.price2num($row['initial_budget_xof']),
		'revised_budget = '.price2num($row['revised_budget_xof']),
		'committed_amount = 0',
		'category = '.mjl_sql_string($row['category']),
		'status = '.mjl_status_budget_line($row['status']),
		'import_key = '.mjl_sql_string($importKey),
	);
	if ($id <= 0) {
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_budget_line (entity, ref, date_creation, fk_user_creat, '.implode(', ', array_map(function ($value) { return trim(strstr($value, '=', true)); }, $values)).') VALUES (';
		$sql .= $entity.', '.mjl_sql_string($row['ref']).", '".$db->idate(dol_now())."', ".((int) $adminUser->id).', '.implode(', ', array_map(function ($value) { return trim(substr(strstr($value, '='), 1)); }, $values)).')';
		mjl_query($sql, 'insert budget line '.$row['ref']);
		return mjl_fetch_id('mjlfinancement_budget_line', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	}
	$values[] = 'fk_user_modif = '.((int) $adminUser->id);
	mjl_query('UPDATE '.$db->prefix().'mjlfinancement_budget_line SET '.implode(', ', $values).' WHERE rowid = '.$id, 'update budget line '.$row['ref']);
	return $id;
}

function upsertFundReceipt($row, $thirdpartyId, $projectId, $conventionId, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('mjlfinancement_fund_receipt', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	$values = array(
		'fk_soc = '.((int) $thirdpartyId),
		'fk_project = '.((int) $projectId),
		'fk_convention = '.((int) $conventionId),
		'amount = '.price2num($row['amount_xof']),
		'reception_date = '.mjl_sql_date($row['reception_date']),
		'supporting_document = NULL',
		'comment = '.mjl_sql_string($row['comment']),
		'status = '.mjl_status_receipt($row['status']),
		'import_key = '.mjl_sql_string($importKey),
	);
	if ($id <= 0) {
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_fund_receipt (entity, ref, date_creation, fk_user_creat, '.implode(', ', array_map(function ($value) { return trim(strstr($value, '=', true)); }, $values)).') VALUES (';
		$sql .= $entity.', '.mjl_sql_string($row['ref']).", '".$db->idate(dol_now())."', ".((int) $adminUser->id).', '.implode(', ', array_map(function ($value) { return trim(substr(strstr($value, '='), 1)); }, $values)).')';
		mjl_query($sql, 'insert fund receipt '.$row['ref']);
		return mjl_fetch_id('mjlfinancement_fund_receipt', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	}
	$values[] = 'fk_user_modif = '.((int) $adminUser->id);
	mjl_query('UPDATE '.$db->prefix().'mjlfinancement_fund_receipt SET '.implode(', ', $values).' WHERE rowid = '.$id, 'update fund receipt '.$row['ref']);
	return $id;
}

function upsertExpense($row, $projectId, $conventionId, $activityId, $budgetLineId, $userIds, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('mjlfinancement_expense', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	$validator = $row['validated_by'] !== '' ? (int) $userIds[$row['validated_by']] : 'NULL';
	$creator = $row['created_by'] !== '' ? (int) $userIds[$row['created_by']] : (int) $adminUser->id;
	$values = array(
		'fk_project = '.((int) $projectId),
		'fk_convention = '.((int) $conventionId),
		'fk_mjl_activity = '.((int) $activityId),
		'fk_budget_line = '.((int) $budgetLineId),
		'amount = '.price2num($row['amount_xof']),
		'expense_date = '.mjl_sql_date($row['expense_date']),
		'description = '.mjl_sql_string($row['description']),
		'supporting_document = NULL',
		'fk_user_valid = '.$validator,
		'validation_date = '.mjl_sql_datetime($row['validated_at']),
		'correction_reason = '.mjl_sql_string($row['correction_reason']),
		'submitted_at = '.mjl_sql_datetime($row['submitted_at']),
		'status = '.mjl_status_expense($row['status']),
		'import_key = '.mjl_sql_string($importKey),
	);
	if ($id <= 0) {
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_expense (entity, ref, date_creation, fk_user_creat, '.implode(', ', array_map(function ($value) { return trim(strstr($value, '=', true)); }, $values)).') VALUES (';
		$sql .= $entity.', '.mjl_sql_string($row['ref']).", '".$db->idate(dol_now())."', ".$creator.', '.implode(', ', array_map(function ($value) { return trim(substr(strstr($value, '='), 1)); }, $values)).')';
		mjl_query($sql, 'insert expense '.$row['ref']);
		return mjl_fetch_id('mjlfinancement_expense', "entity = ".$entity." AND ref = '".$db->escape($row['ref'])."'");
	}
	$values[] = 'fk_user_modif = '.((int) $adminUser->id);
	mjl_query('UPDATE '.$db->prefix().'mjlfinancement_expense SET '.implode(', ', $values).' WHERE rowid = '.$id, 'update expense '.$row['ref']);
	return $id;
}

function upsertValidation($row, $expenseId, $actorUserId, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('mjlfinancement_validation', "entity = ".$entity." AND ref = '".$db->escape($row['validation_id'])."'");
	$values = array(
		'fk_expense = '.((int) $expenseId),
		'action = '.mjl_sql_string($row['action']),
		'from_status = '.mjl_sql_string($row['from_status']),
		'to_status = '.mjl_sql_string($row['to_status']),
		'fk_user_action = '.((int) $actorUserId),
		'action_date = '.mjl_sql_datetime($row['action_date']),
		'comment = '.mjl_sql_string($row['comment']),
		'import_key = '.mjl_sql_string($importKey),
	);
	if ($id <= 0) {
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_validation (entity, ref, date_creation, fk_user_creat, '.implode(', ', array_map(function ($value) { return trim(strstr($value, '=', true)); }, $values)).') VALUES (';
		$sql .= $entity.', '.mjl_sql_string($row['validation_id']).", '".$db->idate(dol_now())."', ".((int) $adminUser->id).', '.implode(', ', array_map(function ($value) { return trim(substr(strstr($value, '='), 1)); }, $values)).')';
		mjl_query($sql, 'insert validation '.$row['validation_id']);
		return;
	}
	$values[] = 'fk_user_modif = '.((int) $adminUser->id);
	mjl_query('UPDATE '.$db->prefix().'mjlfinancement_validation SET '.implode(', ', $values).' WHERE rowid = '.$id, 'update validation '.$row['validation_id']);
}

function upsertReport($row, $entity, $importKey, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('mjlfinancement_report', "entity = ".$entity." AND ref = '".$db->escape($row['report_id'])."'");
	$values = array(
		'name = '.mjl_sql_string($row['name']),
		'scope = '.mjl_sql_string($row['scope']),
		'expected_format = '.mjl_sql_string($row['expected_format']),
		'filters = '.mjl_sql_string($row['filters']),
		'must_include = '.mjl_sql_string($row['must_include']),
		'import_key = '.mjl_sql_string($importKey),
	);
	if ($id <= 0) {
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_report (entity, ref, date_creation, fk_user_creat, '.implode(', ', array_map(function ($value) { return trim(strstr($value, '=', true)); }, $values)).') VALUES (';
		$sql .= $entity.', '.mjl_sql_string($row['report_id']).", '".$db->idate(dol_now())."', ".((int) $adminUser->id).', '.implode(', ', array_map(function ($value) { return trim(substr(strstr($value, '='), 1)); }, $values)).')';
		mjl_query($sql, 'insert report '.$row['report_id']);
		return;
	}
	$values[] = 'fk_user_modif = '.((int) $adminUser->id);
	mjl_query('UPDATE '.$db->prefix().'mjlfinancement_report SET '.implode(', ', $values).' WHERE rowid = '.$id, 'update report '.$row['report_id']);
}

function attachDocuments($documents, $fundReceiptIds, $expenseIds, $entity, $importKey, User $adminUser)
{
	global $conf, $db;

	$sourceDir = mjl_poc_sample_dir().'/documents_placeholders';
	$targetRel = 'mjlfinancement_sample';
	$targetDir = rtrim($conf->ecm->dir_output, '/').'/'.$targetRel;
	if (!is_dir($targetDir) && !dol_mkdir($targetDir)) {
		fail('Unable to create ECM directory '.$targetDir);
	}
	ensureEcmDirectory($targetRel, $entity, $adminUser);

	foreach ($documents as $documentId => $row) {
		if ($row['exists_in_placeholder_folder'] !== 'yes' || $row['filename'] === '') {
			if ($row['linked_type'] === 'expense' && isset($expenseIds[$row['linked_ref']])) {
				mjl_query('UPDATE '.$db->prefix().'mjlfinancement_expense SET supporting_document = NULL WHERE entity = '.$entity.' AND rowid = '.((int) $expenseIds[$row['linked_ref']]), 'clear missing expense document');
			}
			continue;
		}

		$source = $sourceDir.'/'.$row['filename'];
		if (!is_readable($source)) {
			fail('Expected placeholder document is missing: '.$source);
		}
		$target = $targetDir.'/'.$row['filename'];
		if (!copy($source, $target)) {
			fail('Unable to copy placeholder document '.$row['filename']);
		}

		$srcType = $row['linked_type'] === 'fund_receipt' ? 'mjlfinancement_fund_receipt' : 'mjlfinancement_expense';
		$srcId = $row['linked_type'] === 'fund_receipt' ? $fundReceiptIds[$row['linked_ref']] : $expenseIds[$row['linked_ref']];
		upsertEcmFile($row['filename'], $targetRel, $row['comment'], $srcType, $srcId, $entity, $adminUser);

		if ($row['linked_type'] === 'fund_receipt') {
			mjl_query('UPDATE '.$db->prefix().'mjlfinancement_fund_receipt SET supporting_document = '.mjl_sql_string($documentId).' WHERE entity = '.$entity.' AND rowid = '.((int) $srcId), 'attach fund receipt document');
		} else {
			mjl_query('UPDATE '.$db->prefix().'mjlfinancement_expense SET supporting_document = '.mjl_sql_string($documentId).' WHERE entity = '.$entity.' AND rowid = '.((int) $srcId), 'attach expense document');
		}
	}
}

function ensureEcmDirectory($label, $entity, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('ecm_directories', "entity = ".$entity." AND label = '".$db->escape($label)."'");
	if ($id > 0) {
		return;
	}
	$sql = 'INSERT INTO '.$db->prefix().'ecm_directories (label, entity, fk_parent, description, cachenbofdoc, date_c, fk_user_c) VALUES (';
	$sql .= mjl_sql_string($label).', '.$entity.', NULL, '.mjl_sql_string('MJL sample POC documents').", 0, '".$db->idate(dol_now())."', ".((int) $adminUser->id).')';
	mjl_query($sql, 'create ECM directory');
}

function upsertEcmFile($filename, $filepath, $description, $srcType, $srcId, $entity, User $adminUser)
{
	global $db;

	$id = mjl_fetch_id('ecm_files', "entity = ".$entity." AND filepath = '".$db->escape($filepath)."' AND filename = '".$db->escape($filename)."'");
	$ref = hash('sha1', $entity.'/'.$filepath.'/'.$filename);
	if ($id <= 0) {
		$sql = 'INSERT INTO '.$db->prefix().'ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, position, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id) VALUES (';
		$sql .= mjl_sql_string($ref).', '.mjl_sql_string($filename).', '.$entity.', '.mjl_sql_string($filename).', '.mjl_sql_string($filepath).', '.mjl_sql_string($filename).', '.mjl_sql_string($description).", 0, 'copy', '".$db->idate(dol_now())."', ".((int) $adminUser->id).', '.mjl_sql_string($srcType).', '.((int) $srcId).')';
		mjl_query($sql, 'insert ECM file '.$filename);
		return;
	}
	$sql = 'UPDATE '.$db->prefix().'ecm_files SET ref = '.mjl_sql_string($ref).', description = '.mjl_sql_string($description).', src_object_type = '.mjl_sql_string($srcType).', src_object_id = '.((int) $srcId).', fk_user_m = '.((int) $adminUser->id).' WHERE entity = '.$entity.' AND rowid = '.$id;
	mjl_query($sql, 'update ECM file '.$filename);
}

function recalculateBudgetLines($entity, $importKey)
{
	global $db;

	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_budget_line';
	$sql .= " WHERE entity = ".$entity." AND import_key = '".$db->escape($importKey)."'";
	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch budget lines to recalculate: '.$db->lasterror());
	}
	$budgetLineIds = array();
	while ($obj = $db->fetch_object($resql)) {
		$budgetLineIds[] = (int) $obj->rowid;
	}
	if (mjl_recalculate_budget_line_amounts($budgetLineIds, $entity) < 0) {
		fail('Unable to recalculate budget lines: '.mjl_integrity_error());
	}
}
