<?php

require_once dirname(__DIR__).'/mjl_monitoring_access.lib.php';
require_once dirname(__DIR__).'/mjl_monitoring.lib.php';
if (!class_exists('MjlActivity')) require_once dirname(__DIR__, 2).'/class/mjlactivity.class.php';
if (!class_exists('MjlActivityAssignment')) require_once dirname(__DIR__, 2).'/class/mjlactivityassignment.class.php';
if (!class_exists('MjlMonitoring')) require_once dirname(__DIR__, 2).'/class/mjlmonitoring.class.php';

/**
 * Run one bounded read snapshot and restore every changed session budget.
 *
 * @param DoliDB $db
 * @param callable $read
 * @param string $label
 * @param bool $fullBudgets
 * @return mixed
 * @throws Throwable
 */
function mjl_monitoring_read_snapshot($db, $read, $label, $fullBudgets = false)
{
	$columns = $fullBudgets
		? '@@session.max_statement_time AS statement_time,@@session.innodb_lock_wait_timeout AS row_wait,@@session.lock_wait_timeout AS metadata_wait'
		: '@@session.max_statement_time AS statement_time';
	$result = $db->query('SELECT '.$columns);
	$budget = $result ? $db->fetch_array($result) : false;
	if (!$budget) throw new RuntimeException('READ_FAILED');
	$set = 'SET SESSION max_statement_time=5';
	if ($fullBudgets) $set .= ',innodb_lock_wait_timeout=2,lock_wait_timeout=2';
	$opened = false;
	$failure = null;
	$value = null;
	try {
		if (!$db->query($set)) throw new RuntimeException('READ_FAILED');
		if (!$db->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')) throw new RuntimeException('READ_FAILED');
		if (!$db->begin($label)) throw new RuntimeException('READ_FAILED');
		$opened = true;
		$value = $read();
		if (!$db->commit($label)) throw new RuntimeException('READ_FAILED');
		$opened = false;
	} catch (Throwable $exception) {
		$failure = $exception;
		if ($opened || (int) ($db->transaction_opened ?? 0) > 0) {
			if (!$db->rollback()) $failure = new RuntimeException('READ_ROLLBACK_FAILED', 0, $exception);
			$opened = false;
		}
	} finally {
		$restore = 'SET SESSION max_statement_time='.(float) $budget['statement_time'];
		if ($fullBudgets) $restore .= ',innodb_lock_wait_timeout='.(int) $budget['row_wait'].',lock_wait_timeout='.(int) $budget['metadata_wait'];
		if (!$db->query($restore)) $failure = new RuntimeException('READ_RESTORE_FAILED', 0, $failure);
	}
	if ($failure) throw $failure;
	return $value;
}

function mjl_monitoring_read_activity($db, $entity, $id)
{
	$res = $db->query('SELECT a.*,s.nom AS partner_name,p.ref AS project_ref,p.title AS project_title FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'societe s ON s.rowid=a.fk_partner AND s.entity=a.entity INNER JOIN '.$db->prefix().'projet p ON p.rowid=a.fk_project AND p.entity=a.entity WHERE a.entity='.(int) $entity.' AND a.rowid='.(int) $id.' LIMIT 1');
	if (!$res) throw new RuntimeException('READ_FAILED');
	$row = $res ? $db->fetch_object($res) : null;
	return $row ? (array) $row : array();
}

function mjl_monitoring_read_operations($db, $entity, $activityId, $includeRemoved = false)
{
	$res = $db->query('SELECT o.*,t.label AS type_label FROM '.$db->prefix().'mjlfinancement_operation o INNER JOIN '.$db->prefix().'mjlfinancement_operation_type t ON t.rowid=o.fk_operation_type AND t.entity=o.entity WHERE o.entity='.(int) $entity.' AND o.fk_activity='.(int) $activityId.($includeRemoved ? '' : ' AND o.date_removed IS NULL').' ORDER BY o.rowid');
	if (!$res) throw new RuntimeException('READ_FAILED');
	$rows = array();
	if ($res) while ($row = $db->fetch_object($res)) $rows[] = (array) $row;
	return $rows;
}

function mjl_monitoring_read_revision($db, $entity, $activityId, $revisionId)
{
	$res = $db->query('SELECT * FROM '.$db->prefix().'mjlfinancement_activity_revision WHERE entity='.(int) $entity.' AND fk_activity='.(int) $activityId.' AND rowid='.(int) $revisionId.' LIMIT 1');
	if (!$res) throw new RuntimeException('READ_FAILED');
	$row = $res ? $db->fetch_object($res) : null;
	return $row ? (array) $row : array();
}

function mjl_monitoring_read_review_history($db, $entity, $revisionId)
{
	$res = $db->query('SELECT stage,decision_type,actor_name_snapshot,reason,requested_amount,date_decision FROM '.$db->prefix().'mjlfinancement_review_decision WHERE entity='.(int) $entity.' AND fk_revision='.(int) $revisionId.' ORDER BY date_decision,rowid');
	if (!$res) throw new RuntimeException('READ_FAILED');
	$rows = array();
	if ($res) while ($row = $db->fetch_object($res)) $rows[] = (array) $row;
	return $rows;
}

function mjl_monitoring_read_reference_options($db, $entity, $table, $label, $selected)
{
	$active = $table === 'societe' ? 'status=1' : 'fk_statut=1';
	$project = $table === 'projet';
	$res = $db->query('SELECT rowid,'.$label.' AS label'.($project ? ',fk_soc AS partner_id' : '').' FROM '.$db->prefix().$table.' WHERE entity='.(int) $entity.' AND ('.$active.((int) $selected > 0 ? ' OR rowid='.(int) $selected : '').') ORDER BY '.$label.',rowid');
	if (!$res) throw new RuntimeException('READ_FAILED');
	$rows = array();
	if ($res) while ($row = $db->fetch_object($res)) $rows[] = (array) $row;
	return $rows;
}

function mjl_monitoring_read_type_options($db, $entity, $selected)
{
	$res = $db->query('SELECT rowid,label FROM '.$db->prefix().'mjlfinancement_operation_type WHERE entity='.(int) $entity.' AND (is_active=1'.((int) $selected > 0 ? ' OR rowid='.(int) $selected : '').') ORDER BY label,rowid');
	if (!$res) throw new RuntimeException('READ_FAILED');
	$rows = array();
	if ($res) while ($row = $db->fetch_object($res)) $rows[] = (array) $row;
	return $rows;
}

function mjl_monitoring_read_agent_options($db, $entity)
{
	$res = $db->query('SELECT u.rowid,u.login,u.firstname,u.lastname FROM '.$db->prefix()."user u INNER JOIN ".$db->prefix()."mjlfinancement_user_role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code='AGENT_SAISIE' WHERE u.entity=".(int) $entity.' AND u.statut=1 AND u.admin=0 ORDER BY u.lastname,u.firstname,u.login,u.rowid');
	if (!$res) throw new RuntimeException('READ_FAILED');
	$rows = array();
	if ($res) while ($row = $db->fetch_object($res)) $rows[] = (array) $row;
	return $rows;
}

function mjl_monitoring_read_fallback_review_facts($db, $entity, $revisionId, $actorId)
{
	$contributor = (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_revision_contributor WHERE entity='.(int) $entity.' AND fk_revision='.(int) $revisionId.' AND fk_user='.(int) $actorId);
	$prevalidator = (int) mjl_rst005_scalar($db, "SELECT COALESCE(MAX(fk_actor),0) FROM ".$db->prefix()."mjlfinancement_review_decision WHERE entity=".(int) $entity." AND fk_revision=".(int) $revisionId." AND decision_type='PREVALIDATED'");
	return array('is_contributor' => $contributor !== 0, 'prevalidator_id' => $prevalidator);
}

function mjl_monitoring_read_report_available($db)
{
	return mjl_rst002b_table_exists($db, $db->prefix().'mjlfinancement_export_record');
}

function mjl_monitoring_read_reference_choices($db,$reader)
{
	$where=$reader->activityWhere(mjl_monitoring_filters(array()));$from=' FROM '.$db->prefix().'mjlfinancement_activity a';$choices=array();
	foreach(array('partner_id'=>array('fk_partner','societe','s','nom'),'project_id'=>array('fk_project','projet','p','title'))as$key=>$ref){list($fk,$table,$alias,$label)=$ref;$selection='SELECT DISTINCT a.'.$fk.' AS id,'.$alias.'.'.$label.' AS label'.$from.' JOIN '.$db->prefix().$table.' '.$alias.' ON '.$alias.'.entity=a.entity AND '.$alias.'.rowid=a.'.$fk.' WHERE '.$where;$stats=$reader->rows('SELECT COUNT(*) AS n,COALESCE(SUM(OCTET_LENGTH(label)+64),0) AS bytes FROM ('.$selection.') selected')[0];if((int)$stats['n']>10000||(int)$stats['bytes']>MjlMonitoring::SOURCE_LIMIT)throw new RuntimeException('SOURCE_LIMIT');$choices[$key]=$reader->rows($selection.' ORDER BY label');}
	return $choices;
}

function mjl_monitoring_read_activity_context($db, $user, $entity, array $row)
{
	$id = (int) $row['rowid'];
	return mjl_monitoring_read_snapshot($db, function () use ($db, $user, $entity, $id) {
		$reader = new MjlMonitoring($db, $user, (int) $entity);
		$activities = $reader->activities(mjl_monitoring_filters(array('activity_id' => (string) $id)));
		if (count($activities) !== 1) throw new RuntimeException('FORBIDDEN');
		$activities = $reader->reviewFacts($activities);
		$context = $activities[0];
		$context['monitoring_actions'] = mjl_monitoring_activity_actions($context, $reader->role(), $user->id, $reader->date());
		return $context;
	}, 'mjl detail monitoring');
}

function mjl_monitoring_read_activity_list($db, $user, $entity, array $filters, $readiness)
{
	if ((int) $readiness === 0) {
		$offset = ((int) $filters['page'] - 1) * 50;
		$model = new MjlActivity($db);
		$rows = $model->fetchReadProjection($user, $filters, 51, $offset);
		if ($rows === false) throw new RuntimeException('INVALID_FILTER');
		return array('mode' => 'fallback', 'rows' => $rows, 'role' => mjl_scope_effective_role_code($user), 'date' => (new DateTimeImmutable('now', new DateTimeZone('Africa/Porto-Novo')))->format('Y-m-d'));
	}
	if ((int) $readiness !== 1) throw new RuntimeException('READ_FAILED');
	return mjl_monitoring_read_snapshot($db, function () use ($db, $user, $entity, $filters) {
		$reader = new MjlMonitoring($db, $user, (int) $entity);
		$rows = $reader->activities($filters);
		try { $choices = mjl_monitoring_read_reference_choices($db,$reader); } catch (Throwable $exception) { $choices = null; }
		return array('mode' => 'target', 'rows' => $rows, 'choices' => $choices, 'role' => $reader->role(), 'date' => $reader->date());
	}, 'mjl monitoring', true);
}
