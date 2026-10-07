<?php

function mjl_activity_ownership_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

$root = file_get_contents(__DIR__.'/../../custom/mjlfinancement/activities.php');
$http = file_get_contents(__DIR__.'/../../custom/mjlfinancement/lib/activity/mjl_activity_http.lib.php');
$read = file_get_contents(__DIR__.'/../../custom/mjlfinancement/lib/monitoring/mjl_monitoring_read.lib.php');
$form = file_get_contents(__DIR__.'/../../custom/mjlfinancement/lib/mjl_activity_form.lib.php');
$presentation = file_get_contents(__DIR__.'/../../custom/mjlfinancement/lib/activity/mjl_activity_presentation.lib.php');
$monitoringRoute = file_get_contents(__DIR__.'/../../custom/mjlfinancement/lib/mjl_monitoring_route.lib.php');

mjl_activity_ownership_assert(substr_count($root, 'mjl_activity_http_handle(') === 1, 'The Activity root must hand off exactly once.');
mjl_activity_ownership_assert(strpos($root, 'mjl_activity_route') === false, 'The Activity root must not retain the legacy route owner.');
mjl_activity_ownership_assert(strpos($http, 'function mjl_activity_http_handle($db, $user, $entity, array $request)') !== false, 'The handler must receive explicit adapter context.');
mjl_activity_ownership_assert(strpos($http, 'if ($action===\'\' && $id===\'\' && mjl_activity_list_query($get)===null) mjl_activity_filter_bad_request();') !== false, 'The Activity list must reject invalid legacy filters with its stable response in every readiness state.');
mjl_activity_ownership_assert(strpos($http, '$GLOBALS') === false && strpos($presentation, '$GLOBALS') === false, 'Handler/presentation handoff must not use hidden application globals.');
mjl_activity_ownership_assert(strpos($presentation, 'mjl_monitoring_route.lib.php') === false, 'Activity presentation must not depend backward on a route owner.');
mjl_activity_ownership_assert(strpos($form, 'function mjl_activity_prepare_form_effects') !== false, 'The form-effect adapter must return explicit prepared effects.');
mjl_activity_ownership_assert(strpos($http, '->query(') === false, 'The Activity HTTP handler must not own SQL.');
mjl_activity_ownership_assert(strpos($read, 'function mjl_monitoring_read_snapshot') !== false, 'The monitoring read module must own the bounded snapshot.');
mjl_activity_ownership_assert(strpos($monitoringRoute, "mjl_monitoring_page('activities')") === false, 'The legacy monitoring Activity page branch must not remain authoritative.');
mjl_activity_ownership_assert(!file_exists(__DIR__.'/../../custom/mjlfinancement/lib/mjl_activity_route.lib.php'), 'The superseded mixed Activity route must be removed.');
mjl_activity_ownership_assert(!file_exists(__DIR__.'/../../custom/mjlfinancement/lib/mjl_timeline.lib.php'), 'The superseded mixed Activity timeline owner must be removed.');

$forbiddenPresentation = array('$_GET', '$_POST', '$_SESSION', '$_SERVER', '->query(', 'newToken(', 'mjl_form_submission_issue(', 'mjl_activity_recovery_consume(');
foreach ($forbiddenPresentation as $needle) mjl_activity_ownership_assert(strpos($presentation, $needle) === false, 'Presentation retains a request/session/DB effect: '.$needle);

foreach (glob(__DIR__.'/../../custom/mjlfinancement/tpl/activity/*.php') as $template) {
	$source = file_get_contents($template);
	foreach (array('$_GET', '$_POST', '$_SESSION', '$_SERVER', '$db', '->query(', 'newToken(', 'mjl_form_submission_') as $needle) {
		mjl_activity_ownership_assert(strpos($source, $needle) === false, basename($template).' contains forbidden template effect '.$needle);
	}
}

foreach (array('createDraft(', 'createAndSubmit(', 'saveStructure(', 'submitRevision(', 'abandonDraft(', 'restoreDraft(', 'reviewRevision(', 'requestCancellation(', 'changeAssignment(') as $call) {
	mjl_activity_ownership_assert(substr_count($http, $call) === 1, 'POST command dispatch must have one owner for '.$call);
}

print "MJL Activity ownership contract passed.\n";
