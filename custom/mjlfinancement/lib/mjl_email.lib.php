<?php

require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/core/class/CMailFile.class.php';

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

	$relativeUrl = (string) $relativeUrl;
	if (preg_match('/^https?:\/\//i', $relativeUrl)) {
		return $relativeUrl;
	}

	$root = trim((string) $dolibarr_main_url_root);
	if ($root === '' && defined('DOL_MAIN_URL_ROOT')) {
		$root = DOL_MAIN_URL_ROOT;
	}
	if ($root === '') {
		$root = DOL_URL_ROOT;
	}
	$root = preg_replace('/'.preg_quote(DOL_URL_ROOT, '/').'$/i', '', $root);
	return rtrim($root, '/').DOL_URL_ROOT.$relativeUrl;
}

function mjl_email_mail_from()
{
	$from = getDolGlobalString('MAIN_MAIL_EMAIL_FROM');
	if ($from === '') {
		$from = getDolGlobalString('MAIN_INFO_SOCIETE_MAIL');
	}
	return $from !== '' ? $from : 'MJL Financement <noreply@mjl-poc.local>';
}

function mjl_email_render($template, array $context)
{
	$template = (string) $template;
	$name = isset($context['recipient_name']) && trim((string) $context['recipient_name']) !== '' ? trim((string) $context['recipient_name']) : 'Madame, Monsieur';
	$link = isset($context['link']) ? mjl_email_absolute_url($context['link']) : '';
	$activityRef = isset($context['activity_ref']) ? (string) $context['activity_ref'] : '';
	$activityLabel = isset($context['activity_label']) ? (string) $context['activity_label'] : '';
	$projectRef = isset($context['project_ref']) ? (string) $context['project_ref'] : '';
	$conventionRef = isset($context['convention_ref']) ? (string) $context['convention_ref'] : '';
	$comment = isset($context['comment']) ? trim((string) $context['comment']) : '';

	$subject = '[MJL Financement] Notification';
	$title = 'Notification MJL';
	$message = 'Une information est disponible dans votre espace MJL Financement.';
	$action = 'Consulter l espace MJL';
	$security = 'Si vous n etes pas concerne par ce message, veuillez contacter l administrateur.';
	$details = array();

	if ($template === 'invitation') {
		$subject = '[MJL Financement] Invitation a votre espace';
		$title = 'Invitation a votre espace MJL';
		$message = 'Vous etes invite a acceder a l espace MJL Financement.';
		$action = 'Definir mon mot de passe';
		$security = 'Si vous n attendiez pas cette invitation, ignorez ce message et contactez l administrateur.';
	} elseif ($template === 'password_reset') {
		$subject = '[MJL Financement] Reinitialisation du mot de passe';
		$title = 'Reinitialisation du mot de passe';
		$message = 'Une demande de reinitialisation de mot de passe a ete recue pour votre acces MJL.';
		$action = 'Choisir un nouveau mot de passe';
		$security = 'Si vous n avez pas fait cette demande, ignorez ce message.';
	} elseif ($template === 'activity_submitted') {
		$subject = '[MJL Financement] Activite a examiner: '.$activityRef;
		$title = 'Activite a examiner';
		$message = 'Une activite liee a un projet a financement exterieur attend une decision.';
		$action = 'Examiner l activite';
		$details['Statut'] = 'Soumise';
	} elseif ($template === 'activity_correction_requested') {
		$subject = '[MJL Financement] Correction demandee: '.$activityRef;
		$title = 'Correction demandee';
		$message = 'Une correction est demandee sur une activite que vous avez soumise.';
		$action = 'Corriger l activite';
		$details['Statut'] = 'Correction demandee';
	} elseif ($template === 'activity_prevalidated') {
		$subject = '[MJL Financement] Activite prevalidee: '.$activityRef;
		$title = 'Activite prevalidee';
		$message = 'Une activite a ete prevalidee et attend la validation definitive.';
		$action = 'Examiner l activite';
		$details['Statut'] = 'Prevalidee';
	} elseif ($template === 'activity_validated') {
		$subject = '[MJL Financement] Activite validee: '.$activityRef;
		$title = 'Activite validee definitivement';
		$message = 'Une activite que vous avez soumise a ete validee definitivement.';
		$action = 'Consulter l activite';
		$details['Statut'] = 'Validee definitivement';
	} elseif ($template === 'activity_rejected') {
		$subject = '[MJL Financement] Activite rejetee: '.$activityRef;
		$title = 'Activite rejetee';
		$message = 'Une activite que vous avez soumise a ete rejetee.';
		$action = 'Consulter la decision';
		$details['Statut'] = 'Rejetee';
	} elseif ($template === 'alert_deadline_approaching') {
		$subject = '[MJL Financement] Echeance proche: '.$activityRef;
		$title = 'Echeance proche';
		$message = 'Une activite approche de son echeance et necessite une attention.';
		$action = 'Consulter l alerte';
	} elseif ($template === 'alert_overdue_activity') {
		$subject = '[MJL Financement] Activite en retard: '.$activityRef;
		$title = 'Activite en retard';
		$message = 'Une activite a depasse son echeance et necessite une action.';
		$action = 'Consulter l alerte';
	}

	if ($activityRef !== '') {
		$details['Activite'] = trim($activityRef.' - '.$activityLabel, ' -');
	}
	if ($projectRef !== '') {
		$details['Projet'] = $projectRef;
	}
	if ($conventionRef !== '') {
		$details['Convention'] = $conventionRef;
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
	$body .= "Message automatique - merci de ne pas repondre directement.";

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
		mjl_email_record_event('email_send_failed', $recipient, $audit, $template, 'delivery=mail;error='.mjl_email_context_value($mail->error));
		return array(-1, $mail->error);
	}

	mjl_email_record_event('email_sent', $recipient, $audit, $template, 'delivery=mail');
	return array(1, '');
}

