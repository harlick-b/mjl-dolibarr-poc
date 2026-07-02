<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/usergroup.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_sample_data.lib.php';

global $conf, $db, $user;

$defaultPassword = getenv('MJL_POC_DEFAULT_PASSWORD') ?: 'MjlPoc2026!!';
$entity = (int) $conf->entity;

$adminUser = new User($db);
if ($adminUser->fetch(0, 'admin') <= 0) {
	fail('Unable to load Dolibarr admin user. Run the installer before bootstrapping the POC.');
}
$user = $adminUser;

$modules = array(
	'modUser',
	'modSociete',
	'modProjet',
	'modECM',
	'modAccounting',
	'modExport',
	'modModuleBuilder',
	'modApi',
	'modMjlFinancement',
);

foreach ($modules as $module) {
	$result = activateModule($module, 1, 1);
	if ($result < 0) {
		fail('Failed to activate '.$module);
	}
	mjl_out('Activated '.$module);
}

mjl_ensure_schema();
mjl_ensure_phase4_auth_setup($adminUser, $entity);

$roles = mjl_csv_map('roles_permissions.csv', 'role_code');
$users = mjl_csv_rows('users.csv');
$groupIds = array();

foreach ($roles as $roleCode => $role) {
	$groupIds[$roleCode] = ensureGroup('MJL POC - '.$role['label_fr'], $entity);
}

resetGroupRights(array_values($groupIds), $entity);

foreach ($roles as $roleCode => $role) {
	foreach (rightsForRole($role) as $rightTuple) {
		$rightId = resolveRight($rightTuple[0], $rightTuple[1], $rightTuple[2], $entity);
		grantGroupRight($groupIds[$roleCode], $rightId, $entity);
	}
	mjl_out('Applied rights for '.$role['label_fr']);
}

$sampleLogins = array();
foreach ($users as $row) {
	$sampleLogins[] = $row['login'];
	$role = $roles[$row['role_code']];
	$isAdmin = $row['role_code'] === 'ADMIN' || $role['can_manage_setup'] === 'yes' || $role['can_manage_users'] === 'yes';
	$createdUser = ensureUser($row['login'], $row['firstname'], $row['lastname'], $row['email'], $isAdmin ? 1 : 0, $row['active'] === 'yes' ? 1 : 0, $defaultPassword, $entity);
	assignExactMjlGroup($createdUser->id, $groupIds[$row['role_code']], array_values($groupIds), $entity);
	if ($row['role_code'] === 'ADMIN') {
		ensureApiKey($createdUser, $adminUser);
	}
	mjl_out('Prepared user '.$row['login']);
}

disableLegacyPocUsers($sampleLogins, $adminUser);

mjl_out('MJL POC bootstrap completed from CSV sample data.');

function rightsForRole($role)
{
	$rights = array(
		array('mjlfinancement', 'convention', 'read'),
		array('mjlfinancement', 'activity', 'read'),
		array('mjlfinancement', 'budgetline', 'read'),
		array('mjlfinancement', 'fundreceipt', 'read'),
		array('mjlfinancement', 'expense', 'read'),
		array('mjlfinancement', 'validation', 'read'),
		array('mjlfinancement', 'workflowaction', 'read'),
		array('mjlfinancement', 'exchangelog', 'read'),
		array('mjlfinancement', 'report', 'read'),
	);

	if ($role['can_create_convention'] === 'yes') {
		$rights[] = array('mjlfinancement', 'convention', 'write');
	}
	if ($role['can_manage_setup'] === 'yes' || $role['can_manage_users'] === 'yes') {
		$rights[] = array('societe', 'lire', null);
		$rights[] = array('projet', 'lire', null);
	}
	if ($role['can_create_expense'] === 'yes' || $role['can_submit_expense'] === 'yes') {
		$rights[] = array('mjlfinancement', 'activity', 'write');
		$rights[] = array('mjlfinancement', 'exchangelog', 'write');
	}
	if ($role['can_create_budget_line'] === 'yes') {
		$rights[] = array('mjlfinancement', 'budgetline', 'write');
	}
	if ($role['can_create_fund_receipt'] === 'yes') {
		$rights[] = array('mjlfinancement', 'fundreceipt', 'write');
	}
	if ($role['can_create_expense'] === 'yes' || $role['can_submit_expense'] === 'yes') {
		$rights[] = array('mjlfinancement', 'expense', 'write');
	}
	if ($role['can_validate_expense'] === 'yes') {
		$rights[] = array('mjlfinancement', 'activity', 'validate');
		$rights[] = array('mjlfinancement', 'expense', 'validate');
		$rights[] = array('mjlfinancement', 'validation', 'write');
		$rights[] = array('mjlfinancement', 'workflowaction', 'write');
		$rights[] = array('mjlfinancement', 'exchangelog', 'write');
	}
	if ($role['can_export_reports'] === 'yes') {
		$rights[] = array('mjlfinancement', 'export', 'read');
		$rights[] = array('mjlfinancement', 'export', 'write');
	}

	return $rights;
}

