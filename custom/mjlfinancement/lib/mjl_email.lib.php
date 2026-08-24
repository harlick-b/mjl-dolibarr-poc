<?php

require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/core/class/CMailFile.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_email_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';

function mjl_email_entity()
{
	global $conf;

	$entity = (int) $conf->entity;
	return $entity > 0 ? $entity : 1;
}

function mjl_email_now_sql()
{
	global $db;

	return "'".$db->idate(dol_now())."'";
}

function mjl_email_string_sql($value)
{
	global $db;

	if ($value === null || $value === '') {
		return 'NULL';
	}
	return "'".$db->escape((string) $value)."'";
}

function mjl_email_absolute_url($relativeUrl)
{
	global $dolibarr_main_url_root;
	$root = trim((string) $dolibarr_main_url_root);
	if ($root === '' && defined('DOL_MAIN_URL_ROOT')) $root = DOL_MAIN_URL_ROOT;
	if (defined('DOL_URL_ROOT') && DOL_URL_ROOT !== '' && substr($root, -strlen(DOL_URL_ROOT)) === DOL_URL_ROOT) $root = substr($root, 0, -strlen(DOL_URL_ROOT));
	$path = mjl_safe_internal_path($relativeUrl);
	if ($path === '') return '';
	if (defined('DOL_URL_ROOT') && DOL_URL_ROOT !== '' && strpos($path, DOL_URL_ROOT.'/') !== 0) $path = DOL_URL_ROOT.$path;
	return mjl_public_url_for_internal_path($path, $root);
}

function mjl_email_mail_from()
{
	$from = getDolGlobalString('MAIN_MAIL_EMAIL_FROM');
	if ($from === '') {
		$from = getDolGlobalString('MAIN_INFO_SOCIETE_MAIL');
	}
	return $from !== '' ? $from : 'MJL Financement <noreply@mjl-poc.local>';
}

function mjl_email_plain_text($value, $maxLength = 500)
{
	$value = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
	$value = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value);
	$value = trim(preg_replace('/\s+/u', ' ', $value));
	return function_exists('mb_substr') ? mb_substr($value, 0, $maxLength, 'UTF-8') : substr($value, 0, $maxLength);
}

function mjl_email_render($template, array $context)
{
	$templates = mjl_email_templates();
	$template = (string) $template;
	if (!isset($templates[$template])) return false;
	$definition = $templates[$template];
	$name = mjl_email_plain_text(isset($context['recipient_name']) ? $context['recipient_name'] : '', 120);
	if ($name === '') $name = 'Madame, Monsieur';
	$link = isset($context['link']) ? mjl_email_absolute_url($context['link']) : '';
	if (isset($context['link']) && $link === '') return false;
	$activityRef = mjl_email_plain_text(isset($context['activity_ref']) ? $context['activity_ref'] : '', 80);
	$activityLabel = mjl_email_plain_text(isset($context['activity_label']) ? $context['activity_label'] : '', 160);
	$projectRef = mjl_email_plain_text(isset($context['project_ref']) ? $context['project_ref'] : '', 80);
	$comment = mjl_email_plain_text(isset($context['comment']) ? $context['comment'] : '', 500);
	$subject = '[MJL Financement] '.$definition['subject'].($activityRef !== '' ? ' : '.$activityRef : '');
	$title = $definition['title'];
	$message = $definition['message'];
	$action = $definition['action_label'];
	$security = $definition['security_note'];
	$details = array();
	if ($definition['status_label'] !== '') $details['Statut'] = $definition['status_label'];

	if ($activityRef !== '') {
		$details['Activité'] = trim($activityRef.' - '.$activityLabel, ' -');
	}
	if ($projectRef !== '') {
		$details['Projet'] = $projectRef;
	}
	if ($comment !== '') {
		$details['Commentaire'] = $comment;
	}

	$body = "MJL Financement\n";
	$body .= "================\n\n";
	$body .= $title."\n\n";
	$body .= 'Bonjour '.$name.",\n\n";
	$body .= $message."\n\n";
	if ($link !== '') {
		$body .= $action." :\n".$link."\n\n";
	}
	if (!empty($details)) {
		$body .= "Contexte\n";
		foreach ($details as $label => $value) {
			if ((string) $value === '') {
				continue;
			}
			$body .= '- '.$label.' : '.$value."\n";
		}
		$body .= "\n";
	}
	$body .= $security."\n\n";
	$body .= "MJL Financement\n";
	$body .= "Message automatique — merci de ne pas répondre directement.";

	return array('subject' => $subject, 'body' => $body);
}

