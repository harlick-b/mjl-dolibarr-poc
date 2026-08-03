<?php

require_once __DIR__.'/verification/runner.php';

$modules = array(
	'core_schema.php',
	'audit_schema.php',
	'role_scope_schema.php',
	'activity_status_integrity.php',
	'activity_execution_schema.php',
	'expense_workflow_schema.php',
	'relationship_integrity.php',
);

$requestedModule = isset($argv[1]) ? $argv[1] : '';
$modulePath = mjl_resolve_verification_module(__DIR__.'/verification/schema', $modules, $requestedModule);
if ($modulePath === false) {
	exit(2);
}
require $modulePath;
