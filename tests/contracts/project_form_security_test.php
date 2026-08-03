<?php

require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_form.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_project_recovery.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_form_submission.lib.php';

function mjl_project_form_hardening_assert($condition, $message)
{
	if (!$condition) {
		fwrite(STDERR, "FAIL: ".$message."\n");
		exit(1);
	}
}

$_SESSION = array();

$config = mjl_project_recovery_config('create');
mjl_project_form_hardening_assert(in_array('partner_scope', $config['fields'], true), 'project recovery declares its scoped partner alias');
mjl_project_form_hardening_assert(in_array('project_status', $config['fields'], true), 'project recovery declares its status alias');
mjl_project_form_hardening_assert(mjl_recovery_registry_forbidden_field('fk_soc'), 'generic recovery continues rejecting foreign keys');
mjl_project_form_hardening_assert(mjl_recovery_registry_forbidden_field('mjl_submission'), 'submission nonces can never enter recovery');

$request = array(
	'ref' => 'PRJ-RECOVERED',
	'title' => 'Titre conservé',
	'fk_soc' => '999999',
	'fk_statut' => '999999',
	'partner_scope' => '888888',
	'project_status' => '888888',
	'mjl_submission' => 'attacker-controlled',
);
$safe = mjl_project_recovery_prepare_values($request, 42, 0);
mjl_project_form_hardening_assert(($safe['partner_scope'] ?? null) === '42', 'partner alias is derived from the validated partner');
mjl_project_form_hardening_assert(($safe['project_status'] ?? null) === '0', 'status alias is derived from the validated enum');
mjl_project_form_hardening_assert(!isset($safe['fk_soc']) && !isset($safe['fk_statut']), 'raw foreign keys are never retained');
mjl_project_form_hardening_assert(!isset($safe['mjl_submission']), 'submission nonce is never retained');

$restored = mjl_project_recovery_restore_values($safe, true);
mjl_project_form_hardening_assert(($restored['fk_soc'] ?? null) === '42', 'validated partner alias maps back to the form field');
mjl_project_form_hardening_assert(($restored['fk_statut'] ?? null) === '0', 'validated status alias maps back to the form field');
$stale = mjl_project_recovery_restore_values($safe, false);
mjl_project_form_hardening_assert(!isset($stale['fk_soc']), 'a partner outside the current scope is dropped on recovery');
mjl_project_form_hardening_assert(($stale['ref'] ?? '') === 'PRJ-RECOVERED', 'dropping a stale partner preserves other safe fields');
$malformed = mjl_project_recovery_restore_values(array('partner_scope' => '42x', 'project_status' => '2', 'ref' => 'SAFE'), true);
mjl_project_form_hardening_assert(!isset($malformed['fk_soc']) && !isset($malformed['fk_statut']), 'malformed aliases are dropped');

$summary = mjl_form_error_summary(array('ref' => 'Référence requise.'), 'Corrigez', 'project-', true);
mjl_project_form_hardening_assert(strpos($summary, ' autofocus') !== false, 'recovered project error summaries may request no-script autofocus');
$ordinarySummary = mjl_form_error_summary(array('ref' => 'Référence requise.'), 'Corrigez', 'project-');
mjl_project_form_hardening_assert(strpos($ordinarySummary, ' autofocus') === false, 'ordinary summaries do not unexpectedly steal focus');

$context = array('user_id' => 7, 'entity' => 1, 'route' => 'projects', 'form' => 'project', 'action' => 'create', 'object_id' => 0);
$malformedContext = $context;
$malformedContext['route'] = 'projects!';
$reason = '';
mjl_project_form_hardening_assert(mjl_form_submission_issue($malformedContext, $reason) === '' && $reason === 'invalid_context', 'malformed context names fail with an explicit reason');
$token = mjl_form_submission_issue($context, $reason);
mjl_project_form_hardening_assert($reason === 'issued', 'successful token issue reports its explicit result');
$otherToken = mjl_form_submission_issue($context);
mjl_project_form_hardening_assert(preg_match('/^[a-f0-9]{32}$/', $token) === 1, 'submission token contains 128 random bits encoded as hex');
mjl_project_form_hardening_assert($token !== $otherToken, 'separate form renders receive separate tokens');
$wrongContext = $context;
$wrongContext['entity'] = 2;
mjl_project_form_hardening_assert(!mjl_form_submission_consume($token, $wrongContext, $reason) && $reason === 'context_mismatch', 'context mismatch rejects the token with an explicit reason');
mjl_project_form_hardening_assert(mjl_form_submission_consume($token, $context, $reason) && $reason === 'accepted', 'a mismatch does not consume a valid token');
mjl_project_form_hardening_assert(!mjl_form_submission_consume($token, $context, $reason) && $reason === 'missing_or_replayed', 'a consumed token reports a closed replay reason');

$expired = mjl_form_submission_issue($context);
$_SESSION['mjl_form_submissions'][$expired]['expires_at'] = time();
mjl_project_form_hardening_assert(!mjl_form_submission_consume($expired, $context, $reason) && $reason === 'expired', 'expired tokens fail closed with an explicit reason');
$_SESSION['mjl_form_submissions'] = array();
$boundedTokens = array();
for ($index = 0; $index < MJL_FORM_SUBMISSION_MAX_PENDING + 2; $index++) {
	$boundedTokens[] = mjl_form_submission_issue($context);
}
mjl_project_form_hardening_assert(!mjl_form_submission_consume($boundedTokens[0], $context, $reason) && $reason === 'missing_or_replayed', 'the cap evicts the oldest pending token');
mjl_project_form_hardening_assert(mjl_form_submission_consume(end($boundedTokens), $context, $reason) && $reason === 'accepted', 'the cap keeps the newest pending token usable');

print "MJL project form security: OK\n";