function mjl_email_send(User $recipient, $template, array $context, array $audit = array())
{
	if (trim((string) $recipient->email) === '') {
		mjl_email_record_event('email_send_failed', $recipient, $audit, $template, 'missing_email');
		return array(-1, 'Adresse email manquante.');
	}

	$fullName = trim(trim((string) $recipient->firstname).' '.trim((string) $recipient->lastname));
	$context['recipient_name'] = $fullName !== '' ? $fullName : $recipient->login;
	$rendered = mjl_email_render($template, $context);
	if ($rendered === false) {
		mjl_email_record_event('email_send_failed', $recipient, $audit, 'unknown', 'reason=unknown_template');
		mjl_ui_log_error('email', array('route' => 'email', 'action' => 'unknown_template', 'entity' => mjl_email_entity(), 'user_id' => (int) $recipient->id));
		return array(-1, 'L’envoi du message n’a pas pu être réalisé.');
	}
	$delivery = mjl_email_e2e_enabled() ? 'e2e' : 'mail';

	if ($delivery === 'e2e') {
		if (!mjl_email_write_test_outbox($template, $recipient, $rendered, $context)) {
			mjl_email_record_event('email_send_failed', $recipient, $audit, $template, 'delivery=e2e;error=outbox');
			return array(-1, 'Echec capture email E2E.');
		}
		mjl_email_record_event('email_sent', $recipient, $audit, $template, 'delivery=e2e');
		return array(1, '');
	}

	$mail = new CMailFile($rendered['subject'], $recipient->email, mjl_email_mail_from(), $rendered['body'], array(), array(), array(), '', '', 0, 0, '', '', 'mjl_'.$template, '', 'standard');
	if (!$mail->sendfile()) {
		mjl_email_record_event('email_send_failed', $recipient, $audit, $template, 'delivery=mail;reason=transport_failed');
		mjl_ui_log_error('email', array('route' => 'email', 'action' => 'delivery', 'entity' => mjl_email_entity(), 'user_id' => (int) $recipient->id), $mail->error);
		return array(-1, 'L’envoi du message n’a pas pu être réalisé.');
	}

	mjl_email_record_event('email_sent', $recipient, $audit, $template, 'delivery=mail');
	return array(1, '');
}

function mjl_email_record_event($event, User $recipient, array $audit, $template, $extraContext = '')
{
	global $db;
	if ($event !== 'email_send_failed') return;

	$actorId = empty($audit['actor_id']) ? null : (int) $audit['actor_id'];
	$context = array(
		'template' => $template,
		'target' => (int) $recipient->id,
	);
	foreach (array('object_type', 'object_id', 'object_ref') as $key) {
		if (isset($audit[$key]) && (string) $audit[$key] !== '') {
			$context[$key] = $audit[$key];
		}
	}
	$contextText = mjl_email_context_string($context);
	if ($extraContext !== '') {
		$contextText .= ($contextText === '' ? '' : ';').$extraContext;
	}

	$actor = null;
	if ($actorId) {
		$actor = new User($db);
		if ($actor->fetch($actorId) <= 0) $actor = null;
	}
	mjl_audit_record_outcome($db, array(
		'entity' => mjl_email_entity(),
		'object_type' => isset($audit['object_type']) ? $audit['object_type'] : 'mjlfinancement_email',
		'object_id' => isset($audit['object_id']) ? (int) $audit['object_id'] : (int) $recipient->id,
		'object_ref' => isset($audit['object_ref']) ? $audit['object_ref'] : null,
		'actor' => $actor,
		'action' => $event,
		'result' => 'FAILED',
		'context' => array('detail' => $contextText),
	));
}

