<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once DOL_DOCUMENT_ROOT.'/projet/class/project.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

global $conf, $db, $user;

$adminUser = new User($db);
if ($adminUser->fetch(0, 'admin') <= 0) {
	fail('Unable to load Dolibarr admin user.');
}
$user = $adminUser;
$scopedUser = loadUserByLogin('agent.mjl');
$unresolvedUser = loadUserByLogin('lecteur.audit');

$entity = (int) $conf->entity;
$importKey = 'MJLSMKSCP';
$suffix = date('YmdHis');

cleanup($importKey);

$thirdpartyId = createThirdparty('MJL Scope Smoke Partner '.$suffix, $entity, $adminUser, $importKey);
$otherThirdpartyId = createThirdparty('MJL Scope Smoke Other '.$suffix, $entity, $adminUser, $importKey);
$temporaryUserId = createSmokeUser('scope.profile.'.$suffix, $entity, $adminUser, $importKey);
$projectId = createProject('MJL-SCOPE-PROJ-'.$suffix, 'MJL Scope Smoke Project '.$suffix, $thirdpartyId, $entity, $adminUser, $importKey);
$otherProjectId = createProject('MJL-SCOPE-OTHER-'.$suffix, 'MJL Scope Smoke Other '.$suffix, $otherThirdpartyId, $entity, $adminUser, $importKey);

$conventionId = insertRow('mjlfinancement_convention', array(
	'entity' => $entity,
	'ref' => 'MJL-SCOPE-CONV-'.$suffix,
	'title' => 'MJL Scope Smoke Convention',
	'fk_soc' => $thirdpartyId,
	'fk_project' => $projectId,
	'total_amount' => 100000,
	'currency_code' => 'XOF',
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
	'status' => 1,
));
$otherConventionId = insertRow('mjlfinancement_convention', array(
	'entity' => $entity,
	'ref' => 'MJL-SCOPE-CONV-OTHER-'.$suffix,
	'title' => 'MJL Scope Smoke Other Convention',
	'fk_soc' => $otherThirdpartyId,
	'fk_project' => $otherProjectId,
	'total_amount' => 100000,
	'currency_code' => 'XOF',
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
	'status' => 1,
));
$activityId = insertRow('mjlfinancement_activity', array(
	'entity' => $entity,
	'ref' => 'MJL-SCOPE-ACT-'.$suffix,
	'label' => 'MJL Scope Smoke Activity',
	'fk_project' => $projectId,
	'fk_convention' => $conventionId,
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
	'status' => 0,
));
$budgetLineId = insertRow('mjlfinancement_budget_line', array(
	'entity' => $entity,
	'ref' => 'MJL-SCOPE-BL-'.$suffix,
	'label' => 'MJL Scope Smoke Budget Line',
	'fk_project' => $projectId,
	'fk_convention' => $conventionId,
	'fk_mjl_activity' => $activityId,
	'initial_budget' => 100000,
	'revised_budget' => 100000,
	'committed_amount' => 0,
	'spent_amount' => 0,
	'remaining_amount' => 100000,
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
	'status' => 1,
));
$expenseId = insertRow('mjlfinancement_expense', array(
	'entity' => $entity,
	'ref' => 'MJL-SCOPE-EXP-'.$suffix,
	'fk_project' => $projectId,
	'fk_convention' => $conventionId,
	'fk_mjl_activity' => $activityId,
	'fk_budget_line' => $budgetLineId,
	'amount' => 12500,
	'expense_date' => $db->idate(dol_now()),
	'description' => 'MJL Scope Smoke Expense',
	'supporting_document' => 'scope-smoke.txt',
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
	'status' => 0,
));
$fundReceiptId = insertRow('mjlfinancement_fund_receipt', array(
	'entity' => $entity,
	'ref' => 'MJL-SCOPE-FR-'.$suffix,
	'fk_soc' => $thirdpartyId,
	'fk_project' => $projectId,
	'fk_convention' => $conventionId,
	'amount' => 50000,
	'status' => 1,
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
));
$workflowId = insertRow('mjlfinancement_workflow_action', array(
	'entity' => $entity,
	'ref' => 'MJL-SCOPE-WFA-'.$suffix,
	'object_type' => 'mjlfinancement_expense',
	'object_id' => $expenseId,
	'action' => 'scope_smoke',
	'actor' => $adminUser->id,
	'actor_role' => 'ADMIN',
	'action_date' => $db->idate(dol_now()),
	'changes_json' => '{}',
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
));
$exchangeLogId = insertRow('mjlfinancement_exchange_log', array(
	'entity' => $entity,
	'ref' => 'MJL-SCOPE-EXC-'.$suffix,
	'object_type' => 'mjlfinancement_activity',
	'object_id' => $activityId,
	'exchange_date' => $db->idate(dol_now()),
	'actor' => $adminUser->id,
	'actor_role' => 'ADMIN',
	'message' => 'Scope smoke exchange',
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
));
$projectNoteId = insertRow('mjlfinancement_project_note', array(
	'entity' => $entity,
	'fk_project' => $projectId,
	'message' => 'Scope smoke project note',
	'date_note' => $db->idate(dol_now()),
	'fk_user_author' => $adminUser->id,
	'date_creation' => $db->idate(dol_now()),
	'fk_user_creat' => $adminUser->id,
	'import_key' => $importKey,
));
$documentId = insertEcmFile($expenseId, $entity, $adminUser->id, $importKey);

