<?php

require_once __DIR__.'/cli_guard.php';

require_once __DIR__.'/verification/runner.php';

$modules = array(
	'access_model.php',
	'traceability_targets.php',
	'unresolved_scope.php',
);

$requestedModule = isset($argv[1]) ? $argv[1] : '';
$modulePath = mjl_resolve_verification_module(__DIR__.'/verification/scope', $modules, $requestedModule);
if ($modulePath === false) {
	exit(2);
}
require $modulePath;
