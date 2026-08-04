<?php

$root = dirname(__DIR__, 2);

function mjl_presentation_assert($condition, $message)
{
	if (!$condition) {
		fwrite(STDERR, "FAIL: ".$message."\n");
		exit(1);
	}
}

if (!function_exists('setEventMessages')) {
	function setEventMessages($message, $unused = null, $style = 'mesgs')
	{
		if (!isset($_SESSION['dol_events'])) $_SESSION['dol_events'] = array();
		foreach ($_SESSION['dol_events'] as $event) if ($event['type'] === $style && $event['mesg'] === $message) return;
		$_SESSION['dol_events'][] = array('type' => $style, 'mesg' => $message);
	}
}

require_once $root.'/custom/mjlfinancement/lib/mjl_presentation.lib.php';
require_once $root.'/custom/mjlfinancement/lib/mjl_status_presentation.lib.php';
require_once $root.'/custom/mjlfinancement/lib/mjl_feedback.lib.php';
require_once $root.'/custom/mjlfinancement/lib/mjl_alert_presentation.lib.php';
require_once $root.'/custom/mjlfinancement/lib/mjl_alert_condition.lib.php';

mjl_presentation_assert(mjl_format_money(1657000) === '1 657 000 F CFA', 'XOF money uses French grouping and label');
mjl_presentation_assert(mjl_format_money(0) === '0 F CFA', 'numeric zero is not empty');
mjl_presentation_assert(mjl_format_money(-0.004) === '0 F CFA', 'rounded negative zero is normalized');
mjl_presentation_assert(mjl_format_money(1200, 'eur') === '1 200 EUR', 'valid non-XOF currency keeps its code');
mjl_presentation_assert(mjl_format_money(null) === 'Non renseigné', 'null money is empty');
mjl_presentation_assert(mjl_format_money('') === 'Non renseigné', 'empty money is empty');
mjl_presentation_assert(mjl_format_money('12oops') === 'Non renseigné', 'invalid money is empty');
mjl_presentation_assert(mjl_format_money(INF) === 'Non renseigné', 'non-finite money is empty');
mjl_presentation_assert(mjl_format_number(1234.56) === '1 234,56', 'decimal defaults to two places');
mjl_presentation_assert(mjl_format_number(12.34, 'percentage') === '12,3 %', 'percentage defaults to one place');
mjl_presentation_assert(mjl_format_number(12.8, 'count') === '13', 'count defaults to zero places');
mjl_presentation_assert(!isset($_SESSION['dol_tz_string']), 'date contract starts without a user timezone override');
$_SESSION['dol_tz_string'] = date_default_timezone_get();
mjl_presentation_assert(mjl_format_date('2026-08-04', 'date') === '04/08/2026', 'date uses fixed French shape');
mjl_presentation_assert(mjl_format_date('2026-08-04 13:07:00', 'datetime') === '04/08/2026 13:07', 'datetime uses fixed French shape');
mjl_presentation_assert(mjl_format_date('2026-08-04 13:07:00', 'time') === '13:07', 'time uses fixed shape');
mjl_presentation_assert(mjl_format_date('not-a-date') === 'Non renseigné', 'invalid date is empty');
mjl_presentation_assert(mjl_format_date('2026-02-30') === 'Non renseigné', 'impossible calendar date is rejected');
mjl_presentation_assert(mjl_format_date('2026-08-04', 'datetime') === '04/08/2026 00:00', 'date-only values are not shifted by timezone conversion');
$previousTimezone = date_default_timezone_get();
date_default_timezone_set('Africa/Porto-Novo');
$_SESSION['dol_tz_string'] = 'Europe/Paris';
mjl_presentation_assert(mjl_format_date('2026-08-04 13:07:00', 'datetime') === '04/08/2026 14:07', 'naive server datetime converts to the user timezone as an instant');
mjl_presentation_assert(mjl_format_date('2026-08-04 13:07:00+00:00', 'datetime') === '04/08/2026 15:07', 'timezone-aware datetime converts as an instant');
mjl_presentation_assert(mjl_format_date(0, 'datetime') === '01/01/1970 01:00', 'timestamp converts as an instant');
$_SESSION['dol_tz_string'] = 'Invalid/Timezone';
mjl_presentation_assert(mjl_format_date('2026-08-04 13:07:00+00:00', 'datetime') === '04/08/2026 13:07', 'invalid configured timezone safely falls back to UTC');
unset($_SESSION['dol_tz_string']);
date_default_timezone_set($previousTimezone);

