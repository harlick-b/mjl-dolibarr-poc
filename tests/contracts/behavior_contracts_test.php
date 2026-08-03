<?php

require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_form.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_table.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_timeline_result.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_activity_recovery.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_finance_recovery.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_finance_feedback.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_finance_governance.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_journey.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_ui.lib.php';

function mjl_behavior_assert($condition, $message)
{
	if (!$condition) {
		fwrite(STDERR, 'FAIL: '.$message.PHP_EOL);
		exit(1);
	}
}

class MjlFinanceGovernanceProbe
{
	use MjlFinanceGovernedUpdateComment;

	public $error = '';

	public function normalize(&$comment)
	{
		return $this->normalizeRequiredUpdateComment($comment);
	}
}

$_SESSION = array();
$context = array('user_id' => 12, 'entity' => 1, 'route' => 'activities', 'form' => 'create', 'action' => 'create', 'object_id' => 0);
$reason = '';
$handle = mjl_form_recovery_store($context, array('ref' => 'SAFE', 'token' => 'SECRET'), array('ref'), $reason);
mjl_behavior_assert(preg_match('/^[a-f0-9]{32}$/', $handle) === 1, 'recovery handle is opaque');
$wrong = $context;
$wrong['entity'] = 2;
mjl_behavior_assert(mjl_form_recovery_consume($handle, $wrong) === null, 'cross-entity recovery fails closed');
$entry = mjl_form_recovery_consume($handle, $context);
mjl_behavior_assert($entry['values'] === array('ref' => 'SAFE'), 'recovery retains only allowlisted values');
mjl_behavior_assert(mjl_form_recovery_consume($handle, $context) === null, 'recovery is one-use');

$activityRegistry = mjl_activity_recovery_registry();
mjl_behavior_assert(isset($activityRegistry['create'], $activityRegistry['final_validate']), 'activity recovery covers durable actions');
mjl_behavior_assert(!isset($activityRegistry['upload'], $activityRegistry['unknown']), 'activity recovery excludes upload and unknown actions');
foreach (array('conventions', 'budgetlines', 'fundreceipts') as $route) {
	$registry = mjl_finance_recovery_registry($route);
	mjl_behavior_assert($registry !== array(), $route.' recovery registry exists');
	foreach ($registry as $config) {
		foreach ($config['fields'] as $field) {
			mjl_behavior_assert(strpos($field, 'fk_') !== 0, $route.' recovery excludes foreign keys');
		}
	}
}
mjl_behavior_assert(mjl_finance_recovery_config('fundreceipts', 'upload') === null, 'finance upload is not recoverable');
mjl_behavior_assert(mjl_finance_recovery_config('future', 'create') === null, 'unknown finance route fails closed');
$malformedRegistry = array('upload' => array('form' => 'create', 'fields' => array('ref')));
mjl_behavior_assert(mjl_recovery_registry_config($malformedRegistry, 'upload') === null, 'forbidden recovery action invalidates registry');
mjl_behavior_assert(mjl_recovery_registry_consume_allowlist($malformedRegistry) === array(), 'malformed registry yields no consume allowlist');

$normalized = mjl_table_normalize_request(array('status' => '3', 'project' => '42', 'risk' => 'overdue', 'sort' => 'deadline', 'page' => '999'), array('0', '3'), array(42), 120, 50);
mjl_behavior_assert($normalized['project'] === 42 && $normalized['page'] === 3 && !$normalized['fail_closed'], 'table request normalizes and clamps valid input');
$invalid = mjl_table_normalize_request(array('status' => 'DROP TABLE', 'project' => '999'), array('0', '3'), array(42), 120, 50);
mjl_behavior_assert($invalid['fail_closed'] === true, 'table request fails closed for invalid filters');

$timeline = mjl_timeline_aggregate_sources(array(
	array('source' => 'later', 'order' => 2, 'items' => array(array('rowid' => 2, 'sort_date' => '2026-01-02', 'title' => 'Second')), 'errors' => array()),
	array('source' => 'first', 'order' => 1, 'items' => array(array('rowid' => 1, 'sort_date' => '2026-01-01', 'title' => 'First')), 'errors' => array('database')),
));
mjl_behavior_assert(array_column($timeline['items'], 'title') === array('First', 'Second'), 'partial results retain stable successful ordering');
mjl_behavior_assert($timeline['errors'] === array(array('source' => 'first', 'category' => 'database')), 'partial errors remain source-qualified');

