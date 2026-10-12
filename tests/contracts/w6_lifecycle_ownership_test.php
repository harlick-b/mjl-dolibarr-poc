<?php

function w6_lifecycle_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

$root = dirname(__DIR__, 2);
$descriptor = file_get_contents($root.'/custom/mjlfinancement/core/modules/modMjlFinancement.class.php');
$lifecycle = file_get_contents($root.'/custom/mjlfinancement/scripts/activity_schema_installer.lib.php');

w6_lifecycle_assert($descriptor !== false && $lifecycle !== false, 'W6 lifecycle sources must be readable.');
w6_lifecycle_assert(substr_count($descriptor, 'mjl_lifecycle_prepare(') === 1, 'Descriptor init must delegate exactly once to the lifecycle owner.');
w6_lifecycle_assert(substr_count($lifecycle, 'function mjl_lifecycle_prepare(') === 1, 'The retained lifecycle seam must have exactly one activation owner.');

$initStart = strpos($descriptor, 'public function init(');
$removeStart = strpos($descriptor, 'public function remove(', $initStart);
w6_lifecycle_assert($initStart !== false && $removeStart !== false, 'Descriptor lifecycle methods must remain explicit.');
$init = substr($descriptor, $initStart, $removeStart - $initStart);

w6_lifecycle_assert(strpos($init, 'mjl_lifecycle_prepare($this->db') !== false, 'Descriptor must supply its database to the lifecycle owner.');
$removePosition = strpos($init, '$this->remove($options)');
$nativeInitPosition = strpos($init, '$this->_init(array(), $options)');
w6_lifecycle_assert($removePosition !== false && $nativeInitPosition > $removePosition, 'Descriptor must retain native remove/init order in its finalization callback.');
w6_lifecycle_assert(strpos($init, 'return $preparation[\'result\'];') !== false, 'Descriptor must preserve the delegated native finalization result.');
foreach (array('GET_LOCK', 'RELEASE_LOCK', 'information_schema', 'mjl_rst002b_', 'mjl_rst006a_', 'mjl_rst006b_', 'mjl_rst012_', 'ensureLoginOtpSchema', 'ensureAuthStateConstraints', 'ensureAuthInvariantTriggers') as $embeddedOwner) {
	w6_lifecycle_assert(strpos($init, $embeddedOwner) === false, 'Descriptor retains lifecycle implementation: '.$embeddedOwner);
}

foreach (array('GET_LOCK', 'RELEASE_LOCK', 'mjl_rst002b_', 'mjl_rst006a_', 'mjl_rst006b_', 'mjl_rst012_', 'mjl_auth_otp_table_schema_ready') as $ownedOperation) {
	w6_lifecycle_assert(strpos($lifecycle, $ownedOperation) !== false, 'Lifecycle owner is missing retained operation: '.$ownedOperation);
}

$prepareStart = strpos($lifecycle, 'function mjl_lifecycle_prepare(');
$finalizePosition = strpos($lifecycle, '$finalize()', $prepareStart);
$catchPosition = strpos($lifecycle, '} catch (Throwable $exception)', $prepareStart);
$releasePosition = strpos($lifecycle, 'RELEASE_LOCK', $prepareStart);
w6_lifecycle_assert(strpos($lifecycle, 'callable $loadTables, callable $finalize', $prepareStart) !== false, 'Lifecycle owner must accept native finalization explicitly.');
w6_lifecycle_assert($finalizePosition !== false && $catchPosition > $finalizePosition && $releasePosition > $catchPosition, 'Native finalization must remain inside the lifecycle catch and lock-release boundary.');
w6_lifecycle_assert(strpos(substr($lifecycle, $catchPosition, $releasePosition - $catchPosition), "return array('result' => -1") !== false, 'Thrown native finalization must be converted to lifecycle refusal before lock release.');

foreach (array(
	'custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql',
	'custom/mjlfinancement/scripts/rst006a_schema.lib.php',
	'custom/mjlfinancement/scripts/rst006b_schema.lib.php',
	'custom/mjlfinancement/scripts/rst012_schema.lib.php',
	'custom/mjlfinancement/scripts/schema/rst012_report.sql',
) as $resource) {
	w6_lifecycle_assert(is_file($root.'/'.$resource), 'Retained lifecycle resource is missing: '.$resource);
}

print "W6 lifecycle ownership contract passed.\n";
