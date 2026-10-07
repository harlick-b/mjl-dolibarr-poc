<?php

function newToken()
{
	static $index=0;
	return 'csrf-'.(++$index);
}

require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_form_submission.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_activity_form.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/activity/mjl_activity_feedback.lib.php';

function mjl_activity_form_effects_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

$_SESSION = array();
$conf = (object) array('entity' => 3);
$user = (object) array('id' => 17);

$context = array(
	'user_id' => 17,
	'entity' => 3,
	'route' => 'activities',
	'form' => 'activity',
	'action' => 'save_structure',
	'object_id' => 41,
	'revision_id' => 0,
	'version' => 7,
);
$prepared = mjl_activity_prepare_form_effects(array(
	'primary' => array('save_structure', 41, 0, 7),
	'cancel' => array('request_cancellation', 41, 0, 7),
), $user, 3);
mjl_activity_form_effects_assert(array_keys($prepared) === array('primary','cancel'), 'Only handler-selected forms may receive effects.');
mjl_activity_form_effects_assert($prepared['primary']['csrf'] !== $prepared['cancel']['csrf'], 'Each rendered form must receive its own CSRF token.');
mjl_activity_form_effects_assert($prepared['primary']['submission'] !== $prepared['cancel']['submission'], 'Each rendered form must receive its own contextual submission token.');

$feedback = mjl_activity_result_feedback(array('result' => 'STALE_VERSION'));
mjl_activity_form_effects_assert($feedback === array('warning', 'La fiche a changé', 'Rechargez la page avant de reprendre votre modification.'), 'The handler feedback preparation must preserve the stable stale-version message.');
mjl_activity_form_effects_assert(mjl_activity_result_feedback(array('result' => 'UNKNOWN')) === array(), 'Unknown result codes must not create presentation feedback.');
mjl_activity_form_effects_assert(mjl_activity_result_feedback(array('result' => array('OK'))) === array(), 'Non-scalar result codes must not create presentation feedback.');

$reason = '';
$token = mjl_form_submission_issue($context, $reason);
mjl_activity_form_effects_assert($reason === 'issued', 'Activity context must issue a token.');
$mismatch = $context;
$mismatch['version'] = 8;
mjl_activity_form_effects_assert(!mjl_form_submission_consume($token, $mismatch, $reason) && $reason === 'context_mismatch', 'A version mismatch must fail without consuming the token.');
mjl_activity_form_effects_assert(mjl_form_submission_consume($token, $context, $reason) && $reason === 'accepted', 'The exact Activity context must consume once.');
mjl_activity_form_effects_assert(!mjl_form_submission_consume($token, $context, $reason) && $reason === 'missing_or_replayed', 'An Activity token replay must fail closed.');

$expired = mjl_form_submission_issue($context);
$_SESSION['mjl_form_submissions'][$expired]['expires_at'] = time();
mjl_activity_form_effects_assert(!mjl_form_submission_consume($expired, $context, $reason) && $reason === 'expired', 'Expired Activity tokens must fail closed.');

$_SESSION['mjl_form_submissions'] = array();
$issued = array();
for ($index = 0; $index < MJL_FORM_SUBMISSION_MAX_PENDING + 1; $index++) $issued[] = mjl_form_submission_issue($context);
mjl_activity_form_effects_assert(!mjl_form_submission_consume($issued[0], $context, $reason), 'The per-user cap must evict the oldest Activity token.');
mjl_activity_form_effects_assert(mjl_form_submission_consume(end($issued), $context, $reason), 'The per-user cap must keep the newest Activity token.');

$structure = array(
	'name' => 'Activite recuperee',
	'description' => 'Description',
	'date_start' => '2026-10-08',
	'date_end' => '2026-10-09',
	'authorized_amount' => '100',
	'operations' => array(array('client_key' => 'op-0', 'name' => 'Operation', 'authorized_amount' => '100', 'type_id' => '99')),
);
$handle = mjl_activity_recovery_store($structure, 41, 'edit');
mjl_activity_form_effects_assert(preg_match('/^[a-f0-9]{32}$/', $handle) === 1, 'Valid Activity recovery must return a bounded opaque handle.');
mjl_activity_form_effects_assert(mjl_activity_recovery_consume($handle, 42, 'edit') === array(), 'Object mismatch must not consume Activity recovery.');
$restored = mjl_activity_recovery_consume($handle, 41, 'edit');
mjl_activity_form_effects_assert(($restored['name'] ?? '') === 'Activite recuperee', 'Exact Activity recovery binding must restore editable values.');
mjl_activity_form_effects_assert(!isset($restored['operations'][0]['type_id']), 'Activity recovery must not restore an unvalidated type identifier.');
mjl_activity_form_effects_assert(mjl_activity_recovery_consume($handle, 41, 'edit') === array(), 'Activity recovery must be consumed once.');

$expiredHandle = mjl_activity_recovery_store($structure, 41, 'edit');
$_SESSION['mjl_activity_recovery'][$expiredHandle]['expires'] = time();
mjl_activity_form_effects_assert(mjl_activity_recovery_consume($expiredHandle, 41, 'edit') === array(), 'Expired Activity recovery must fail closed.');

$oversized = $structure;
$oversized['description'] = str_repeat('x', MJL_ACTIVITY_RECOVERY_MAX_BYTES);
mjl_activity_form_effects_assert(mjl_activity_recovery_store($oversized, 41, 'edit') === '', 'Oversized Activity recovery must not be stored.');

print "MJL Activity form effects contract passed.\n";