function mjl_email_record_event($event, User $recipient, array $audit, $template, $extraContext = '')
{
	global $db;

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

	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_access_audit';
	$sql .= ' (entity, fk_user, fk_actor, event, event_date, context, date_creation, fk_user_creat)';
	$sql .= ' VALUES (';
	$sql .= mjl_email_entity();
	$sql .= ', '.((int) $recipient->id);
	$sql .= ', '.($actorId ? (int) $actorId : 'NULL');
	$sql .= ', '.mjl_email_string_sql($event);
	$sql .= ', '.mjl_email_now_sql();
	$sql .= ', '.mjl_email_string_sql($contextText);
	$sql .= ', '.mjl_email_now_sql();
	$sql .= ', '.($actorId ? (int) $actorId : 'NULL');
	$sql .= ')';
	$db->query($sql);
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
	mjl_email_store_e2e_const('MJL_EMAIL_E2E_LAST_'.strtoupper((string) $template).'_BODY', $rendered['body']);
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

function mjl_email_notify_activity_transition($activityId, $action, User $actor, $comment = '')
{
	if (!in_array($action, array('submitted', 'correction_requested', 'prevalidated', 'validated', 'final_validated', 'rejected'), true)) {
		return 0;
	}

	$row = mjl_email_fetch_activity_context((int) $activityId);
	if (empty($row)) {
		return -1;
	}

	$template = $action === 'final_validated' ? 'activity_validated' : 'activity_'.$action;
	$recipients = mjl_email_activity_recipients($row, $action, $actor);
	$sent = 0;
	foreach ($recipients as $recipient) {
		$result = mjl_email_send($recipient, $template, array(
			'activity_ref' => $row['ref'],
			'activity_label' => $row['label'],
			'project_ref' => $row['project_ref'],
			'convention_ref' => $row['convention_ref'],
			'comment' => $comment,
			'link' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']),
		), array(
			'actor_id' => (int) $actor->id,
			'object_type' => 'mjlfinancement_activity',
			'object_id' => (int) $row['rowid'],
			'object_ref' => $row['ref'],
		));
		if ($result[0] > 0) {
			$sent++;
		}
	}

	return $sent;
}

function mjl_email_fetch_activity_context($activityId)
{
	global $db;

	$sql = 'SELECT a.rowid, a.entity, a.ref, a.label, a.fk_user_creat, p.ref AS project_ref, c.ref AS convention_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention';
	$sql .= ' WHERE a.entity = '.mjl_email_entity().' AND a.rowid = '.((int) $activityId);
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_email_activity_recipients(array $activityRow, $action, User $actor)
{
	if ($action === 'submitted') {
		return mjl_email_activity_validator_recipients((int) $activityRow['fk_user_creat']);
	}
	if ($action === 'prevalidated') {
		return mjl_email_activity_validator_recipients((int) $activityRow['fk_user_creat']);
	}
	if (in_array($action, array('correction_requested', 'validated', 'final_validated', 'rejected'), true)) {
		$creator = new User($GLOBALS['db']);
		if ($creator->fetch((int) $activityRow['fk_user_creat']) > 0 && (int) $creator->statut === 1 && trim((string) $creator->email) !== '') {
			return array($creator);
		}
	}
	return array();
}

function mjl_email_activity_validator_recipients($excludeUserId)
{
	global $db;

	$sql = 'SELECT DISTINCT u.rowid, LOWER(u.email) AS dedupe_email';
	$sql .= ' FROM '.$db->prefix().'user u';
	$sql .= ' WHERE u.statut = 1 AND u.email IS NOT NULL AND u.email <> \'\'';
	$sql .= ' AND u.entity IN (0, '.mjl_email_entity().')';
	$sql .= ' AND u.rowid <> '.((int) $excludeUserId);
	$sql .= ' AND (';
	$sql .= ' EXISTS (SELECT 1 FROM '.$db->prefix().'user_rights ur INNER JOIN '.$db->prefix().'rights_def rd ON rd.id = ur.fk_id WHERE ur.fk_user = u.rowid AND ur.entity IN (0, '.mjl_email_entity().') AND rd.module = \'mjlfinancement\' AND rd.perms = \'activity\' AND rd.subperms = \'validate\')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'usergroup_user ugu INNER JOIN '.$db->prefix().'usergroup_rights ugr ON ugr.fk_usergroup = ugu.fk_usergroup AND ugr.entity IN (0, '.mjl_email_entity().') INNER JOIN '.$db->prefix().'rights_def rdg ON rdg.id = ugr.fk_id WHERE ugu.fk_user = u.rowid AND ugu.entity IN (0, '.mjl_email_entity().') AND rdg.module = \'mjlfinancement\' AND rdg.perms = \'activity\' AND rdg.subperms = \'validate\')';
	$sql .= ') ORDER BY u.rowid';
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}

	$recipients = array();
	$seenEmails = array();
	while ($obj = $db->fetch_object($resql)) {
		$email = trim((string) $obj->dedupe_email);
		if ($email === '' || isset($seenEmails[$email])) {
			continue;
		}
		$recipient = new User($db);
		if ($recipient->fetch((int) $obj->rowid) > 0) {
			$recipients[] = $recipient;
			$seenEmails[$email] = true;
		}
	}
	return $recipients;
}
