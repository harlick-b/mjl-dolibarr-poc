<?php

require __DIR__.'/../../custom/mjlfinancement/scripts/verification/runner.php';

function mjl_verification_runner_assert($condition, $message)
{
	if (!$condition) {
		fwrite(STDERR, 'FAIL: '.$message.PHP_EOL);
		exit(1);
	}
}

$schemaRoot = __DIR__.'/../../custom/mjlfinancement/scripts/verification/schema';
$allowed = array('core_schema.php');
$resolved = mjl_resolve_verification_module($schemaRoot, $allowed, 'core_schema.php');
mjl_verification_runner_assert(is_string($resolved) && basename($resolved) === 'core_schema.php', 'allowlisted module resolves');
mjl_verification_runner_assert(mjl_resolve_verification_module($schemaRoot, $allowed, '') === false, 'empty module is rejected');
mjl_verification_runner_assert(mjl_resolve_verification_module($schemaRoot, $allowed, '../runner.php') === false, 'path traversal is rejected');
mjl_verification_runner_assert(mjl_resolve_verification_module('/missing/root', $allowed, 'core_schema.php') === false, 'missing root is rejected');

print 'MJL verification runner: OK'.PHP_EOL;
