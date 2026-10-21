<?php

$root = dirname(__DIR__, 2);
function source($root, $path) { return file_get_contents($root.'/'.$path); }
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }

$reference = source($root, 'custom/mjlfinancement/lib/mjl_reference.lib.php');
$referenceRoute = source($root, 'custom/mjlfinancement/lib/api/mjl_api_references.lib.php');
$referenceCommand = source($root, 'custom/mjlfinancement/class/mjlreferencecommand.class.php');
$scope = source($root, 'custom/mjlfinancement/lib/mjl_scope.lib.php');
$accessRoute = source($root, 'custom/mjlfinancement/admin/access.php');
$accessCommand = source($root, 'custom/mjlfinancement/class/mjlaccesscommand.class.php');
$auth = source($root, 'custom/mjlfinancement/lib/mjl_auth.lib.php');
$authCommand = source($root, 'custom/mjlfinancement/class/mjlauthcommand.class.php');
$productionSources = '';
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/custom/mjlfinancement'));
foreach ($iterator as $file) {
	if ($file->isFile() && $file->getExtension() === 'php') $productionSources .= "\n".file_get_contents($file->getPathname());
}

foreach (array('mjl_reference_create', 'mjl_reference_update_label', 'mjl_reference_set_active') as $legacy) {
	check(strpos($productionSources, $legacy) === false, $legacy.' remains reachable or named in production');
}
foreach (array('mjl_scope_assign_access_profile', 'mjl_scope_deactivate_access', 'mjl_scope_assign_active_role') as $legacy) {
	check(strpos($productionSources, $legacy) === false, $legacy.' remains reachable or named in production');
}

check(preg_match_all('/class\s+MjlReferenceCommand\s*\{/', $referenceCommand) === 1, 'reference command owner missing');
check(substr_count($referenceRoute, 'new MjlReferenceCommand(') === 1, 'reference route must construct one command');
foreach (array('->create(', '->updateLabel(', '->setActive(') as $call) check(strpos($referenceRoute, $call) !== false, 'reference route call missing: '.$call);

check(strpos($reference, "require_once __DIR__.'/../class/mjlreferencecommand.class.php'") !== false, 'reference production include chain must load the command');

check(preg_match_all('/class\s+MjlAccessCommand\s*\{/', $accessCommand) === 1, 'access command owner missing');
check(substr_count($accessRoute, 'new MjlAccessCommand(') === 2, 'Admin access route must reach the command for both actions');
check(strpos($accessRoute, '->assignProfile(') !== false && strpos($accessRoute, '->deactivate(') !== false, 'Admin access command calls missing');
check(substr_count($authCommand, 'new MjlAccessCommand(') === 1, 'invitation must construct one access command');
check(substr_count($authCommand, '->assignProfileInTransaction(') === 1, 'invitation must reach the transaction participant once');
check(strpos($accessCommand, 'mjl_auth_record_event') === false, 'access command must not depend on the auth writer');
check(strpos($auth, "require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlaccesscommand.class.php'") !== false, 'auth production include chain must load the access command');
check(strpos($auth, "require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlauthcommand.class.php'") !== false, 'auth production include chain must load the W4 command');
check(strpos($accessRoute, "require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php'") !== false, 'Admin production include chain must load auth and the access command');

foreach (array($referenceRoute, $referenceCommand, $accessRoute, $accessCommand, $auth, $authCommand) as $reachableSource) {
	check(strpos($reachableSource, 'call_user_func') === false, 'W3 production path contains dynamic function dispatch');
}

$participantStart = strpos($accessCommand, 'public function assignProfileInTransaction');
$participantEnd = strpos($accessCommand, "\n\tpublic function ", $participantStart + 1);
$participant = substr($accessCommand, $participantStart, $participantEnd - $participantStart);
check(!preg_match('/->(?:begin|commit|rollback)\s*\(/', $participant), 'invitation participant controls the caller transaction');

foreach (array(
	'custom/mjlfinancement/lib/activity/mjl_activity_http.lib.php',
	'custom/mjlfinancement/lib/monitoring/mjl_monitoring_read.lib.php',
	'custom/mjlfinancement/lib/audit/mjl_audit_timeline_read.lib.php',
) as $w2File) check(is_file($root.'/'.$w2File), 'W2 owner missing: '.$w2File);
foreach (array(
	'custom/mjlfinancement/lib/mjl_activity_route.lib.php',
	'custom/mjlfinancement/lib/mjl_timeline.lib.php',
) as $legacyW2File) check(!file_exists($root.'/'.$legacyW2File), 'removed W2 owner was recreated: '.$legacyW2File);

print "W3 write ownership contract passed\n";