if (mjl_scope_assign_soc_scope($scopedUser->id, $thirdpartyId, $adminUser->id, $entity, 'smoke_scope_model', 'Temporary scope smoke assignment.', $importKey) <= 0) {
	cleanup($importKey);
	fail('Unable to assign smoke scope.');
}

assertTrue(mjl_scope_is_valid_role_code('AGENT_SAISIE'), 'AGENT_SAISIE should be a valid role code.');
assertFalse(mjl_scope_is_valid_role_code('LECTEUR'), 'LECTEUR must not be an active production role code.');
assertSame('Agent de saisie', mjl_scope_role_label('AGENT_SAISIE'), 'Production role label should be available.');
assertSame(-1, mjl_scope_assign_access_profile($temporaryUserId, 'LECTEUR', array($thirdpartyId), $adminUser, $entity, 'smoke_scope_model', 'Invalid role smoke test.')[0], 'Assignment should reject unresolved legacy LECTEUR.');
assertSame(-1, mjl_scope_assign_access_profile($temporaryUserId, 'AGENT_SAISIE', array(), $adminUser, $entity, 'smoke_scope_model', 'Empty scope smoke test.')[0], 'Business assignment should require at least one scope.');
assertSame(-1, mjl_scope_assign_access_profile($temporaryUserId, 'AGENT_SAISIE', array(99999999), $adminUser, $entity, 'smoke_scope_model', 'Invalid partner smoke test.')[0], 'Assignment should reject a partner outside the active entity.');
$assignProfileResult = mjl_scope_assign_access_profile($temporaryUserId, 'AGENT_SAISIE', array($thirdpartyId), $adminUser, $entity, 'smoke_scope_model', 'Valid assignment smoke test.');
assertSame(1, $assignProfileResult[0], 'Assignment should write role, scope, legacy group, and audit together.');
$temporaryUser = new User($db);
$temporaryUser->fetch($temporaryUserId);
assertSame('AGENT_SAISIE', mjl_scope_active_role_code($temporaryUserId, $entity), 'Assigned user should have AGENT_SAISIE as active production role.');
assertTrue(mjl_scope_can_access_fk_soc($temporaryUser, $thirdpartyId, $entity), 'Assigned user should access the selected scope.');
assertFalse(mjl_scope_can_access_fk_soc($temporaryUser, $otherThirdpartyId, $entity), 'Assigned user should not access another scope.');
assertSame(-1, mjl_scope_deactivate_access($adminUser->id, $adminUser, $entity)[0], 'Admin should not self-deactivate.');
assertSame('', mjl_scope_partner_sql_filter('c.fk_soc', $adminUser, $entity), 'Admin SQL filter should be unrestricted.');
assertSame(' AND 1=0', mjl_scope_partner_sql_filter('bad column', $scopedUser, $entity), 'Invalid SQL identifier should fail closed.');
assertSame(' AND 1=0', mjl_scope_partner_sql_filter('c.fk_soc', $unresolvedUser, $entity), 'Unresolved non-admin SQL filter should fail closed.');
assertTrue(mjl_scope_can_access_object($adminUser, 'mjlfinancement_convention', $otherConventionId, $entity), 'Admin should access all scoped objects.');

