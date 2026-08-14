<?php

require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

function phase1_behavior_fail($message)
{
	global $db;
	if ($db->transaction_opened > 0) $db->rollback('Phase 1 behavior verifier failure');
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(1);
}

$db->begin('Phase 1 audit behavior verifier');
$auditId = mjl_audit_append_in_transaction($db, array(
	'entity' => 1,
	'object_type' => 'phase1_verifier',
	'object_ref' => 'token=object-secret',
	'action' => 'audit_contract_checked',
	'result' => 'SUCCESS',
	'reason' => 'password=reason-secret',
	'context' => array('detail' => 'https://example.test/#verifier=rawsecret token=rawtoken'),
));
if ($auditId < 1) phase1_behavior_fail('Transactional audit append failed.');
$resql = $db->query('SELECT object_ref, reason, context_json FROM '.$db->prefix().'mjlfinancement_audit_event WHERE rowid='.$auditId);
$row = $resql ? $db->fetch_object($resql) : null;
$serialized = $row ? (string) $row->object_ref.' '.(string) $row->reason.' '.(string) $row->context_json : '';
if (!$row || strpos($serialized, 'rawsecret') !== false || strpos($serialized, 'rawtoken') !== false || strpos($serialized, 'object-secret') !== false || strpos($serialized, 'reason-secret') !== false || strpos($serialized, '[REDACTED]') === false) phase1_behavior_fail('Audit secret sanitization failed.');
if ($db->query('UPDATE '.$db->prefix().'mjlfinancement_audit_event SET action=\'tampered\' WHERE rowid='.$auditId)) phase1_behavior_fail('Audit UPDATE trigger did not reject mutation.');
if (mjl_audit_record_outcome($db, array('entity' => 1, 'object_type' => 'phase1_verifier', 'action' => 'nested_outcome', 'result' => 'FAILED')) !== -1) phase1_behavior_fail('Standalone outcome writer accepted an open transaction.');
$db->rollback('Phase 1 audit behavior verifier');

$resql = $db->query('SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_audit_event WHERE rowid='.$auditId);
$row = $resql ? $db->fetch_object($resql) : null;
if (!$row || (int) $row->nb !== 0) phase1_behavior_fail('Audit verifier transaction left persistent evidence.');

$db->begin('Phase 1 service authorization verifier');
$sql = 'INSERT INTO '.$db->prefix()."user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec) SELECT 1, 'phase1.service.denied', 'Verifier', 'Service', 'phase1.service.denied@example.test', pass_crypted, 1, 0, NOW() FROM ".$db->prefix().'user WHERE rowid=1';
if (!$db->query($sql)) phase1_behavior_fail('Could not create rollback-only service actor.');
$actorId = (int) $db->last_insert_id($db->prefix().'user');
$actor = new User($db);
if ($actor->fetch($actorId) <= 0) phase1_behavior_fail('Could not load rollback-only service actor.');
$profile = mjl_scope_assign_access_profile($actorId, 'AGENT_SAISIE', $actor, 1, 'phase1_verifier', 'denied');
$deactivation = mjl_scope_deactivate_access($actorId, $actor, 1);
if ((int) $profile[0] !== -1 || (int) $deactivation[0] !== -1) phase1_behavior_fail('Account lifecycle service accepted a non-Admin actor.');
$db->rollback('Phase 1 service authorization verifier');

print "RST Phase 1 transactional audit behavior verified.\n";
