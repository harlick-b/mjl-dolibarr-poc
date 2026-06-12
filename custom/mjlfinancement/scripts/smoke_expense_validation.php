<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once DOL_DOCUMENT_ROOT.'/projet/class/project.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlbudgetline.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';

global $conf, $db, $user;

$adminUser = new User($db);
if ($adminUser->fetch(0, 'admin') <= 0) {
	fail('Unable to load Dolibarr admin user.');
}
$user = $adminUser;

$entity = (int) $conf->entity;
$importKey = 'MJLSMOKEVAL';
$suffix = date('YmdHis');

cleanup($importKey);

$thirdparty = new Societe($db);
$thirdparty->name = 'MJL Smoke Thirdparty '.$suffix;
$thirdparty->nom = $thirdparty->name;
$thirdparty->entity = $entity;
$thirdparty->status = 1;
$thirdparty->client = 0;
$thirdparty->fournisseur = 0;
$thirdparty->import_key = $importKey;
$thirdpartyId = $thirdparty->create($adminUser, 1);
if ($thirdpartyId <= 0) {
	fail('Unable to create smoke thirdparty: '.$thirdparty->error);
}

$project = new Project($db);
$project->ref = 'MJL-SMOKE-PROJ-'.$suffix;
$project->title = 'MJL Smoke Project '.$suffix;
$project->socid = $thirdpartyId;
$project->fk_soc = $thirdpartyId;
$project->public = 0;
$project->status = 1;
$project->statut = 1;
$project->entity = $entity;
$project->import_key = $importKey;
$projectId = $project->create($adminUser, 1);
if ($projectId <= 0) {
	cleanup($importKey);
	fail('Unable to create smoke project: '.$project->error);
}

$convention = new MjlConvention($db);
$convention->entity = $entity;
$convention->ref = 'MJL-SMOKE-CONV-'.$suffix;
$convention->title = 'MJL Smoke Convention '.$suffix;
$convention->fk_soc = $thirdpartyId;
$convention->fk_project = $projectId;
$convention->total_amount = 100000;
$convention->currency_code = 'XOF';
$convention->status = MjlConvention::STATUS_ACTIVE;
$convention->fk_user_creat = $adminUser->id;
$convention->import_key = $importKey;
$conventionId = $convention->create($adminUser, 1);
if ($conventionId <= 0) {
	cleanup($importKey);
	fail('Unable to create smoke convention: '.$convention->error);
}

$budgetLine = new MjlBudgetLine($db);
$budgetLine->entity = $entity;
$budgetLine->ref = 'MJL-SMOKE-BL-'.$suffix;
$budgetLine->label = 'MJL Smoke Budget Line '.$suffix;
$budgetLine->fk_project = $projectId;
$budgetLine->fk_convention = $conventionId;
$budgetLine->initial_budget = 100000;
$budgetLine->revised_budget = 100000;
$budgetLine->committed_amount = 0;
$budgetLine->spent_amount = 0;
$budgetLine->remaining_amount = 100000;
$budgetLine->fk_user_creat = $adminUser->id;
$budgetLine->import_key = $importKey;
$budgetLineId = $budgetLine->create($adminUser, 1);
if ($budgetLineId <= 0) {
	cleanup($importKey);
	fail('Unable to create smoke budget line: '.$budgetLine->error);
}

$expense = new MjlExpense($db);
$expense->entity = $entity;
$expense->ref = 'MJL-SMOKE-EXP-'.$suffix;
$expense->fk_project = $projectId;
$expense->fk_convention = $conventionId;
$expense->fk_budget_line = $budgetLineId;
$expense->amount = 12500;
$expense->expense_date = dol_now();
$expense->description = 'Initial smoke expense';
$expense->supporting_document = 'SMOKE-DOC-'.$suffix;
$expense->status = MjlExpense::STATUS_SUBMITTED;
$expense->fk_user_creat = $adminUser->id;
$expense->import_key = $importKey;
$expenseId = $expense->create($adminUser, 1);
if ($expenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create smoke expense: '.$expense->error);
}

$fetched = new MjlExpense($db);
if ($fetched->fetch($expenseId) <= 0) {
	cleanup($importKey);
	fail('Unable to fetch smoke expense.');
}

$fetched->description = 'Updated smoke expense';
if ($fetched->update($adminUser, 1) < 0) {
	cleanup($importKey);
	fail('Unable to update smoke expense: '.$fetched->error);
}

if ($fetched->validate($adminUser) <= 0) {
	cleanup($importKey);
	fail('Unable to validate smoke expense: '.$fetched->error);
}

$secondValidation = $fetched->validate($adminUser);
if ($secondValidation !== 0) {
	cleanup($importKey);
	fail('Second validation should be idempotent, got '.$secondValidation);
}

$sql = 'SELECT status, fk_user_valid, validation_date FROM '.$db->prefix().'mjlfinancement_expense WHERE rowid = '.((int) $expenseId);
$resql = $db->query($sql);
if (!$resql) {
	cleanup($importKey);
	fail('Unable to verify smoke expense: '.$db->lasterror());
}
$row = $db->fetch_object($resql);
if (!$row || (int) $row->status !== MjlExpense::STATUS_VALIDATED || (int) $row->fk_user_valid !== (int) $adminUser->id || empty($row->validation_date)) {
	cleanup($importKey);
	fail('Smoke expense validation metadata was not persisted.');
}

$validationCount = fetchScalar('SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_validation WHERE fk_expense = '.((int) $expenseId)." AND action = 'validated'");
if ($validationCount !== 1) {
	cleanup($importKey);
	fail('Expected exactly one validation event, got '.$validationCount);
}