function ensureGroup($name, $entity)
{
	global $db;

	$group = new UserGroup($db);
	if ($group->fetch(0, $name) > 0 && !empty($group->id)) {
		return (int) $group->id;
	}

	$group->name = $name;
	$group->nom = $name;
	$group->note = 'Created by MJL POC bootstrap from sample CSV';
	$group->entity = $entity;
	$result = $group->create(1);
	if ($result <= 0) {
		fail('Unable to create group '.$name.': '.$group->error);
	}

	return (int) $group->id;
}

function ensureUser($login, $firstname, $lastname, $email, $isAdmin, $active, $password, $entity)
{
	global $db, $adminUser;

	$createdUser = new User($db);
	if ($createdUser->fetch(0, $login) <= 0) {
		$createdUser->login = $login;
		$createdUser->firstname = $firstname;
		$createdUser->lastname = $lastname;
		$createdUser->email = $email;
		$createdUser->admin = $isAdmin;
		$createdUser->entity = $entity;
		$result = $createdUser->create($adminUser, 1);
		if ($result <= 0) {
			fail('Unable to create user '.$login.': '.$createdUser->error);
		}
		$createdUser->fetch($result);
	}

	$createdUser->firstname = $firstname;
	$createdUser->lastname = $lastname;
	$createdUser->email = $email;
	$createdUser->admin = $isAdmin;
	$createdUser->statut = $active;
	$createdUser->status = $active;
	$result = $createdUser->update($adminUser, 1, 1, 1, 1);
	if ($result < 0) {
		fail('Unable to update user '.$login.': '.$createdUser->error);
	}

	$result = $createdUser->setPassword($adminUser, $password, 0, 1);
	if (is_int($result) && $result < 0) {
		fail('Unable to set password for '.$login.': '.$createdUser->error);
	}

	$createdUser->fetch(0, $login);
	return $createdUser;
}

function resetGroupRights($groupIds, $entity)
{
	global $db;

	if (empty($groupIds)) {
		return;
	}
	$sql = 'DELETE FROM '.$db->prefix().'usergroup_rights WHERE entity = '.$entity.' AND fk_usergroup IN ('.implode(',', array_map('intval', $groupIds)).')';
	mjl_query($sql, 'reset POC group rights');
}

function resolveRight($module, $perms, $subperms, $entity)
{
	global $db;

	$sql = 'SELECT id FROM '.$db->prefix().'rights_def';
	$sql .= " WHERE module = '".$db->escape($module)."'";
	$sql .= " AND perms = '".$db->escape($perms)."'";
	if ($subperms === null || $subperms === '') {
		$sql .= ' AND (subperms IS NULL OR subperms = \'\')';
	} else {
		$sql .= " AND subperms = '".$db->escape($subperms)."'";
	}
	$sql .= ' AND entity IN (0, '.$entity.')';
	$sql .= ' ORDER BY entity DESC';

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to resolve right '.$module.'/'.$perms.'/'.$subperms.': '.$db->lasterror());
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		fail('Missing right '.$module.'/'.$perms.($subperms ? '/'.$subperms : '').' after module activation.');
	}
	return (int) $obj->id;
}

