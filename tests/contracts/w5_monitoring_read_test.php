<?php

class CommonObject {}
class DoliDB {}
class MjlActivity { public function __construct($db) {} }
class MjlActivityAssignment {}
class MjlMonitoring
{
	const SOURCE_LIMIT = 5242880;
	public static $failWork = false;
	public function __construct($db, $user, $entity) {}
	public function activities($filters) { return array(array('rowid' => 41, 'name' => 'Activité visible')); }
	public function reviewFacts($activities) { if (self::$failWork) throw new RuntimeException('WORK_FAILED'); return $activities; }
	public function requests($activities, $status) { return array(array('rowid' => 8)); }
	public function role() { return 'AGENT_SAISIE'; }
	public function date() { return '2026-10-08'; }
	public function activityWhere($filters) { return 'a.entity=3'; }
	public function referenceChoices($includeTypes = false) { return array('partner_id' => array(array('id' => 2, 'label' => 'Partenaire')), 'project_id' => array(array('id' => 4, 'label' => 'Projet'))); }
	public function rows($sql) {
		if (strpos($sql, 'SELECT COUNT(*)') !== false) return array(array('n' => 1, 'bytes' => 64));
		if (strpos($sql, 'fk_partner') !== false) return array(array('id' => 2, 'label' => 'Partenaire'));
		if (strpos($sql, 'fk_project') !== false) return array(array('id' => 4, 'label' => 'Projet'));
		throw new RuntimeException('UNEXPECTED_QUERY');
	}
}

class W5MonitoringReadDb extends DoliDB
{
	public $transaction_opened = 0;
	public $queries = array();
	public function query($sql) { $this->queries[] = $sql; return strpos($sql, 'SELECT @@session') === 0 ? 'budget' : true; }
	public function fetch_array($result) { return $result === 'budget' ? array('statement_time' => '11.5', 'row_wait' => '13', 'metadata_wait' => '17') : false; }
	public function begin($label) { $this->transaction_opened++; return true; }
	public function commit($label) { $this->transaction_opened--; return true; }
	public function rollback() { $this->transaction_opened = 0; return true; }
	public function prefix() { return 'llx_'; }
}

function w5_monitoring_read_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

define('DOL_DOCUMENT_ROOT', dirname(__DIR__, 2));
require_once __DIR__.'/../../custom/mjlfinancement/lib/monitoring/mjl_monitoring_read.lib.php';

$db = new W5MonitoringReadDb();
$user = (object) array('id' => 17);
$filters = array('q' => '', 'page' => 1);
$home = mjl_monitoring_read_page($db, $user, 3, 'home', $filters);
w5_monitoring_read_assert($home['activities'][0]['rowid'] === 41, 'Home read must return the scoped Activity facts.');
w5_monitoring_read_assert($home['choices']['partner_id'][0]['id'] === 2, 'Home read must return scoped reference choices.');
w5_monitoring_read_assert($home['work_activities'][0]['rowid'] === 41 && $home['requests'][0]['rowid'] === 8, 'Home read must return its work facts in the same snapshot.');
w5_monitoring_read_assert($home['role'] === 'AGENT_SAISIE' && $home['date'] === '2026-10-08', 'Home read must return the scoped role and date.');
w5_monitoring_read_assert($db->transaction_opened === 0 && strpos(end($db->queries), 'max_statement_time=11.5') !== false, 'Home read must close the snapshot and restore all budgets.');

$alerts = mjl_monitoring_read_page(new W5MonitoringReadDb(), $user, 3, 'alerts', $filters);
w5_monitoring_read_assert($alerts['work_activities'] === null && $alerts['requests'] === null, 'Alerts read must not load the dashboard work queue.');

MjlMonitoring::$failWork = true;
$home = mjl_monitoring_read_page(new W5MonitoringReadDb(), $user, 3, 'home', $filters);
w5_monitoring_read_assert($home['activities'][0]['rowid'] === 41 && $home['work_activities'] === null && $home['requests'] === null, 'Work-fact failure must not hide otherwise available dashboard facts.');

$error = '';
try { mjl_monitoring_read_page(new W5MonitoringReadDb(), $user, 3, 'operations', $filters); }
catch (Throwable $exception) { $error = $exception->getMessage(); }
w5_monitoring_read_assert($error === 'INVALID_MONITORING_SURFACE', 'The W2 W5 read interface must reject excluded Operations/request surfaces.');

print "W5 monitoring read contract passed.\n";