mjl_behavior_assert(mjl_timeline_presentation_action_label('', 'future_action') === 'Événement non reconnu', 'unknown actions use neutral labels');
mjl_behavior_assert(mjl_timeline_presentation_actor_role_label('', '', 'future_role') === 'Rôle non reconnu', 'unknown roles use neutral labels');
mjl_behavior_assert(mjl_timeline_presentation_status_label('mjlfinancement_activity', 'future') === 'Statut non reconnu', 'unknown statuses use neutral labels');
mjl_behavior_assert(mjl_timeline_presentation_status_label('mjlfinancement_expense', '7') === 'Décaissée', 'disbursement stays distinct');

$journey = mjl_journey_render_summary(array('title' => '<Unsafe>', 'items' => array(array('label' => 'Statut', 'value' => 'Actif', 'tone' => 'future'))));
mjl_behavior_assert(strpos($journey, '&lt;Unsafe&gt;') !== false && strpos($journey, 'mjl-status-neutral') !== false, 'journey escapes content and closes tones');
mjl_behavior_assert(mjl_journey_guarded_document_url('/custom/mjlfinancement/documentdownload.php?id=1') !== '', 'guarded document route is accepted');
mjl_behavior_assert(mjl_journey_guarded_document_url('/document.php?id=1') === '', 'raw document route is rejected');

$feedback = mjl_finance_feedback_domain('budgetlines', 'update', 7, 'Update comment is required');
mjl_behavior_assert(($feedback['category'] ?? '') === 'validation', 'exact finance failure is classified');
mjl_behavior_assert(mjl_finance_feedback_domain('budgetlines', 'update', 7, 'SQLSTATE private') ['category'] === 'unknown', 'raw diagnostics are not classified as domain feedback');
mjl_behavior_assert(mjl_finance_feedback_recovery_errors('budgetlines', 'update', $feedback, array('comment')) === array('comment' => 'Le motif de modification est obligatoire.'), 'finance recovery filters exact allowed fields');
$governance = new MjlFinanceGovernanceProbe();
$semanticBlank = "\xE2\x80\x8B &nbsp; <span></span>";
mjl_behavior_assert($governance->normalize($semanticBlank) === false && $governance->error === 'Update comment is required', 'finance update reasons reject semantic blanks');
$meaningfulReason = '  Correction documentée  ';
mjl_behavior_assert($governance->normalize($meaningfulReason) === true && $meaningfulReason === 'Correction documentée', 'finance update reasons retain normalized meaningful text');

$errors = mjl_form_translate_domain_error('Physical execution percentage must be between 0 and 100');
mjl_behavior_assert(isset($errors['physical_execution_percent']), 'domain failure links only its field');
$summary = mjl_form_error_summary(array('_form' => 'Échec global.', 'ref' => 'Référence requise.'));
mjl_behavior_assert(strpos($summary, 'href="#mjl-field-ref"') !== false, 'field errors are linked');
mjl_behavior_assert(strpos($summary, 'href="#mjl-field-_form"') === false, 'form-level errors are not linked to missing controls');

$log = sys_get_temp_dir().'/mjl-ui-contract-'.bin2hex(random_bytes(4)).'.log';
ini_set('error_log', $log);
mjl_ui_log_error('database', array('route' => 'activities', 'token' => 'secret-token'), 'SQLSTATE SELECT /private/path');
$logged = file_get_contents($log);
unlink($log);
mjl_behavior_assert(strpos($logged, 'activities') !== false, 'technical log retains safe context');
mjl_behavior_assert(strpos($logged, 'secret-token') === false && strpos($logged, 'SQLSTATE') === false && strpos($logged, '/private') === false, 'technical log redacts secrets and diagnostics');

print 'MJL behavior contracts: OK'.PHP_EOL;
