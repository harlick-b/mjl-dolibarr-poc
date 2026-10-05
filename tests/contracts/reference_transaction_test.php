<?php

$root = sys_get_temp_dir().'/mjl-reference-contract-'.getmypid();
$files = array(
	'/societe/class/societe.class.php' => '<?php class Societe {}',
	'/projet/class/project.class.php' => '<?php class Project { const STATUS_VALIDATED = 1; }',
	'/custom/mjlfinancement/class/mjloperationtype.class.php' => '<?php class MjlOperationType { public function __construct($db) {} public function create($entity,$label,$user){return 41;} public function updateLabel($id,$entity,$label,$user){return 1;} public function setActive($id,$entity,$active,$user){return 1;} }',
	'/custom/mjlfinancement/lib/mjl_scope.lib.php' => '<?php function mjl_scope_is_final_validator($user){return true;} function mjl_scope_user_has_active_business_role($user){return true;}',
	'/custom/mjlfinancement/lib/mjl_form.lib.php' => '<?php',
	'/custom/mjlfinancement/lib/mjl_form_submission.lib.php' => '<?php',
	'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php' => '<?php function mjl_workflow_audit_insert(){return 1;}',
);
foreach ($files as $name => $contents) {
	$path = $root.$name;
	@mkdir(dirname($path), 0777, true);
	file_put_contents($path, $contents);
}
define('DOL_DOCUMENT_ROOT', $root);
class User { public $id = 7; }
function accessforbidden($message = '') { throw new RuntimeException('forbidden'); }

class ReferenceFakeDb
{
	public $beginResult = true;
	public $commitResult = true;
	public $rollbackResult = true;
	public $rollbackCount = 0;
	public $closed = false;
	public function prefix() { return 'llx_'; }
	public function begin($label = '') { return $this->beginResult ? 1 : 0; }
	public function commit($label = '') { return $this->commitResult ? 1 : 0; }
	public function rollback($label = '') { $this->rollbackCount++; return $this->rollbackResult ? 1 : 0; }
	public function close() { $this->closed = true; }
	public function escape($value) { return addslashes($value); }
	public function query($sql) {
		if (strpos($sql, 'mjlfinancement_user_role') !== false) return (object) array('kind' => 'manager');
		if (strpos($sql, 'mjlfinancement_operation_type') !== false) return (object) array('kind' => 'reference');
		return true;
	}
	public function fetch_object($result) {
		if ($result->kind === 'manager') return (object) array('rowid' => 1);
		return (object) array('rowid' => 5, 'entity' => 1, 'label' => 'Stable', 'is_active' => 1, 'tms' => '2026-01-01 00:00:00');
	}
}

require dirname(__DIR__, 2).'/custom/mjlfinancement/lib/mjl_reference.lib.php';
$conf = (object) array('entity' => 1);
$user = new User();
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }

try {
	$db = new ReferenceFakeDb();
	$db->beginResult = false;
	check(mjl_reference_create('operation_type', 'Type')[0] < 0, 'create must fail when begin fails');
	check(mjl_reference_update_label('operation_type', 5, 'Stable', str_repeat('a', 64)) !== '', 'update must fail when begin fails');
	check(mjl_reference_set_active('operation_type', 5, true, str_repeat('a', 64)) !== '', 'lifecycle must fail when begin fails');

	$db = new ReferenceFakeDb();
	$db->commitResult = false;
	check(mjl_reference_create('operation_type', 'Type')[0] < 0, 'create must fail when commit fails');
	$row = array('rowid' => 5, 'entity' => 1, 'label' => 'Stable', 'is_active' => 1, 'tms' => '2026-01-01 00:00:00');
	$fingerprint = mjl_reference_fingerprint('operation_type', $row);
	check(mjl_reference_update_label('operation_type', 5, 'Stable', $fingerprint) !== '', 'no-op update must fail when commit fails');
	check(mjl_reference_set_active('operation_type', 5, true, $fingerprint) !== '', 'no-op lifecycle must fail when commit fails');
	check(mjl_reference_update_label('operation_type', 5, 'Changed', $fingerprint) !== '', 'mutating update must fail when commit fails');
	check(mjl_reference_set_active('operation_type', 5, false, $fingerprint) !== '', 'mutating lifecycle must fail when commit fails');
	check($db->rollbackCount === 5, 'each uncertain commit must request rollback');

	$db = new ReferenceFakeDb();
	$db->commitResult = false;
	$db->rollbackResult = false;
	check(mjl_reference_create('operation_type', 'Type')[0] < 0, 'rollback uncertainty must fail');
	check($db->closed, 'a connection with an uncertain rollback must be closed');
	print "reference transaction contract passed\n";
} finally {
	foreach (array_reverse(array_keys($files)) as $name) @unlink($root.$name);
	@rmdir($root.'/societe/class'); @rmdir($root.'/societe');
	@rmdir($root.'/projet/class'); @rmdir($root.'/projet');
	@rmdir($root.'/custom/mjlfinancement/class'); @rmdir($root.'/custom/mjlfinancement/lib');
	@rmdir($root.'/custom/mjlfinancement'); @rmdir($root.'/custom'); @rmdir($root);
}