mjl_presentation_assert(mjl_safe_internal_path('/custom/mjlfinancement/activities.php?id=12') === '/custom/mjlfinancement/activities.php?id=12', 'module path is accepted');
foreach (array('https://evil.test/x', '//evil.test/x', '/custom/../admin', '/custom/%2e%2e/admin', "javascript:alert(1)", "/custom/x\nLocation: evil", '\\evil\\x') as $unsafe) {
	mjl_presentation_assert(mjl_safe_internal_path($unsafe) === '', 'unsafe internal destination is rejected: '.json_encode($unsafe));
}
mjl_presentation_assert(mjl_safe_internal_path('/custom/%252e%252e/admin') === '', 'double-encoded traversal is rejected');
mjl_presentation_assert(mjl_safe_internal_path('/custom/%252525252525252525252525252525252e%252525252525252525252525252525252e/admin') === '', 'input still decoding after sixteen passes is rejected');
mjl_presentation_assert(mjl_safe_internal_path('/custom/%250aheader') === '', 'double-encoded control is rejected');
mjl_presentation_assert(mjl_safe_internal_path('/custom/%255cadmin') === '', 'double-encoded backslash is rejected');
mjl_presentation_assert(mjl_safe_internal_path('/custom/%2') === '', 'malformed original percent escape is rejected');
mjl_presentation_assert(mjl_safe_internal_path('/custom/100%done') === '', 'bare original percent is rejected');
mjl_presentation_assert(mjl_safe_internal_path('/custom/%25done?value=%2525#section') === '/custom/%25done?value=%2525#section', 'safe encoded percent, query, and fragment are preserved');
mjl_presentation_assert(mjl_safe_internal_path('/'.str_repeat('a', 2047)) === '/'.str_repeat('a', 2047), '2048-byte internal destination is accepted');
mjl_presentation_assert(mjl_safe_internal_path('/'.str_repeat('a', 2048)) === '', 'destination longer than 2048 bytes is rejected');
mjl_presentation_assert(mjl_public_url_for_internal_path('/custom/mjlfinancement/alerts.php', 'https://mjl.example') === 'https://mjl.example/custom/mjlfinancement/alerts.php', 'trusted origin and internal path compose');
mjl_presentation_assert(mjl_public_url_for_internal_path('https://evil.test', 'https://mjl.example') === '', 'external email destination is rejected');

$activity = mjl_status_presentation('activity', 7, 'operational');
mjl_presentation_assert($activity['label'] === 'Prévalidée' && $activity['tone'] === 'warning', 'activity operational presentation is closed');
$expenseOperational = mjl_status_presentation('expense', 2, 'operational');
$expenseHistory = mjl_status_presentation('expense', 2, 'history');
mjl_presentation_assert($expenseOperational['label'] === 'Validée définitivement', 'legacy expense status keeps operational meaning');
mjl_presentation_assert($expenseHistory['label'] === 'Validation enregistrée', 'legacy expense status keeps history meaning');
mjl_presentation_assert(mjl_status_presentation('unknown', 'wild', 'operational')['tone'] === 'neutral', 'unknown status is neutral');

$_SESSION = array();
mjl_feedback_reset_request_state();
mjl_feedback_add('create:activity:42', 'activity.created');
mjl_feedback_add('create:activity:42', 'activity.created');
mjl_feedback_add('create:activity:43', 'activity.created');
$feedbackHtml = mjl_feedback_render_and_clear();
mjl_presentation_assert(substr_count($feedbackHtml, 'Activité créée en brouillon.') === 2, 'same operation deduplicates while separate operations remain');
mjl_presentation_assert(substr_count($feedbackHtml, 'role="status"') === 2 && strpos($feedbackHtml, 'aria-live="polite"') !== false, 'success feedback has polite live semantics');
mjl_presentation_assert(strpos($feedbackHtml, 'mjl-feedback-marker') === false && empty($_SESSION['dol_events']), 'opaque markers are stripped and events cleared');

mjl_feedback_reset_request_state();
mjl_feedback_add('revoke:accepted:1', 'access.invitation_already_accepted');
$warningHtml = mjl_feedback_render_and_clear();
mjl_presentation_assert(strpos($warningHtml, 'role="alert"') !== false && strpos($warningHtml, 'déjà acceptée') !== false, 'invitation no-op keeps warning semantics and formal copy');

