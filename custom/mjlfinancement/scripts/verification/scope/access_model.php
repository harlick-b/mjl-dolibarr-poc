<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

global $conf, $db, $user;

$admin = new User($db);
if ($admin->fetch(0, 'admin') <= 0) fail('Unable to load the preserved native administrator.');
$user = $admin;
$entity = (int) $conf->entity;
$marker = 'R2'.date('ymdHis');
$logins = array(strtolower($marker).'.role', strtolower($marker).'.rollback');

cleanup($marker, $logins);
$exitCode = 0;
try {
	assertSame(0, scalar('SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_user_soc_scope'), 'Retained Partner-scope table must start empty.');
	$roleUserId = createUser($logins[0], $entity, $admin, $marker);
	$rollbackUserId = createUser($logins[1], $entity, $admin, $marker);
	$roleUser = new User($db);
	if ($roleUser->fetch($roleUserId) <= 0) fail('Unable to load role-only verification user.');

	assertSame(-1, mjl_scope_assign_access_profile($roleUserId, 'LECTEUR', $admin, $entity, 'rst002a_verify', 'Invalid role')[0], 'Unknown role must fail closed.');
	$result = mjl_scope_assign_access_profile($roleUserId, 'AGENT_SAISIE', $admin, $entity, 'rst002a_verify', 'Role-only assignment');
	assertSame(1, $result[0], 'Role-only access-profile assignment must succeed without a Partner.');
	assertSame('AGENT_SAISIE', mjl_scope_active_role_code($roleUserId, $entity), 'Assigned effective role must be active.');
	assertSame(1, scalar('SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_user_role WHERE entity = '.$entity.' AND fk_user = '.$roleUserId.' AND is_active = 1'), 'Exactly one active role must remain.');
	assertSame(0, scalar('SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_user_soc_scope'), 'Role-only assignment must write no Partner-scope row.');
	$auditContext = scalarString('SELECT context FROM '.$db->prefix()."mjlfinancement_access_audit WHERE entity = ".$entity." AND fk_user = ".$roleUserId." AND event = 'access_profile_assigned' ORDER BY rowid DESC LIMIT 1");
	assertTrue(strpos($auditContext, 'role=AGENT_SAISIE') !== false, 'Audit must retain the assigned role.');
	assertTrue(strpos($auditContext, 'source=rst002a_verify') !== false, 'Audit must retain the assignment source.');
	assertTrue(stripos($auditContext, 'scope') === false, 'Audit must contain no retired Partner-scope context.');

	$trigger = $db->prefix().'rst002a_fail_access_audit';
	query('DROP TRIGGER IF EXISTS '.$trigger);
	query("CREATE TRIGGER ".$trigger." BEFORE INSERT ON ".$db->prefix()."mjlfinancement_access_audit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RST002A audit rollback proof'");
	$rollbackResult = mjl_scope_assign_access_profile($rollbackUserId, 'AGENT_VERIFICATEUR', $admin, $entity, 'rst002a_verify', 'Rollback proof');
	query('DROP TRIGGER IF EXISTS '.$trigger);
	assertSame(-1, $rollbackResult[0], 'Access-profile mutation must fail when audit persistence fails.');
	assertSame(0, scalar('SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_user_role WHERE fk_user = '.$rollbackUserId), 'Failed audited assignment must roll back its role row.');
	assertSame(0, scalar('SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_user_soc_scope'), 'Audit failure must not affect the retained Partner-scope table.');
	assertSame(-1, mjl_scope_assign_access_profile($roleUserId + 99999999, 'AGENT_VERIFICATEUR', $admin, $entity, 'rst002a_verify', 'Entity isolation')[0], 'Unknown/cross-entity target must fail closed.');

	out('MJL RST-002A role-only access model verification: OK');
} catch (Throwable $error) {
	fwrite(STDERR, 'ERROR: '.$error->getMessage().PHP_EOL);
	$exitCode = 1;
} finally {
	query('DROP TRIGGER IF EXISTS '.$db->prefix().'rst002a_fail_access_audit', false);
	cleanup($marker, $logins);
}
exit($exitCode);

function createUser($login, $entity, User $admin, $marker)
{
	global $db;
	$sql = 'INSERT INTO '.$db->prefix().'user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec, fk_user_creat, import_key)';
	$sql .= " SELECT ".((int) $entity).", '".$db->escape($login)."', 'RST002A', 'Verification', '".$db->escape($login).'@mjl.invalid'."', pass_crypted, 1, 0, NOW(), ".((int) $admin->id).", '".$db->escape($marker)."'";
	$sql .= ' FROM '.$db->prefix().'user WHERE rowid = '.((int) $admin->id);
	query($sql);
	$id = (int) $db->last_insert_id($db->prefix().'user');
	if ($id <= 0) fail('Unable to create disposable role-only verification user.');
	return $id;
}

function cleanup($marker, array $logins)
{
	global $db;
	$quoted = array();
	foreach ($logins as $login) $quoted[] = "'".$db->escape($login)."'";
	$userIds = 'SELECT rowid FROM '.$db->prefix().'user WHERE login IN ('.implode(',', $quoted).')';
	query('DELETE FROM '.$db->prefix().'mjlfinancement_access_audit WHERE fk_user IN ('.$userIds.') OR fk_actor IN ('.$userIds.')', false);
	query('DELETE FROM '.$db->prefix().'mjlfinancement_invitation WHERE fk_user IN ('.$userIds.')', false);
	query('DELETE FROM '.$db->prefix().'mjlfinancement_user_role WHERE fk_user IN ('.$userIds.')', false);
	query('DELETE FROM '.$db->prefix().'user_rights WHERE fk_user IN ('.$userIds.')', false);
	query('DELETE FROM '.$db->prefix().'usergroup_user WHERE fk_user IN ('.$userIds.')', false);
	query('DELETE FROM '.$db->prefix().'user WHERE login IN ('.implode(',', $quoted).') AND import_key = \''.$db->escape($marker).'\'', false);
}

function scalar($sql)
{
	return (int) scalarString($sql);
}

function scalarString($sql)
{
	global $db;
	$resql = $db->query($sql);
	if (!$resql) fail($db->lasterror());
	$obj = $db->fetch_object($resql);
	if (!$obj) return '';
	foreach ($obj as $value) return (string) $value;
	return '';
}

function query($sql, $required = true)
{
	global $db;
	if (!$db->query($sql) && $required) fail($db->lasterror());
}

function assertSame($expected, $actual, $message)
{
	if ($expected !== $actual) fail($message.' Expected '.var_export($expected, true).', got '.var_export($actual, true).'.');
}

function assertTrue($condition, $message)
{
	if (!$condition) fail($message);
}

function out($message)
{
	echo $message.PHP_EOL;
}

function fail($message)
{
	throw new RuntimeException($message);
}