$budget = fetchRow('SELECT spent_amount, remaining_amount FROM '.$db->prefix().'mjlfinancement_budget_line WHERE rowid = '.((int) $budgetLineId));
if (!$budget || abs((float) $budget->spent_amount - 12500.0) > 0.001 || abs((float) $budget->remaining_amount - 87500.0) > 0.001) {
	cleanup($importKey);
	fail('Budget line amounts were not recalculated after validation.');
}

$fetched->description = 'Forbidden audited update';
if ($fetched->update($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Audited expense update should have been rejected.');
}
if ($fetched->delete($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Audited expense delete should have been rejected.');
}

$missingDocExpense = new MjlExpense($db);
$missingDocExpense->entity = $entity;
$missingDocExpense->ref = 'MJL-SMOKE-EXP-MISSING-'.$suffix;
$missingDocExpense->fk_project = $projectId;
$missingDocExpense->fk_convention = $conventionId;
$missingDocExpense->fk_budget_line = $budgetLineId;
$missingDocExpense->amount = 1000;
$missingDocExpense->expense_date = dol_now();
$missingDocExpense->description = 'Missing document smoke expense';
$missingDocExpense->status = MjlExpense::STATUS_SUBMITTED;
$missingDocExpense->fk_user_creat = $adminUser->id;
$missingDocExpense->import_key = $importKey;
$missingDocExpenseId = $missingDocExpense->create($adminUser, 1);
if ($missingDocExpenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create missing document smoke expense: '.$missingDocExpense->error);
}
if ($missingDocExpense->validate($adminUser) >= 0) {
	cleanup($importKey);
	fail('Validation without supporting document should have been rejected.');
}

$overBudgetExpense = new MjlExpense($db);
$overBudgetExpense->entity = $entity;
$overBudgetExpense->ref = 'MJL-SMOKE-EXP-OVER-'.$suffix;
$overBudgetExpense->fk_project = $projectId;
$overBudgetExpense->fk_convention = $conventionId;
$overBudgetExpense->fk_budget_line = $budgetLineId;
$overBudgetExpense->amount = 200000;
$overBudgetExpense->expense_date = dol_now();
$overBudgetExpense->description = 'Over budget smoke expense';
$overBudgetExpense->supporting_document = 'SMOKE-DOC-OVER-'.$suffix;
$overBudgetExpense->status = MjlExpense::STATUS_SUBMITTED;
$overBudgetExpense->fk_user_creat = $adminUser->id;
$overBudgetExpense->import_key = $importKey;
$overBudgetExpenseId = $overBudgetExpense->create($adminUser, 1);
if ($overBudgetExpenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create over budget smoke expense: '.$overBudgetExpense->error);
}
if ($overBudgetExpense->validate($adminUser) >= 0) {
	cleanup($importKey);
	fail('Over budget validation should have been rejected.');
}

$tamperExpense = new MjlExpense($db);
$tamperExpense->entity = $entity;
$tamperExpense->ref = 'MJL-SMOKE-EXP-TAMPER-'.$suffix;
$tamperExpense->fk_project = $projectId;
$tamperExpense->fk_convention = $conventionId;
$tamperExpense->fk_budget_line = $budgetLineId;
$tamperExpense->amount = 1000;
$tamperExpense->expense_date = dol_now();
$tamperExpense->description = 'Tamper smoke expense';
$tamperExpense->supporting_document = 'SMOKE-DOC-TAMPER-'.$suffix;
$tamperExpense->status = MjlExpense::STATUS_SUBMITTED;
$tamperExpense->fk_user_creat = $adminUser->id;
$tamperExpense->import_key = $importKey;
$tamperExpenseId = $tamperExpense->create($adminUser, 1);
if ($tamperExpenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create tamper smoke expense: '.$tamperExpense->error);
}
$tamperExpense->status = MjlExpense::STATUS_VALIDATED;
if ($tamperExpense->update($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Generic status update to validated should have been rejected.');
}

cleanup($importKey);
out('MJL expense validation smoke test completed.');

function cleanup($importKey)
{
	global $db;

	$escaped = $db->escape($importKey);
	$queries = array(
		'DELETE FROM '.$db->prefix().'mjlfinancement_validation WHERE import_key = \''.$escaped.'\' OR fk_expense IN (SELECT rowid FROM '.$db->prefix()."mjlfinancement_expense WHERE import_key = '".$escaped."')",
		'DELETE FROM '.$db->prefix()."mjlfinancement_expense WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_budget_line WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_convention WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix().'projet WHERE fk_soc IN (SELECT rowid FROM '.$db->prefix()."societe WHERE import_key = '".$escaped."')",
		'DELETE FROM '.$db->prefix()."projet WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix().'societe_commerciaux WHERE fk_soc IN (SELECT rowid FROM '.$db->prefix()."societe WHERE import_key = '".$escaped."')",
		'DELETE FROM '.$db->prefix()."societe WHERE import_key = '".$escaped."'",
	);

	foreach ($queries as $sql) {
		if (!$db->query($sql)) {
			fail('Unable to clean smoke data: '.$db->lasterror());
		}
	}
}

function fetchScalar($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch scalar: '.$db->lasterror());
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (int) $obj->nb : 0;
}

function fetchRow($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch row: '.$db->lasterror());
	}
	return $db->fetch_object($resql);
}

function out($message)
{
	print $message.PHP_EOL;
}

function fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(1);
}