mjl_feedback_reset_request_state();
mjl_feedback_add('invalid:1', 'not.registered', array('diagnostic' => '<sql>'));
$invalidHtml = mjl_feedback_render_and_clear();
mjl_presentation_assert(strpos($invalidHtml, 'role="alert"') !== false, 'invalid feedback becomes a persistent alert');
mjl_presentation_assert(strpos($invalidHtml, 'sql') === false && strpos($invalidHtml, '&lt;sql&gt;') === false, 'invalid context never reaches the UI');

$alert = mjl_alert_presentation('expense_missing_document', array('object_id' => 9, 'document_state' => 'missing'));
mjl_presentation_assert($alert['tone'] === 'danger' && $alert['href'] === '/custom/mjlfinancement/expenses.php?id=9', 'alert registry fixes tone and destination');
$reviewAlert = mjl_alert_presentation('activity_awaiting_prevalidation', array('object_id' => 3));
mjl_presentation_assert($reviewAlert['audience'] === 'Agent vérificateur et prévalidateur', 'alert registry uses the protected production role term');
$unknownAlert = mjl_alert_presentation('not_registered', array('object_id' => 9));
mjl_presentation_assert($unknownAlert['tone'] === 'neutral' && $unknownAlert['href'] === '' && $unknownAlert['audience'] === 'Administrateur plateforme', 'unknown alert fails closed to an administrator with no destination');
$draftOverBudget = mjl_alert_presentation('expense_exceeds_budget', array('object_id' => 9, 'status_code' => 0));
$submittedOverBudget = mjl_alert_presentation('expense_exceeds_budget', array('object_id' => 9, 'status_code' => 1));
$prevalidatedOverBudget = mjl_alert_presentation('expense_exceeds_budget', array('object_id' => 9, 'status_code' => 4));
mjl_presentation_assert($draftOverBudget['audience'] === 'Agent de saisie' && strpos($draftOverBudget['expected_action'], 'Corriger') !== false, 'draft over-budget alert belongs to the input agent');
mjl_presentation_assert($submittedOverBudget['audience'] === 'Agent vérificateur et prévalidateur' && strpos($submittedOverBudget['expected_action'], 'retourner') !== false, 'submitted over-budget alert belongs to the verifier');
mjl_presentation_assert($prevalidatedOverBudget['audience'] === 'Validateur définitif' && strpos($prevalidatedOverBudget['expected_action'], 'Rejeter') !== false, 'prevalidated over-budget alert belongs to the final validator');
$registry = mjl_alert_presentation_registry();
foreach ($registry as $key => $definition) {
	mjl_presentation_assert(isset($definition['severity'], $definition['tone'], $definition['audience'], $definition['expected_action'], $definition['route'], $definition['priority']), 'alert metadata is named for '.$key);
	mjl_presentation_assert(is_int($definition['priority']), 'alert priority is an integer for '.$key);
}
$rawCondition = mjl_alert_condition(array(
	'semantic_key' => 'expense_missing_document',
	'domain' => 'expenses',
	'object_type' => 'mjlfinancement_expense',
	'object_id' => '9',
	'partner_id' => '4',
	'reference' => 'EXP-9',
	'domain_label' => 'Pièce brute',
	'status_code' => 0,
	'sort_date' => '2026-08-04',
	'priority' => '10',
	'dynamic_actor_role_key' => '',
	'facts' => array('amount' => 1200),
	'severity' => 'Critique',
));
mjl_presentation_assert(mjl_alert_condition_is_raw($rawCondition), 'raw alert condition has only canonical machine fields and scalar types');
mjl_presentation_assert(!isset($rawCondition['severity'], $rawCondition['tone'], $rawCondition['href']), 'raw alert condition excludes presentation fields');

require_once $root.'/custom/mjlfinancement/lib/mjl_email_presentation.lib.php';
$emailRegistry = mjl_email_templates();
foreach ($emailRegistry as $key => $definition) {
	mjl_presentation_assert(array_keys($definition) === array('subject', 'title', 'message', 'action_label', 'security_note', 'status_label'), 'email metadata is named for '.$key);
}

$directEventCalls = array();
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/custom/mjlfinancement'));
foreach ($iterator as $file) {
	if (!$file->isFile() || substr($file->getFilename(), -4) !== '.php') continue;
	$path = $file->getPathname();
	if (basename($path) === 'mjl_feedback.lib.php') continue;
	if (strpos(file_get_contents($path), 'setEventMessages(') !== false) $directEventCalls[] = substr($path, strlen($root) + 1);
}
mjl_presentation_assert(empty($directEventCalls), 'only the feedback adapter may call setEventMessages: '.implode(', ', $directEventCalls));

print "Presentation convergence contracts passed.\n";
