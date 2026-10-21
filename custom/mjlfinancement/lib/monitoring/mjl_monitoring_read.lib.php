<?php

require_once dirname(__DIR__).'/mjl_monitoring_access.lib.php';
require_once dirname(__DIR__).'/mjl_monitoring.lib.php';
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

function mjl_monitoring_read_agent_options($db, $entity, $page = 1)
{
	$res = $db->query('SELECT u.rowid,u.login,u.firstname,u.lastname FROM '.$db->prefix()."user u INNER JOIN ".$db->prefix()."mjlfinancement_user_role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code='AGENT_SAISIE' WHERE u.entity=".(int) $entity.' AND u.statut=1 AND u.admin=0 ORDER BY u.lastname,u.firstname,u.login,u.rowid LIMIT 51 OFFSET '.(((int)$page-1)*50));
	if (!$res) throw new RuntimeException('READ_FAILED');
	$rows = array();
	if ($res) while ($row = $db->fetch_object($res)) $rows[] = (array) $row;
	return $rows;
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

/** W5 read owner for dashboard and alerts only. */
function mjl_monitoring_read_page($db, $user, $entity, $surface, array $filters)
{
	if (!in_array($surface, array('home', 'alerts'), true)) throw new InvalidArgumentException('INVALID_MONITORING_SURFACE');
	return mjl_monitoring_read_snapshot($db, function () use ($db, $user, $entity, $surface, $filters) {
		$reader = new MjlMonitoring($db, $user, (int) $entity);
		$activities = $reader->activities($filters);
		try { $choices = $reader->referenceChoices(); }
		catch (Throwable $exception) { $choices = null; }

		$workActivities = null;
		$requests = null;
		if ($surface === 'home') {
			try {
				$workActivities = $reader->reviewFacts($activities);
				$requests = $reader->requests($workActivities, 'PENDING');
			} catch (Throwable $exception) {
				$workActivities = null;
				$requests = null;
			}
		}

		return array(
			'activities' => $activities,
			'choices' => $choices,
			'work_activities' => $workActivities,
			'requests' => $requests,
			'role' => $reader->role(),
			'date' => $reader->date(),
		);
	}, 'mjl monitoring', true);
}