function grantGroupRight($groupId, $rightId, $entity)
{
	global $db;

	$sql = 'INSERT IGNORE INTO '.$db->prefix().'usergroup_rights (entity, fk_usergroup, fk_id)';
	$sql .= ' VALUES ('.$entity.', '.((int) $groupId).', '.((int) $rightId).')';
	mjl_query($sql, 'grant right '.$rightId.' to group '.$groupId);
}

function assignExactMjlGroup($userId, $targetGroupId, $allPocGroupIds, $entity)
{
	global $db;

	$sql = 'DELETE FROM '.$db->prefix().'usergroup_user WHERE entity = '.$entity.' AND fk_user = '.((int) $userId);
	$sql .= ' AND fk_usergroup IN (SELECT rowid FROM '.$db->prefix().'usergroup WHERE entity = '.$entity." AND nom LIKE 'MJL POC - %')";
	mjl_query($sql, 'reset POC group membership');

	$sql = 'INSERT INTO '.$db->prefix().'usergroup_user (entity, fk_user, fk_usergroup)';
	$sql .= ' VALUES ('.$entity.', '.((int) $userId).', '.((int) $targetGroupId).')';
	mjl_query($sql, 'assign POC group');
}

function ensureApiKey(User $targetUser, User $adminUser)
{
	$targetUser->api_key = $targetUser->api_key ?: bin2hex(random_bytes(24));
	$result = $targetUser->update($adminUser, 1, 1, 1, 1);
	if ($result < 0) {
		fail('Unable to set API key for '.$targetUser->login.': '.$targetUser->error);
	}
	mjl_out('API key for '.$targetUser->login.': '.$targetUser->api_key);
}

function mjl_ensure_phase4_auth_setup(User $adminUser, $entity)
{
	global $db;

	$constants = array(
		'MAIN_MODULE_MJLFINANCEMENT_TPL' => '1',
		'MAIN_MODULE_MJLFINANCEMENT_HOOKS' => json_encode(array('all', 'login', 'passwordforgottenpage')),
		'MAIN_MODULE_MJLFINANCEMENT_CSS' => json_encode(array('/mjlfinancement/css/mjl_auth.css.php', '/mjlfinancement/css/mjl_app.css.php')),
		'MAIN_MODULE_MJLFINANCEMENT_JS' => json_encode(array('/mjlfinancement/js/native_guard.js.php?v=nav-unification')),
		'MAIN_APPLICATION_TITLE' => 'MJL Financement',
		'MAIN_LANDING_PAGE' => '/custom/mjlfinancement/index.php',
		'MJL_SHOW_INTERNAL_ROADMAP' => '0',
	);

	foreach ($constants as $name => $value) {
		$sql = 'SELECT rowid FROM '.$db->prefix().'const WHERE name = \''.$db->escape($name).'\' AND entity = '.((int) $entity);
		$resql = $db->query($sql);
		if (!$resql) {
			fail('Unable to inspect constant '.$name.': '.$db->lasterror());
		}
		$obj = $db->fetch_object($resql);
		if ($obj) {
			$sql = 'UPDATE '.$db->prefix().'const SET value = \''.$db->escape($value).'\', type = \'chaine\', visible = 0 WHERE rowid = '.((int) $obj->rowid);
		} else {
			$sql = 'INSERT INTO '.$db->prefix().'const (name, entity, value, type, visible, note) VALUES (';
			$sql .= '\''.$db->escape($name).'\', '.((int) $entity).', \''.$db->escape($value).'\', \'chaine\', 0, \'MJL Phase 4 auth setup\')';
		}
		mjl_query($sql, 'set auth constant '.$name);
	}

	mjl_out('Applied MJL Phase 4 auth constants');
}

function disableLegacyPocUsers($sampleLogins, User $adminUser)
{
	global $db;

	$legacy = array('admin_poc', 'comptable', 'responsable_projet', 'validateur', 'lecteur');
	foreach ($legacy as $login) {
		if (in_array($login, $sampleLogins, true)) {
			continue;
		}
		$legacyUser = new User($db);
		if ($legacyUser->fetch(0, $login) > 0) {
			$legacyUser->statut = 0;
			$legacyUser->status = 0;
			$legacyUser->update($adminUser, 1, 1, 1, 1);
			mjl_out('Disabled legacy POC user '.$login);
		}
	}
}