function mjl_email_context_string(array $context)
{
	$parts = array();
	foreach ($context as $key => $value) {
		$parts[] = preg_replace('/[^a-z0-9_]/i', '', (string) $key).'='.mjl_email_context_value($value);
	}
	return implode(';', $parts);
}

function mjl_email_context_value($value)
{
	return str_replace(array(';', "\n", "\r"), array(',', ' ', ' '), substr((string) $value, 0, 180));
}

function mjl_email_e2e_enabled()
{
	global $db;
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1') return false;

	if (function_exists('mjl_auth_e2e_tokens_enabled')) {
		return mjl_auth_e2e_tokens_enabled();
	}

	$sql = 'SELECT value FROM '.$db->prefix()."const WHERE name = 'MJL_AUTH_E2E_EXPOSE_TOKENS'";
	$sql .= ' AND entity IN (0, '.mjl_email_entity().') ORDER BY entity DESC, rowid DESC LIMIT 1';
	$resql = $db->query($sql);
	if (!$resql) {
		return false;
	}
	$obj = $db->fetch_object($resql);
	return $obj && (string) $obj->value === '1';
}

function mjl_email_write_test_outbox($template, User $recipient, array $rendered, array $context)
{
	global $db;

	$dir = DOL_DATA_ROOT.'/mjlfinancement/email-test-outbox';
	if (!is_dir($dir)) {
		dol_mkdir($dir);
	}
	if (!is_writable($dir)) {
		return false;
	}

	$payload = array(
		'template' => (string) $template,
		'to' => (string) $recipient->email,
		'user_id' => (int) $recipient->id,
		'subject' => (string) $rendered['subject'],
		'body' => (string) $rendered['body'],
		'created_at' => date('c'),
	);
	if (isset($context['link'])) {
		$payload['link'] = mjl_email_absolute_url($context['link']);
	}

	$json = json_encode($payload, JSON_UNESCAPED_SLASHES);
	if (file_put_contents($dir.'/latest-'.preg_replace('/[^a-z0-9_]/i', '_', (string) $template).'.json', $json) === false) {
		return false;
	}
	if (file_put_contents($dir.'/emails.jsonl', $json."\n", FILE_APPEND) === false) {
		return false;
	}

	mjl_email_store_e2e_const('MJL_EMAIL_E2E_LAST_'.strtoupper((string) $template).'_SUBJECT', $rendered['subject']);
	// Authentication bodies contain a fragment verifier. Keep that credential
	// solely in the disposable file outbox instead of duplicating it in SQL.
	if (empty($context['auth_link_type'])) {
		mjl_email_store_e2e_const('MJL_EMAIL_E2E_LAST_'.strtoupper((string) $template).'_BODY', $rendered['body']);
	}
	mjl_email_store_e2e_const('MJL_EMAIL_E2E_LAST_'.strtoupper((string) $template).'_TO', $recipient->email);

	if (isset($context['auth_link_type']) && isset($context['link']) && function_exists('mjl_auth_write_test_outbox')) {
		if (!mjl_auth_write_test_outbox($context['auth_link_type'], (int) $recipient->id, $context['link'])) {
			return false;
		}
	}

	return true;
}

function mjl_email_store_e2e_const($name, $value)
{
	global $db;

	$sql = 'DELETE FROM '.$db->prefix().'const WHERE name = '.mjl_email_string_sql($name).' AND entity = '.mjl_email_entity();
	if (!$db->query($sql)) {
		return false;
	}
	$sql = 'INSERT INTO '.$db->prefix().'const (name, entity, value, type, visible, note) VALUES (';
	$sql .= mjl_email_string_sql($name).', '.mjl_email_entity().', '.mjl_email_string_sql($value).", 'chaine', 0, 'MJL E2E email')";
	return (bool) $db->query($sql);
}
