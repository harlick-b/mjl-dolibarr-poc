<?php

function w6_loading_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

$root = dirname(__DIR__, 2);
$descriptorPath = 'custom/mjlfinancement/core/modules/modMjlFinancement.class.php';
$lifecyclePath = 'custom/mjlfinancement/scripts/activity_schema_installer.lib.php';
$descriptor = file_get_contents($root.'/'.$descriptorPath);
$lifecycle = file_get_contents($root.'/'.$lifecyclePath);

w6_loading_assert($descriptor !== false && $lifecycle !== false, 'Lifecycle loading sources must be readable.');

$orderedIncludes = array(
	"scripts/activity_schema_installer.lib.php",
	"scripts/rst006a_schema.lib.php",
	"scripts/rst006b_schema.lib.php",
	"scripts/rst012_schema.lib.php",
	"lib/mjl_auth.lib.php",
);
$lastPosition = -1;
foreach ($orderedIncludes as $include) {
	$position = strpos($descriptor, $include);
	w6_loading_assert($position !== false && $position > $lastPosition, 'Descriptor include order changed or is incomplete: '.$include);
	$lastPosition = $position;
}

w6_loading_assert(strpos($descriptor, "mjl_lifecycle_prepare(\$this->db, function (\$path)") !== false, 'Descriptor must pass the native SQL loader through the lifecycle seam.');
w6_loading_assert(strpos($descriptor, "}, function () use (\$options)") !== false, 'Descriptor must pass native finalization through the lifecycle seam.');
w6_loading_assert(strpos($lifecycle, "\$loadTables('/mjlfinancement/sql/')") !== false, 'Base SQL resource path must remain owned by the native loader callback.');

$rst012 = file_get_contents($root.'/custom/mjlfinancement/scripts/rst012_schema.lib.php');
w6_loading_assert($rst012 !== false && strpos($rst012, "__DIR__.'/schema/rst012_report.sql'") !== false, 'RST-012 must retain its current SQL-resource owner and path.');

$productionCalls = 0;
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/custom/mjlfinancement'));
foreach ($iterator as $file) {
	if (!$file->isFile() || $file->getExtension() !== 'php') continue;
	$source = file_get_contents($file->getPathname());
	if ($source === false) continue;
	$productionCalls += substr_count($source, 'mjl_lifecycle_prepare(');
}
w6_loading_assert($productionCalls === 2, 'Lifecycle prepare must have exactly one definition and one production caller.');

foreach (array(
	'custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql',
	'custom/mjlfinancement/scripts/schema/rst012_report.sql',
) as $resource) {
	w6_loading_assert(is_file($root.'/'.$resource), 'Lifecycle SQL resource is missing: '.$resource);
}

print "W6 lifecycle loading contract passed.\n";
