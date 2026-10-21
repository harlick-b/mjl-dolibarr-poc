<?php

require_once dirname(__DIR__, 2).'/class/mjlmonitoring.class.php';
require_once dirname(__DIR__).'/mjl_monitoring.lib.php';
require_once dirname(__DIR__).'/mjl_report_data.lib.php';
require_once dirname(__DIR__).'/mjl_report_render.lib.php';
require_once dirname(__DIR__, 2).'/scripts/rst012_schema.lib.php';

/**
 * Execute one bounded report preview snapshot and restore all changed budgets.
 *
 * DEC-066 preserves the generic preview failure when rollback reports false.
 * Mutation and durable export transactions do not use this read-only seam.
 *
 * @param DoliDB $db
 * @param callable $read
 * @param string $label
 * @param callable|null $beforeBegin
 * @return mixed
 * @throws Throwable
 */
function mjl_reporting_read_snapshot($db, $read, $label, $beforeBegin = null)
{
	$result = $db->query('SELECT @@session.max_statement_time AS statement_time,@@session.innodb_lock_wait_timeout AS row_wait,@@session.lock_wait_timeout AS metadata_wait');
	$budget = $result ? $db->fetch_array($result) : false;
	if (!$budget) throw new RuntimeException('READ_FAILED');

	$opened = false;
	$failure = null;
	$value = null;
	try {
		if (!$db->query('SET SESSION max_statement_time=5,innodb_lock_wait_timeout=2,lock_wait_timeout=2')) throw new RuntimeException('READ_FAILED');
		if ($beforeBegin !== null) $beforeBegin();
		if (!$db->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')) throw new RuntimeException('READ_FAILED');
		if (!$db->begin($label)) throw new RuntimeException('READ_FAILED');
		$opened = true;
		$value = $read();
		if (!$db->commit($label)) throw new RuntimeException('READ_FAILED');
		$opened = false;
	} catch (Throwable $exception) {
		$failure = $exception;
		if ($opened || (int) ($db->transaction_opened ?? 0) > 0) {
			if (!$db->rollback()) $failure = new RuntimeException('READ_FAILED', 0, $exception);
			$opened = false;
		}
	} finally {
		$restore = 'SET SESSION max_statement_time='.(float) $budget['statement_time'].',innodb_lock_wait_timeout='.(int) $budget['row_wait'].',lock_wait_timeout='.(int) $budget['metadata_wait'];
		if (!$db->query($restore)) $failure = new RuntimeException('READ_RESTORE_FAILED', 0, $failure);
	}

	if ($failure) throw $failure;
	return $value;
}

function mjl_reporting_read_preview($db, $user, $entity, $type, array $filters)
{
	$deadline = hrtime(true) + 30000000000;
	return mjl_reporting_read_snapshot($db, function () use ($db, $user, $entity, $type, $filters, $deadline) {
		$reader = new MjlMonitoring($db, $user, (int) $entity);
		$activities = $reader->activities($filters);
		$result = array('rows' => array(), 'detail' => null, 'document' => null);
		if ($type === 'activity_detail') {
			$result['detail'] = mjl_reporting_read_activity_detail($reader, $activities, $filters);
			$result['document'] = $result['detail']['document'];
		} elseif ($type === 'operations') {
			$selected = $reader->operations($activities, $filters);
			if (count($selected) > 10000) throw new RuntimeException('SOURCE_LIMIT');
			$result['rows'] = mjl_report_operation_records($selected);
			$result['document'] = mjl_report_operations_document($selected)['document'];
		} elseif ($type === 'portfolio') {
			$result['rows'] = mjl_report_portfolio($activities, $filters['grouping']);
			$result['document'] = mjl_report_portfolio_document($activities, $filters['grouping'])['document'];
		} else {
			$result['rows'] = mjl_report_activity_records($activities);
			$result['document'] = mjl_report_activities_document($activities)['document'];
		}
		mjl_report_checkpoint($deadline);
		return $result;
	}, 'mjl report preview', function () use ($db, $deadline) {
		mjl_rst012_require_target($db);
		mjl_report_checkpoint($deadline);
	});
}

function mjl_reporting_read_activity_detail($reader, array $activities, array $filters)
{
	if (count($activities) !== 1) throw new RuntimeException('FORBIDDEN');
	return mjl_report_activity_detail_document($activities, $reader->operations($activities, $filters));
}

function mjl_reporting_read_audit($db, $user, $entity, array $filters)
{
	$deadline = hrtime(true) + 30000000000;
	return mjl_reporting_read_snapshot($db, function () use ($db, $user, $entity, $filters, $deadline) {
		$reader = new MjlMonitoring($db, $user, (int) $entity);
		$events = $reader->audit($filters);
		mjl_report_checkpoint($deadline);
		return $events;
	}, 'mjl audit preview', function () use ($db) {
		mjl_rst012_require_target($db);
	});
}