$objects = array(
	'mjlfinancement_convention' => $conventionId,
	'mjlfinancement_fund_receipt' => $fundReceiptId,
	'mjlfinancement_activity' => $activityId,
	'mjlfinancement_expense' => $expenseId,
	'mjlfinancement_budget_line' => $budgetLineId,
	'mjlfinancement_workflow_action' => $workflowId,
	'mjlfinancement_exchange_log' => $exchangeLogId,
	'ecm_files' => $documentId,
	'mjlfinancement_project_note' => $projectNoteId,
);
foreach ($objects as $type => $id) {
	assertSame($thirdpartyId, mjl_scope_object_fk_soc($type, $id, $entity), $type.' should resolve to the scoped partner.');
	assertTrue(mjl_scope_can_access_object($scopedUser, $type, $id, $entity), $type.' should be accessible for assigned scope.');
	assertFalse(mjl_scope_can_access_object($unresolvedUser, $type, $id, $entity), $type.' should fail closed for unresolved non-admin.');
}

assertFalse(mjl_scope_can_access_object($scopedUser, 'mjlfinancement_convention', $otherConventionId, $entity), 'Scoped user should not access another partner.');
assertSame(null, mjl_scope_object_fk_soc('unsupported_object_type', 1, $entity), 'Unsupported object type should resolve to null.');
assertFalse(mjl_scope_can_access_object($scopedUser, 'unsupported_object_type', 1, $entity), 'Unsupported object access should fail closed.');
$deactivateResult = mjl_scope_deactivate_access($temporaryUserId, $adminUser, $entity);
assertSame(1, $deactivateResult[0], 'Admin should be able to deactivate a non-admin access profile.');
assertSame('', mjl_scope_active_role_code($temporaryUserId, $entity), 'Deactivated user should have no active role.');

cleanup($importKey);
out('MJL 0.8.0 scope model smoke: OK');

function loadUserByLogin($login)
{
	global $db;

	$user = new User($db);
	if ($user->fetch(0, $login) <= 0) {
		fail('Unable to load smoke user '.$login.'. Run bootstrap_poc.php first.');
	}
	return $user;
}

function createThirdparty($name, $entity, User $adminUser, $importKey)
{
	global $db;

	$thirdparty = new Societe($db);
	$thirdparty->name = $name;
	$thirdparty->nom = $name;
	$thirdparty->entity = $entity;
	$thirdparty->status = 1;
	$thirdparty->client = 0;
	$thirdparty->fournisseur = 0;
	$thirdparty->import_key = $importKey;
	$id = $thirdparty->create($adminUser, 1);
	if ($id <= 0) {
		fail('Unable to create smoke thirdparty: '.$thirdparty->error);
	}
	return (int) $id;
}

function createSmokeUser($login, $entity, User $adminUser, $importKey)
{
	global $db;

	$user = new User($db);
	$user->login = $login;
	$user->firstname = 'Smoke';
	$user->lastname = 'Scope';
	$user->email = $login.'@mjl-poc.local';
	$user->entity = $entity;
	$user->statut = 1;
	$user->status = 1;
	$user->admin = 0;
	$id = $user->create($adminUser, 1);
	if ($id <= 0) {
		cleanup($importKey);
		fail('Unable to create smoke user: '.$user->error);
	}
	return (int) $id;
}

function createProject($ref, $title, $thirdpartyId, $entity, User $adminUser, $importKey)
{
	global $db;

	$project = new Project($db);
	$project->ref = $ref;
	$project->title = $title;
	$project->socid = $thirdpartyId;
	$project->fk_soc = $thirdpartyId;
	$project->public = 0;
	$project->status = 1;
	$project->statut = 1;
	$project->entity = $entity;
	$project->import_key = $importKey;
	$id = $project->create($adminUser, 1);
	if ($id <= 0) {
		cleanup($importKey);
		fail('Unable to create smoke project: '.$project->error);
	}
	$sql = 'UPDATE '.$db->prefix().'projet SET import_key = '.smokeSqlValue($importKey).' WHERE rowid = '.((int) $id);
	if (!$db->query($sql)) {
		cleanup($importKey);
		fail('Unable to mark smoke project: '.$db->lasterror());
	}
	return (int) $id;
}

