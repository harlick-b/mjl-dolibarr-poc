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
$validatorUser = loadSmokeUser('superviseur.n1');
$finalValidatorUser = loadSmokeUser('dpaf.mjl');

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
if ($convention->activate($adminUser, 'Activate smoke convention', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to activate smoke convention: '.$convention->error);
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
if ($budgetLine->activate($adminUser, 'Activate smoke budget line', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to activate smoke budget line: '.$budgetLine->error);
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
$expense->status = MjlExpense::STATUS_DRAFT;
$expense->fk_user_creat = $adminUser->id;
$expense->import_key = $importKey;
$expenseId = $expense->create($adminUser, 1);
if ($expenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create smoke expense: '.$expense->error);
}
insertEcmDocument($expenseId, $entity, 'SMOKE-DOC-'.$suffix, $adminUser->id);

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

if ($fetched->submit($adminUser, 'Submit smoke expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to submit smoke expense: '.$fetched->error);
}

if ($fetched->validate($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Self-validation should have been rejected.');
}
assertValidationCount($expenseId, 'prevalidated', 0);

if ($fetched->prevalidate($validatorUser, 12500, 'Prevalidate smoke expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to prevalidate smoke expense: '.$fetched->error);
}

if ($fetched->finalValidate($validatorUser, 12500, 'Wrong final validator', 1) >= 0) {
	cleanup($importKey);
	fail('Verifier final validation should have been rejected.');
}

if ($fetched->finalValidate($finalValidatorUser, 12500, 'Final validate smoke expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to final validate smoke expense: '.$fetched->error);
}

$secondValidation = $fetched->finalValidate($finalValidatorUser, 12500, 'Idempotent final validation', 1);
if ($secondValidation !== 0) {
	cleanup($importKey);
	fail('Second final validation should be idempotent, got '.$secondValidation);
}

$sql = 'SELECT status, fk_user_valid, validation_date, fk_user_prevalidated, prevalidation_date, fk_user_final_valid, final_validation_date, final_validated_amount FROM '.$db->prefix().'mjlfinancement_expense WHERE rowid = '.((int) $expenseId);
$resql = $db->query($sql);
if (!$resql) {
	cleanup($importKey);
	fail('Unable to verify smoke expense: '.$db->lasterror());
}
$row = $db->fetch_object($resql);
if (!$row || (int) $row->status !== MjlExpense::STATUS_FINAL_VALIDATED || (int) $row->fk_user_prevalidated !== (int) $validatorUser->id || empty($row->prevalidation_date) || (int) $row->fk_user_final_valid !== (int) $finalValidatorUser->id || (int) $row->fk_user_valid !== (int) $finalValidatorUser->id || empty($row->final_validation_date) || empty($row->validation_date) || abs((float) $row->final_validated_amount - 12500.0) > 0.001) {
	cleanup($importKey);
	fail('Smoke expense validation metadata was not persisted.');
}

assertValidationCount($expenseId, 'submitted', 1);
assertValidationCount($expenseId, 'prevalidated', 1);
assertValidationCount($expenseId, 'final_validated', 1);

if ($fetched->disburse($adminUser, 'Self disbursement should fail', date('Y-m-d'), 1) >= 0) {
	cleanup($importKey);
	fail('Non-final-validator disbursement should have been rejected.');
}
if ($fetched->disburse($finalValidatorUser, 'MJL Smoke Beneficiary', date('Y-m-d'), 1) <= 0) {
	cleanup($importKey);
	fail('Unable to disburse smoke expense: '.$fetched->error);
}
assertValidationCount($expenseId, 'disbursed', 1);

$submittedEvent = fetchRow('SELECT comment FROM '.$db->prefix().'mjlfinancement_validation WHERE fk_expense = '.((int) $expenseId)." AND action = 'submitted'");
if (!$submittedEvent || $submittedEvent->comment !== 'Submit smoke expense') {
	cleanup($importKey);
	fail('Submit history comment was not persisted.');
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
$missingDocExpense->status = MjlExpense::STATUS_DRAFT;
$missingDocExpense->fk_user_creat = $adminUser->id;
$missingDocExpense->import_key = $importKey;
$missingDocExpenseId = $missingDocExpense->create($adminUser, 1);
if ($missingDocExpenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create missing document smoke expense: '.$missingDocExpense->error);
}
if ($missingDocExpense->submit($adminUser, 'Submit missing document expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to submit missing document smoke expense: '.$missingDocExpense->error);
}
if ($missingDocExpense->validate($validatorUser) >= 0) {
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
$overBudgetExpense->status = MjlExpense::STATUS_DRAFT;
$overBudgetExpense->fk_user_creat = $adminUser->id;
$overBudgetExpense->import_key = $importKey;
$overBudgetExpenseId = $overBudgetExpense->create($adminUser, 1);
if ($overBudgetExpenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create over budget smoke expense: '.$overBudgetExpense->error);
}
insertEcmDocument($overBudgetExpenseId, $entity, 'SMOKE-DOC-OVER-'.$suffix, $adminUser->id);
if ($overBudgetExpense->submit($adminUser, 'Submit over budget expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to submit over budget smoke expense: '.$overBudgetExpense->error);
}
if ($overBudgetExpense->validate($validatorUser) >= 0) {
	cleanup($importKey);
	fail('Over budget validation should have been rejected.');
}

$ecmOnlyExpense = new MjlExpense($db);
$ecmOnlyExpense->entity = $entity;
$ecmOnlyExpense->ref = 'MJL-SMOKE-EXP-ECM-'.$suffix;
$ecmOnlyExpense->fk_project = $projectId;
$ecmOnlyExpense->fk_convention = $conventionId;
$ecmOnlyExpense->fk_budget_line = $budgetLineId;
$ecmOnlyExpense->amount = 1000;
$ecmOnlyExpense->expense_date = dol_now();
$ecmOnlyExpense->description = 'ECM-only document smoke expense';
$ecmOnlyExpense->supporting_document = '';
$ecmOnlyExpense->status = MjlExpense::STATUS_DRAFT;
$ecmOnlyExpense->fk_user_creat = $adminUser->id;
$ecmOnlyExpense->import_key = $importKey;
$ecmOnlyExpenseId = $ecmOnlyExpense->create($adminUser, 1);
if ($ecmOnlyExpenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create ECM-only smoke expense: '.$ecmOnlyExpense->error);
}
if ($ecmOnlyExpense->submit($adminUser, 'Submit ECM-only document expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to submit ECM-only smoke expense: '.$ecmOnlyExpense->error);
}
$ecmOnlyFilename = 'SMOKE-ECM-ONLY-'.$suffix.'.txt';
insertEcmDocument($ecmOnlyExpenseId, $entity, $ecmOnlyFilename, $adminUser->id);
if ($ecmOnlyExpense->prevalidate($validatorUser, 1000, 'Prevalidate ECM-only document expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to prevalidate ECM-only document smoke expense: '.$ecmOnlyExpense->error);
}
if ($ecmOnlyExpense->finalValidate($finalValidatorUser, 1000, 'Final validate ECM-only document expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to final validate ECM-only document smoke expense: '.$ecmOnlyExpense->error);
}
assertValidationCount($ecmOnlyExpenseId, 'prevalidated', 1);
assertValidationCount($ecmOnlyExpenseId, 'final_validated', 1);
$ecmOnlyReport = fetchRow('SELECT '.mjl_expense_supporting_document_sql('e').' AS supporting_document FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.rowid = '.((int) $ecmOnlyExpenseId));
if (!$ecmOnlyReport || $ecmOnlyReport->supporting_document !== $ecmOnlyFilename) {
	cleanup($importKey);
	fail('ECM-only supporting document report fallback did not return the ECM filename.');
}

$correctionExpense = new MjlExpense($db);
$correctionExpense->entity = $entity;
$correctionExpense->ref = 'MJL-SMOKE-EXP-CORR-'.$suffix;
$correctionExpense->fk_project = $projectId;
$correctionExpense->fk_convention = $conventionId;
$correctionExpense->fk_budget_line = $budgetLineId;
$correctionExpense->amount = 1000;
$correctionExpense->expense_date = dol_now();
$correctionExpense->description = 'Correction smoke expense';
$correctionExpense->supporting_document = 'SMOKE-DOC-CORR-'.$suffix;
$correctionExpense->status = MjlExpense::STATUS_DRAFT;
$correctionExpense->fk_user_creat = $adminUser->id;
$correctionExpense->import_key = $importKey;
$correctionExpenseId = $correctionExpense->create($adminUser, 1);
if ($correctionExpenseId <= 0) {
	cleanup($importKey);
	fail('Unable to create correction smoke expense: '.$correctionExpense->error);
}
insertEcmDocument($correctionExpenseId, $entity, 'SMOKE-DOC-CORR-'.$suffix, $adminUser->id);
if ($correctionExpense->submit($adminUser, 'Submit for rejection path', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to submit correction smoke expense: '.$correctionExpense->error);
}
if ($correctionExpense->reject($adminUser, 'Self rejection should fail', 1) >= 0) {
	cleanup($importKey);
	fail('Self-rejection should have been rejected.');
}
assertValidationCount($correctionExpenseId, 'rejected', 0);
if ($correctionExpense->reject($validatorUser, 'Missing approval stamp', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to reject correction smoke expense: '.$correctionExpense->error);
}
$correctionExpense->description = 'Correction smoke expense fixed';
$correctionExpense->amount = 900;
if ($correctionExpense->update($adminUser, 1) <= 0) {
	cleanup($importKey);
	fail('Unable to edit rejected correction smoke expense: '.$correctionExpense->error);
}
$updatedCorrectionExpense = fetchRow('SELECT amount, description FROM '.$db->prefix().'mjlfinancement_expense WHERE rowid = '.((int) $correctionExpenseId));
if (!$updatedCorrectionExpense || abs((float) $updatedCorrectionExpense->amount - 900.0) > 0.001 || $updatedCorrectionExpense->description !== 'Correction smoke expense fixed') {
	cleanup($importKey);
	fail('Rejected correction edits were not persisted.');
}
if ($correctionExpense->correct($adminUser, 'Approval stamp added', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to correct rejected smoke expense: '.$correctionExpense->error);
}
$correctionExpense->amount = 800;
if ($correctionExpense->update($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Corrected expense update should have been rejected.');
}
if ($correctionExpense->validate($validatorUser) >= 0) {
	cleanup($importKey);
	fail('Corrected expense should require resubmission before validation.');
}
if ($correctionExpense->submit($adminUser, 'Resubmit corrected expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to resubmit corrected smoke expense: '.$correctionExpense->error);
}
if ($correctionExpense->prevalidate($validatorUser, 900, 'Prevalidate corrected expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to prevalidate corrected smoke expense: '.$correctionExpense->error);
}
if ($correctionExpense->finalValidate($finalValidatorUser, 900, 'Final validate corrected expense', 1) <= 0) {
	cleanup($importKey);
	fail('Unable to final validate corrected smoke expense: '.$correctionExpense->error);
}
assertValidationCount($correctionExpenseId, 'submitted', 2);
assertValidationCount($correctionExpenseId, 'rejected', 1);
assertValidationCount($correctionExpenseId, 'corrected', 1);
assertValidationCount($correctionExpenseId, 'prevalidated', 1);
assertValidationCount($correctionExpenseId, 'final_validated', 1);

$invalidLinkExpense = new MjlExpense($db);
$invalidLinkExpense->entity = $entity;
$invalidLinkExpense->ref = 'MJL-SMOKE-EXP-BADLINK-'.$suffix;
$invalidLinkExpense->fk_project = $projectId + 999999;
$invalidLinkExpense->fk_convention = $conventionId;
$invalidLinkExpense->fk_budget_line = $budgetLineId;
$invalidLinkExpense->amount = 1000;
$invalidLinkExpense->expense_date = dol_now();
$invalidLinkExpense->description = 'Invalid link smoke expense';
$invalidLinkExpense->status = MjlExpense::STATUS_DRAFT;
$invalidLinkExpense->fk_user_creat = $adminUser->id;
$invalidLinkExpense->import_key = $importKey;
if ($invalidLinkExpense->create($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Expense creation with invalid project link should have been rejected.');
}

$crossEntityExpenseId = insertCrossEntityExpense($entity + 1, $projectId, $conventionId, $budgetLineId, $adminUser->id, $suffix, $importKey);
$crossEntityExpense = new MjlExpense($db);
$crossEntityExpense->id = $crossEntityExpenseId;
$crossEntityExpense->rowid = $crossEntityExpenseId;
$crossEntityExpense->fk_project = $projectId;
$crossEntityExpense->fk_convention = $conventionId;
$crossEntityExpense->fk_budget_line = $budgetLineId;
$crossEntityExpense->amount = 1000;
$crossEntityExpense->status = MjlExpense::STATUS_DRAFT;
$crossEntityExpense->entity = $entity + 1;
if ($crossEntityExpense->submit($adminUser, 'Cross entity submit', 1) >= 0) {
	cleanup($importKey);
	fail('Cross-entity submit should have been rejected.');
}
if ($crossEntityExpense->validate($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Cross-entity validate should have been rejected.');
}
if ($crossEntityExpense->reject($adminUser, 'Cross entity reject', 1) >= 0) {
	cleanup($importKey);
	fail('Cross-entity reject should have been rejected.');
}
if ($crossEntityExpense->correct($adminUser, 'Cross entity correct', 1) >= 0) {
	cleanup($importKey);
	fail('Cross-entity correct should have been rejected.');
}
if ($crossEntityExpense->update($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Cross-entity update should have been rejected.');
}
if ($crossEntityExpense->delete($adminUser, 1) >= 0) {
	cleanup($importKey);
	fail('Cross-entity delete should have been rejected.');
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
$tamperExpense->status = MjlExpense::STATUS_DRAFT;
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
		'DELETE FROM '.$db->prefix().'ecm_files WHERE src_object_type = \'mjlfinancement_expense\' AND src_object_id IN (SELECT rowid FROM '.$db->prefix()."mjlfinancement_expense WHERE import_key = '".$escaped."')",
		'DELETE FROM '.$db->prefix().'mjlfinancement_validation WHERE import_key = \''.$escaped.'\' OR fk_expense IN (SELECT rowid FROM '.$db->prefix()."mjlfinancement_expense WHERE import_key = '".$escaped."')",
		'DELETE FROM '.$db->prefix().'mjlfinancement_workflow_action WHERE import_key = \''.$escaped.'\' OR (object_type = \'mjlfinancement_budget_line\' AND object_id IN (SELECT rowid FROM '.$db->prefix()."mjlfinancement_budget_line WHERE import_key = '".$escaped."')) OR (object_type = 'mjlfinancement_convention' AND object_id IN (SELECT rowid FROM ".$db->prefix()."mjlfinancement_convention WHERE import_key = '".$escaped."'))",
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

function loadSmokeUser($login)
{
	global $db;

	$target = new User($db);
	if ($target->fetch(0, $login) <= 0) {
		fail('Unable to load user '.$login.'. Run bootstrap_poc.php first.');
	}
	if (method_exists($target, 'loadRights')) {
		$target->loadRights();
	}
	return $target;
}

function insertEcmDocument($expenseId, $entity, $filename, $userId)
{
	global $conf, $db;

	$targetDir = rtrim($conf->ecm->dir_output, '/').'/mjlfinancement_expense';
	if (!is_dir($targetDir) && (!function_exists('dol_mkdir') || dol_mkdir($targetDir) < 0)) {
		cleanup('MJLSMOKEVAL');
		fail('Unable to create smoke ECM directory '.$targetDir);
	}
	if (!is_dir($targetDir)) {
		cleanup('MJLSMOKEVAL');
		fail('Smoke ECM directory is unavailable '.$targetDir);
	}
	if (file_put_contents($targetDir.'/'.$filename, 'Smoke expense evidence '.$filename) === false) {
		cleanup('MJLSMOKEVAL');
		fail('Unable to write smoke ECM file '.$filename);
	}

	$sql = 'INSERT INTO '.$db->prefix().'ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)';
	$sql .= ' VALUES (';
	$sql .= "'".$db->escape('MJL-SMOKE-ECM-'.$expenseId)."'";
	$sql .= ", '".$db->escape($filename)."'";
	$sql .= ', '.((int) $entity);
	$sql .= ", '".$db->escape($filename)."'";
	$sql .= ", 'mjlfinancement_expense'";
	$sql .= ", '".$db->escape($filename)."'";
	$sql .= ", 'Piece justificative smoke'";
	$sql .= ', 1';
	$sql .= ", '".$db->idate(dol_now())."'";
	$sql .= ', '.((int) $userId);
	$sql .= ", 'mjlfinancement_expense'";
	$sql .= ', '.((int) $expenseId);
	$sql .= ')';
	if (!$db->query($sql)) {
		cleanup('MJLSMOKEVAL');
		fail('Unable to insert ECM smoke document: '.$db->lasterror());
	}
}

function insertCrossEntityExpense($entity, $projectId, $conventionId, $budgetLineId, $userId, $suffix, $importKey)
{
	global $db;

	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_budget_line, amount, expense_date, description, supporting_document, date_creation, fk_user_creat, import_key, status)';
	$sql .= ' VALUES (';
	$sql .= ((int) $entity);
	$sql .= ", '".$db->escape('MJL-SMOKE-EXP-CROSS-'.$suffix)."'";
	$sql .= ', '.((int) $projectId);
	$sql .= ', '.((int) $conventionId);
	$sql .= ', '.((int) $budgetLineId);
	$sql .= ', 1000';
	$sql .= ", '".$db->idate(dol_now())."'";
	$sql .= ", 'Cross entity smoke expense'";
	$sql .= ", 'SMOKE-DOC-CROSS-".$db->escape($suffix)."'";
	$sql .= ", '".$db->idate(dol_now())."'";
	$sql .= ', '.((int) $userId);
	$sql .= ", '".$db->escape($importKey)."'";
	$sql .= ', '.MjlExpense::STATUS_DRAFT;
	$sql .= ')';
	if (!$db->query($sql)) {
		cleanup($importKey);
		fail('Unable to insert cross-entity smoke expense: '.$db->lasterror());
	}
	return (int) $db->last_insert_id($db->prefix().'mjlfinancement_expense');
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

function assertValidationCount($expenseId, $action, $expected)
{
	global $db;

	$count = fetchScalar('SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_validation WHERE fk_expense = '.((int) $expenseId)." AND action = '".$db->escape($action)."'");
	if ($count !== $expected) {
		cleanup('MJLSMOKEVAL');
		fail('Expected '.$expected.' '.$action.' event(s) for expense '.$expenseId.', got '.$count);
	}
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
