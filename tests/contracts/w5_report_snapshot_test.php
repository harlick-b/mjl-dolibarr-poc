<?php

class W5ReportSnapshotDb
{
	public $transaction_opened = 0;
	public $queries = array();
	public $failure = '';
	public $rollbackResult = true;

	public function query($sql)
	{
		$this->queries[] = $sql;
		if (strpos($sql, 'SELECT @@session') === 0) return $this->failure === 'budget' ? false : 'budget';
		if (strpos($sql, 'SET SESSION max_statement_time=5') === 0) return $this->failure !== 'set';
		if (strpos($sql, 'SET TRANSACTION') === 0) return $this->failure !== 'isolation';
		if (strpos($sql, 'SET SESSION max_statement_time=11.5') === 0) return $this->failure !== 'restore';
		return true;
	}

	public function fetch_array($result)
	{
		return $result === 'budget'
			? array('statement_time' => '11.5', 'row_wait' => '13', 'metadata_wait' => '17')
			: false;
	}

	public function begin($label)
	{
		if ($this->failure === 'begin') return false;
		$this->transaction_opened++;
		return true;
	}

	public function commit($label)
	{
		if ($this->failure === 'commit') return false;
		$this->transaction_opened--;
		return true;
	}

	public function rollback()
	{
		$this->transaction_opened = 0;
		return $this->rollbackResult;
	}
}

function w5_report_snapshot_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

require_once __DIR__.'/../../custom/mjlfinancement/lib/reporting/mjl_reporting_read.lib.php';

class W5MissingDetailReader
{
	public $operationsCalled = false;
	public function operations(array $activities, array $filters)
	{
		$this->operationsCalled = true;
		throw new RuntimeException('UNEXPECTED_CHILD_READ');
	}
}

$missingReader = new W5MissingDetailReader();
$missingError = '';
try { mjl_reporting_read_activity_detail($missingReader, array(), array('activity_id' => '2147483647')); }
catch (Throwable $exception) { $missingError = $exception->getMessage(); }
w5_report_snapshot_assert($missingError === 'FORBIDDEN', 'An absent scoped Activity detail must retain the authorization-safe forbidden result.');
w5_report_snapshot_assert(!$missingReader->operationsCalled, 'An absent scoped Activity must be rejected before any child-operation read.');

function w5_report_snapshot_run($failure = '', $readFailure = '', $rollbackResult = true, $preflightFailure = '')
{
	$db = new W5ReportSnapshotDb();
	$db->failure = $failure;
	$db->rollbackResult = $rollbackResult;
	$value = null;
	$error = '';
	try {
		$value = mjl_reporting_read_snapshot($db, function () use ($readFailure) {
			if ($readFailure !== '') throw new RuntimeException($readFailure);
			return array('rows' => array(41), 'complete' => true);
		}, 'mjl report preview', function () use ($preflightFailure) {
			if ($preflightFailure !== '') throw new RuntimeException($preflightFailure);
		});
	} catch (Throwable $exception) {
		$error = $exception->getMessage();
	}
	return array($db, $value, $error);
}

list($db, $value, $error) = w5_report_snapshot_run();
w5_report_snapshot_assert($error === '' && $value === array('rows' => array(41), 'complete' => true), 'A complete preview snapshot must return only its complete value.');
w5_report_snapshot_assert($db->transaction_opened === 0, 'A successful preview snapshot must close its transaction.');
w5_report_snapshot_assert(end($db->queries) === 'SET SESSION max_statement_time=11.5,innodb_lock_wait_timeout=13,lock_wait_timeout=17', 'Every changed session budget must be restored exactly.');

foreach (array('budget', 'set', 'isolation', 'begin', 'commit', 'restore') as $failure) {
	list($db, $value, $error) = w5_report_snapshot_run($failure);
	$expected = $failure === 'restore' ? 'READ_RESTORE_FAILED' : 'READ_FAILED';
	w5_report_snapshot_assert($error === $expected && $value === null, ucfirst($failure).' failure must expose no partial preview value.');
	w5_report_snapshot_assert($db->transaction_opened === 0, ucfirst($failure).' failure must leave no open transaction.');
}

list($db, $value, $error) = w5_report_snapshot_run('', 'SOURCE_LIMIT');
w5_report_snapshot_assert($error === 'SOURCE_LIMIT' && $value === null, 'Read failure must retain its generic report failure origin.');
w5_report_snapshot_assert($db->transaction_opened === 0, 'Read failure must roll back the open snapshot.');
w5_report_snapshot_assert(strpos(end($db->queries), 'max_statement_time=11.5') !== false, 'Read failure must restore all session budgets.');

list($db, $value, $error) = w5_report_snapshot_run('', 'READ_FAILED', false);
w5_report_snapshot_assert($error === 'READ_FAILED' && $value === null, 'DEC-066 must preserve the generic unavailable outcome when rollback reports failure.');
w5_report_snapshot_assert($db->transaction_opened === 0, 'The rollback attempt must end the fake snapshot even when its result is false.');
w5_report_snapshot_assert(strpos(end($db->queries), 'max_statement_time=11.5') !== false, 'DEC-066 must still attempt exact budget restoration after rollback failure.');

list($db, $value, $error) = w5_report_snapshot_run('', 'FORBIDDEN', false);
w5_report_snapshot_assert($error === 'READ_FAILED' && $value === null, 'DEC-066 must replace a specific read error with generic unavailable when rollback reports failure.');
w5_report_snapshot_assert(strpos(end($db->queries), 'max_statement_time=11.5') !== false, 'DEC-066 must restore every session budget after a specific read error and rollback failure.');

list($db, $value, $error) = w5_report_snapshot_run('', '', true, 'SCHEMA_UNAVAILABLE');
w5_report_snapshot_assert($error === 'SCHEMA_UNAVAILABLE' && $value === null, 'Schema preflight failure must be retained without exposing a preview value.');
w5_report_snapshot_assert($db->transaction_opened === 0, 'Schema preflight must fail before the snapshot transaction begins.');
w5_report_snapshot_assert(strpos(implode("\n", $db->queries), 'SET TRANSACTION') === false, 'Schema preflight must precede isolation and begin.');
w5_report_snapshot_assert(strpos(end($db->queries), 'max_statement_time=11.5') !== false, 'Schema preflight failure must restore all session budgets.');

print "W5 report snapshot contract passed.\n";
