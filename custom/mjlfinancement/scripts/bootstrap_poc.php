<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/usergroup.class.php';

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
	'modExpenseReport',
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
	out('Activated '.$module);
}

foreach (array('MAIN_MODULE_USER', 'MAIN_MODULE_SOCIETE', 'MAIN_MODULE_PROJET', 'MAIN_MODULE_ECM', 'MAIN_MODULE_ACCOUNTING', 'MAIN_MODULE_EXPENSEREPORT', 'MAIN_MODULE_EXPORT', 'MAIN_MODULE_MODULEBUILDER', 'MAIN_MODULE_API', 'MAIN_MODULE_MJLFINANCEMENT') as $constant) {
	assertConstant($constant, $entity);
}

$groups = array(
	'MJL POC - Comptable' => array(
		array('societe', 'lire', null),
		array('projet', 'lire', null),
		array('ecm', 'read', null),
		array('ecm', 'upload', null),
		array('expensereport', 'lire', null),
		array('expensereport', 'creer', null),
		array('expensereport', 'export', null),
		array('mjlfinancement', 'convention', 'read'),
		array('mjlfinancement', 'budgetline', 'read'),
		array('mjlfinancement', 'expense', 'read'),
		array('mjlfinancement', 'expense', 'write'),
	),
	'MJL POC - Responsable Projet' => array(
		array('societe', 'lire', null),
		array('projet', 'lire', null),
		array('projet', 'all', 'lire'),
		array('ecm', 'read', null),
		array('mjlfinancement', 'convention', 'read'),
		array('mjlfinancement', 'budgetline', 'read'),
		array('mjlfinancement', 'expense', 'read'),
	),
	'MJL POC - Validateur' => array(
		array('societe', 'lire', null),
		array('projet', 'lire', null),
		array('ecm', 'read', null),
		array('expensereport', 'lire', null),
		array('expensereport', 'approve', null),
		array('mjlfinancement', 'expense', 'read'),
		array('mjlfinancement', 'expense', 'validate'),
	),
	'MJL POC - Lecteur' => array(
		array('societe', 'lire', null),
		array('projet', 'lire', null),
		array('ecm', 'read', null),
		array('mjlfinancement', 'convention', 'read'),
		array('mjlfinancement', 'budgetline', 'read'),
		array('mjlfinancement', 'expense', 'read'),
		array('mjlfinancement', 'export', 'read'),
	),
	'MJL POC - Admin' => array(),
);

$groupIds = array();
foreach ($groups as $groupName => $rights) {
	$groupIds[$groupName] = ensureGroup($groupName, $entity);
}

resetGroupRights(array_values($groupIds), $entity);

foreach ($groups as $groupName => $rights) {
	foreach ($rights as $rightTuple) {
		$rightId = resolveRight($rightTuple[0], $rightTuple[1], $rightTuple[2], $entity);
		grantGroupRight($groupIds[$groupName], $rightId, $entity);
	}
	out('Applied rights for '.$groupName);
}

$users = array(
	'admin_poc' => array('firstname' => 'Admin', 'lastname' => 'POC', 'group' => 'MJL POC - Admin', 'admin' => 1, 'api' => 1),
	'comptable' => array('firstname' => 'Comptable', 'lastname' => 'POC', 'group' => 'MJL POC - Comptable', 'admin' => 0, 'api' => 0),
	'responsable_projet' => array('firstname' => 'Responsable', 'lastname' => 'Projet', 'group' => 'MJL POC - Responsable Projet', 'admin' => 0, 'api' => 0),
	'validateur' => array('firstname' => 'Validateur', 'lastname' => 'POC', 'group' => 'MJL POC - Validateur', 'admin' => 0, 'api' => 0),
	'lecteur' => array('firstname' => 'Lecteur', 'lastname' => 'POC', 'group' => 'MJL POC - Lecteur', 'admin' => 0, 'api' => 0),
);

foreach ($users as $login => $spec) {
	$createdUser = ensureUser($login, $spec['firstname'], $spec['lastname'], (int) $spec['admin'], $defaultPassword, $entity);
	assignExactMjlGroup($createdUser->id, $groupIds[$spec['group']], array_values($groupIds), $entity);
	if (!empty($spec['api'])) {
		ensureApiKey($createdUser, $adminUser);
	}
	out('Prepared user '.$login);
}

out('MJL POC bootstrap completed.');

function ensureGroup($name, $entity)
{
	global $db;

	$group = new UserGroup($db);
	if ($group->fetch(0, $name) > 0 && !empty($group->id)) {
		return (int) $group->id;
	}

	$group->name = $name;
	$group->nom = $name;
	$group->note = 'Created by MJL POC bootstrap';
	$group->entity = $entity;
	$result = $group->create(1);
	if ($result <= 0) {
		fail('Unable to create group '.$name.': '.$group->error);
	}

	return (int) $group->id;
}

function ensureUser($login, $firstname, $lastname, $isAdmin, $password, $entity)
{
	global $db, $adminUser;

	$createdUser = new User($db);
	if ($createdUser->fetch(0, $login) <= 0) {
		$createdUser->login = $login;
		$createdUser->firstname = $firstname;
		$createdUser->lastname = $lastname;
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
	$createdUser->admin = $isAdmin;
	$createdUser->statut = 1;
	$createdUser->status = 1;
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
	if (!$db->query($sql)) {
		fail('Unable to reset POC group rights: '.$db->lasterror());
	}
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

	$sql = 'INSERT INTO '.$db->prefix().'usergroup_rights (entity, fk_usergroup, fk_id)';
	$sql .= ' VALUES ('.$entity.', '.((int) $groupId).', '.((int) $rightId).')';
	if (!$db->query($sql)) {
		fail('Unable to grant right '.$rightId.' to group '.$groupId.': '.$db->lasterror());
	}
}

function assignExactMjlGroup($userId, $targetGroupId, $allPocGroupIds, $entity)
{
	global $db;

	$sql = 'DELETE FROM '.$db->prefix().'usergroup_user WHERE entity = '.$entity.' AND fk_user = '.((int) $userId);
	$sql .= ' AND fk_usergroup IN ('.implode(',', array_map('intval', $allPocGroupIds)).')';
	if (!$db->query($sql)) {
		fail('Unable to reset POC group membership for user '.$userId.': '.$db->lasterror());
	}

	$sql = 'INSERT INTO '.$db->prefix().'usergroup_user (entity, fk_user, fk_usergroup)';
	$sql .= ' VALUES ('.$entity.', '.((int) $userId).', '.((int) $targetGroupId).')';
	if (!$db->query($sql)) {
		fail('Unable to assign POC group '.$targetGroupId.' to user '.$userId.': '.$db->lasterror());
	}
}

function ensureApiKey(User $targetUser, User $adminUser)
{
	$targetUser->api_key = $targetUser->api_key ?: bin2hex(random_bytes(24));
	$result = $targetUser->update($adminUser, 1, 1, 1, 1);
	if ($result < 0) {
		fail('Unable to set API key for '.$targetUser->login.': '.$targetUser->error);
	}
	out('API key for '.$targetUser->login.': '.$targetUser->api_key);
}

function assertConstant($name, $entity)
{
	global $db;

	$sql = 'SELECT value FROM '.$db->prefix().'const';
	$sql .= " WHERE name = '".$db->escape($name)."' AND entity IN (0, ".$entity.')';
	$sql .= ' ORDER BY entity DESC';
	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to read constant '.$name.': '.$db->lasterror());
	}
	$obj = $db->fetch_object($resql);
	if (!$obj || (string) $obj->value !== '1') {
		fail('Required module constant is not enabled: '.$name);
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