function insertRow($table, array $values)
{
	global $db;

	$columns = array();
	$sqlValues = array();
	foreach ($values as $column => $value) {
		$columns[] = $column;
		$sqlValues[] = smokeSqlValue($value);
	}
	$sql = 'INSERT INTO '.$db->prefix().$table.' ('.implode(', ', $columns).') VALUES ('.implode(', ', $sqlValues).')';
	if (!$db->query($sql)) {
		fail('Unable to insert '.$table.': '.$db->lasterror());
	}
	return (int) $db->last_insert_id($db->prefix().$table);
}

function insertEcmFile($expenseId, $entity, $userId, $importKey)
{
	global $db;

	$ref = 'MJL-SCOPE-ECM-'.$expenseId;
	$sql = 'INSERT INTO '.$db->prefix().'ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)';
	$sql .= ' VALUES (';
	$sql .= smokeSqlValue($ref).', '.smokeSqlValue('scope-smoke.txt').', '.((int) $entity).', '.smokeSqlValue('scope-smoke.txt').', '.smokeSqlValue($importKey).', '.smokeSqlValue('scope-smoke.txt').', '.smokeSqlValue('Scope smoke document').', 1, '.smokeSqlValue($db->idate(dol_now())).', '.((int) $userId).', '.smokeSqlValue('mjlfinancement_expense').', '.((int) $expenseId).')';
	if (!$db->query($sql)) {
		cleanup($importKey);
		fail('Unable to insert smoke ECM file: '.$db->lasterror());
	}
	return (int) $db->last_insert_id($db->prefix().'ecm_files');
}

function smokeSqlValue($value)
{
	global $db;

	if ($value === null || $value === '') {
		return 'NULL';
	}
	if (is_int($value) || is_float($value)) {
		return (string) $value;
	}
	return "'".$db->escape((string) $value)."'";
}

function cleanup($importKey)
{
	global $db;

	$escaped = $db->escape($importKey);
	$queries = array(
		'DELETE FROM '.$db->prefix()."mjlfinancement_user_soc_scope WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_user_soc_scope WHERE fk_user IN (SELECT rowid FROM ".$db->prefix()."user WHERE login LIKE 'scope.profile.%')",
		'DELETE FROM '.$db->prefix()."mjlfinancement_user_role WHERE fk_user IN (SELECT rowid FROM ".$db->prefix()."user WHERE login LIKE 'scope.profile.%')",
		'DELETE FROM '.$db->prefix()."mjlfinancement_access_audit WHERE fk_user IN (SELECT rowid FROM ".$db->prefix()."user WHERE login LIKE 'scope.profile.%')",
		'DELETE FROM '.$db->prefix()."usergroup_user WHERE fk_user IN (SELECT rowid FROM ".$db->prefix()."user WHERE login LIKE 'scope.profile.%')",
		'DELETE FROM '.$db->prefix()."user WHERE login LIKE 'scope.profile.%'",
		'DELETE FROM '.$db->prefix()."ecm_files WHERE filepath = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_exchange_log WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_workflow_action WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_project_note WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_fund_receipt WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_expense WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_budget_line WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_activity WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix()."mjlfinancement_convention WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix().'projet WHERE fk_soc IN (SELECT rowid FROM '.$db->prefix()."societe WHERE import_key = '".$escaped."')",
		'DELETE FROM '.$db->prefix()."projet WHERE import_key = '".$escaped."'",
		'DELETE FROM '.$db->prefix().'societe_commerciaux WHERE fk_soc IN (SELECT rowid FROM '.$db->prefix()."societe WHERE import_key = '".$escaped."')",
		'DELETE FROM '.$db->prefix()."societe WHERE import_key = '".$escaped."'",
	);
	foreach ($queries as $sql) {
		if (!$db->query($sql)) {
			fail('Cleanup failed: '.$db->lasterror());
		}
	}
}

function assertTrue($condition, $message)
{
	if (!$condition) {
		cleanup('MJLSMKSCP');
		fail($message);
	}
}

function assertFalse($condition, $message)
{
	assertTrue(!$condition, $message);
}

function assertSame($expected, $actual, $message)
{
	if ($expected !== $actual) {
		cleanup('MJLSMKSCP');
		fail($message.' Expected='.var_export($expected, true).' Actual='.var_export($actual, true));
	}
}

function out($message)
{
	print $message.PHP_EOL;
}

function fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(2);
}
