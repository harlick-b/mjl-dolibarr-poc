<?php

require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_email.lib.php';

function mjl_auth_entity()
{
	global $conf;

	$entity = (int) $conf->entity;
	return $entity > 0 ? $entity : 1;
}

function mjl_auth_token()
{
	return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function mjl_auth_token_hash($token)
{
	return hash('sha256', (string) $token);
}

function mjl_auth_now_sql()
{
	global $db;

	return "'".$db->idate(dol_now())."'";
}

function mjl_auth_datetime_sql($timestamp)
{
	global $db;

	return "'".$db->idate($timestamp)."'";
}

function mjl_auth_string_sql($value)
{
	global $db;

	if ($value === null || $value === '') {
		return 'NULL';
	}
	return "'".$db->escape((string) $value)."'";
}

function mjl_auth_user_by_email($email, $activeOnly = false)
{
	global $db;

	$email = trim((string) $email);
	if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
		return null;
	}

	$sql = 'SELECT rowid FROM '.$db->prefix().'user';
	$sql .= " WHERE email = '".$db->escape($email)."'";
	$sql .= ' AND entity IN (0, '.mjl_auth_entity().')';
	if ($activeOnly) {
		$sql .= ' AND statut = 1';
	}
	$sql .= ' ORDER BY entity DESC, rowid ASC';

	$resql = $db->query($sql);
	if (!$resql) {
		return null;
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		return null;
	}

	$user = new User($db);
	return $user->fetch((int) $obj->rowid) > 0 ? $user : null;
}

function mjl_auth_user_by_login($login)
{
	global $db;

	$login = trim((string) $login);
	if ($login === '') {
		return null;
	}

	$sql = 'SELECT rowid FROM '.$db->prefix().'user';
	$sql .= ' WHERE login = '.mjl_auth_string_sql($login);
	$sql .= ' AND entity IN (0, '.mjl_auth_entity().')';
	$sql .= ' ORDER BY entity DESC, rowid ASC';
	$resql = $db->query($sql);
	if (!$resql) {
		return null;
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		return null;
	}

	$user = new User($db);
	return $user->fetch((int) $obj->rowid) > 0 ? $user : null;
}

function mjl_auth_system_user()
{
	global $db, $user;

	if (is_object($user) && !empty($user->id)) {
		return $user;
	}

	$admin = new User($db);
	if ($admin->fetch(0, 'admin') > 0) {
		return $admin;
	}

	return new User($db);
}

function mjl_auth_record_event($event, $targetUserId = null, $actorUserId = null, $context = '')
{
	global $db;

	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_access_audit';
	$sql .= ' (entity, fk_user, fk_actor, event, event_date, context, date_creation, fk_user_creat)';
	$sql .= ' VALUES (';
	$sql .= mjl_auth_entity();
	$sql .= ', '.($targetUserId ? (int) $targetUserId : 'NULL');
	$sql .= ', '.($actorUserId ? (int) $actorUserId : 'NULL');
	$sql .= ', '.mjl_auth_string_sql($event);
	$sql .= ', '.mjl_auth_now_sql();
	$sql .= ', '.mjl_auth_string_sql($context);
	$sql .= ', '.mjl_auth_now_sql();
	$sql .= ', '.($actorUserId ? (int) $actorUserId : 'NULL');
	$sql .= ')';

	return $db->query($sql) ? 1 : -1;
}

function mjl_auth_context_hash($value)
{
	return hash('sha256', strtolower(trim((string) $value)));
}

function mjl_auth_client_ip_hash()
{
	$ip = empty($_SERVER['REMOTE_ADDR']) ? 'cli' : $_SERVER['REMOTE_ADDR'];
	return mjl_auth_context_hash($ip);
}

function mjl_auth_e2e_context_suffix()
{
	return mjl_auth_e2e_tokens_enabled() ? ';delivery=e2e' : '';
}

function mjl_auth_named_lock($name, $timeout = 2)
{
	global $db;

	$lockName = substr('mjl_auth_'.mjl_auth_entity().'_'.$name, 0, 64);
	$sql = 'SELECT GET_LOCK('.mjl_auth_string_sql($lockName).', '.((int) $timeout).') AS locked';
	$resql = $db->query($sql);
	if (!$resql) {
		return '';
	}
	$obj = $db->fetch_object($resql);
	return ($obj && (int) $obj->locked === 1) ? $lockName : '';
}

function mjl_auth_release_named_lock($lockName)
{
	global $db;

	if ($lockName === '') {
		return;
	}
	$db->query('SELECT RELEASE_LOCK('.mjl_auth_string_sql($lockName).')');
}

function mjl_auth_invitation_lock($invitationId)
{
	return mjl_auth_named_lock('invitation_'.((int) $invitationId), 2);
}

function mjl_auth_reset_throttled($email)
{
	global $db;

	$emailHash = mjl_auth_context_hash($email);
	$ipHash = mjl_auth_client_ip_hash();
	$since = $db->idate(dol_now() - 900);
	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_access_audit';
	$sql .= ' WHERE entity = '.mjl_auth_entity();
	$sql .= " AND event IN ('password_reset_requested', 'password_reset_unknown', 'password_reset_send_failed')";
	$sql .= " AND event_date >= '".$db->escape($since)."'";
	$sql .= " AND (context LIKE '%email_hash=".$db->escape($emailHash)."%' OR context LIKE '%ip_hash=".$db->escape($ipHash)."%')";
	$resql = $db->query($sql);
	if (!$resql) {
		return false;
	}
	$obj = $db->fetch_object($resql);
	return $obj && (int) $obj->nb >= 5;
}

function mjl_auth_absolute_url($relativeUrl)
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

function mjl_auth_mail_from()
{
	$from = getDolGlobalString('MAIN_MAIL_EMAIL_FROM');
	if ($from === '') {
		$from = getDolGlobalString('MAIN_INFO_SOCIETE_MAIL');
	}
	return $from !== '' ? $from : 'MJL Financement <noreply@mjl-poc.local>';
}

function mjl_auth_send_link_email(User $target, $type, $link)
{
	$template = $type === 'invitation' ? 'invitation' : 'password_reset';
	return mjl_email_send($target, $template, array(
		'link' => $link,
		'auth_link_type' => $type,
	), array(
		'object_type' => 'mjlfinancement_auth',
		'object_id' => (int) $target->id,
	));
}

function mjl_auth_create_password_reset($email, $actorUserId = null)
{
	global $db;

	$email = trim((string) $email);
	$emailHash = mjl_auth_context_hash($email);
	$ipHash = mjl_auth_client_ip_hash();
	if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
		mjl_auth_record_event('password_reset_unknown', null, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.mjl_auth_e2e_context_suffix());
		return null;
	}
	if (mjl_auth_reset_throttled($email)) {
		mjl_auth_record_event('password_reset_throttled', null, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.mjl_auth_e2e_context_suffix());
		return null;
	}
	$user = mjl_auth_user_by_email($email, true);
	if (!$user) {
		mjl_auth_record_event('password_reset_unknown', null, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.mjl_auth_e2e_context_suffix());
		return null;
	}

	$lockName = mjl_auth_named_lock('reset_user_'.((int) $user->id), 2);
	if ($lockName === '') {
		mjl_auth_record_event('password_reset_lock_failed', (int) $user->id, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.mjl_auth_e2e_context_suffix());
		return null;
	}

	$token = mjl_auth_token();
	$expires = dol_now() + 3600;
	try {
		$sql = 'UPDATE '.$db->prefix().'mjlfinancement_password_reset';
		$sql .= " SET status = 'consumed', date_consumed = ".mjl_auth_now_sql().', fk_user_modif = '.((int) $user->id);
		$sql .= ' WHERE entity = '.mjl_auth_entity().' AND fk_user = '.((int) $user->id);
		$sql .= " AND status IN ('pending_send', 'sent') AND date_consumed IS NULL";
		if (!$db->query($sql)) {
			mjl_auth_release_named_lock($lockName);
			return null;
		}

		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_password_reset';
		$sql .= ' (entity, fk_user, status, token_hash, date_expiry, date_creation, fk_user_creat)';
		$sql .= ' VALUES (';
		$sql .= mjl_auth_entity();
		$sql .= ', '.((int) $user->id);
		$sql .= ", 'pending_send'";
		$sql .= ', '.mjl_auth_string_sql(mjl_auth_token_hash($token));
		$sql .= ', '.mjl_auth_datetime_sql($expires);
		$sql .= ', '.mjl_auth_now_sql();
		$sql .= ', '.($actorUserId ? (int) $actorUserId : (int) $user->id);
		$sql .= ')';
		if (!$db->query($sql)) {
			mjl_auth_release_named_lock($lockName);
			return null;
		}
		$resetId = (int) $db->last_insert_id($db->prefix().'mjlfinancement_password_reset');

		$link = DOL_URL_ROOT.'/user/passwordforgotten.php?setnewpassword=1&mjlreset='.urlencode($token);
		if (mjl_auth_e2e_tokens_enabled()) {
			$mail = mjl_auth_send_link_email($user, 'password_reset', $link);
			if ($mail[0] < 0) {
				mjl_auth_fail_password_reset_send($resetId, (int) $user->id, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.';delivery=e2e;error=outbox');
				mjl_auth_release_named_lock($lockName);
				return null;
			}
			if (!mjl_auth_mark_password_reset_sent($resetId, (int) $user->id)) {
				mjl_auth_fail_password_reset_send($resetId, (int) $user->id, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.';delivery=e2e;error=status');
				mjl_auth_release_named_lock($lockName);
				return null;
			}
			mjl_auth_record_event('password_reset_requested', (int) $user->id, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.';delivery=e2e');
			mjl_auth_release_named_lock($lockName);
			return $link;
		}

		$mail = mjl_auth_send_link_email($user, 'password_reset', $link);
		if ($mail[0] < 0) {
			mjl_auth_fail_password_reset_send($resetId, (int) $user->id, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.';error='.$mail[1]);
			mjl_auth_release_named_lock($lockName);
			return null;
		}
		if (!mjl_auth_mark_password_reset_sent($resetId, (int) $user->id)) {
			mjl_auth_fail_password_reset_send($resetId, (int) $user->id, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.';error=status');
			mjl_auth_release_named_lock($lockName);
			return null;
		}

		mjl_auth_record_event('password_reset_requested', (int) $user->id, $actorUserId, 'email_hash='.$emailHash.';ip_hash='.$ipHash.';delivery=mail');
		mjl_auth_release_named_lock($lockName);
		return $link;
	} catch (Exception $e) {
		mjl_auth_release_named_lock($lockName);
		return null;
	}
}

function mjl_auth_mark_password_reset_sent($resetId, $userId)
{
	global $db;

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_password_reset';
	$sql .= " SET status = 'sent', fk_user_modif = ".((int) $userId);
	$sql .= ' WHERE rowid = '.((int) $resetId)." AND status = 'pending_send' AND date_consumed IS NULL";
	$resql = $db->query($sql);
	return $resql && $db->affected_rows($resql) === 1;
}

function mjl_auth_fail_password_reset_send($resetId, $userId, $actorUserId, $context)
{
	global $db;

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_password_reset';
	$sql .= " SET status = 'send_failed', token_hash = '', date_consumed = ".mjl_auth_now_sql().', fk_user_modif = '.((int) $userId);
	$sql .= ' WHERE rowid = '.((int) $resetId);
	$db->query($sql);
	mjl_auth_record_event('password_reset_send_failed', (int) $userId, $actorUserId, $context);
}

function mjl_auth_fetch_reset_by_token($token)
{
	global $db;

	$hash = mjl_auth_token_hash($token);
	$sql = 'SELECT rowid, fk_user, status, date_expiry, date_consumed FROM '.$db->prefix().'mjlfinancement_password_reset';
	$sql .= ' WHERE entity = '.mjl_auth_entity();
	$sql .= ' AND token_hash = '.mjl_auth_string_sql($hash);
	$sql .= ' ORDER BY rowid DESC';
	$resql = $db->query($sql);
	if (!$resql) {
		return null;
	}
	$obj = $db->fetch_object($resql);
	return $obj ?: null;
}

function mjl_auth_reset_status($token)
{
	if (!$token) {
		return 'invalid';
	}
	$row = mjl_auth_fetch_reset_by_token($token);
	if (!$row) {
		return 'invalid';
	}
	if (!empty($row->date_consumed)) {
		return 'used';
	}
	if ($row->status !== 'sent') {
		return 'invalid';
	}
	if (strtotime($row->date_expiry) < dol_now()) {
		return 'expired';
	}
	return 'valid';
}

function mjl_auth_consume_password_reset($token, $password, $passwordConfirm)
{
	global $db, $user;

	if ($password === '' || $password !== $passwordConfirm) {
		return 'Les mots de passe saisis ne correspondent pas.';
	}
	if (strlen($password) < 10) {
		return 'Le mot de passe doit contenir au moins 10 caracteres.';
	}

	$row = mjl_auth_fetch_reset_by_token($token);
	if (!$row || mjl_auth_reset_status($token) !== 'valid') {
		return 'Ce lien de reinitialisation est invalide ou expire.';
	}

	$target = new User($db);
	if ($target->fetch((int) $row->fk_user) <= 0 || (int) $target->statut !== 1) {
		return 'Votre acces est desactive. Veuillez contacter l administrateur.';
	}

	$actor = mjl_auth_system_user();
	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_password_reset';
	$sql .= " SET status = 'consumed', date_consumed = ".mjl_auth_now_sql().', fk_user_modif = '.((int) $target->id);
	$sql .= ' WHERE rowid = '.((int) $row->rowid)." AND status = 'sent' AND date_consumed IS NULL AND date_expiry >= ".mjl_auth_now_sql();
	$resql = $db->query($sql);
	if (!$resql || $db->affected_rows($resql) !== 1) {
		return 'Ce lien de reinitialisation est invalide ou expire.';
	}

	$result = $target->setPassword($actor, $password, 0, 0);
	if (is_int($result) && $result < 0) {
		mjl_auth_record_event('password_reset_update_failed', (int) $target->id, (int) $target->id, $target->error);
		return 'Le mot de passe n a pas pu etre mis a jour. Veuillez demander un nouveau lien.';
	}

	mjl_auth_record_event('password_reset_completed', (int) $target->id, (int) $target->id);

	return '';
}

function mjl_auth_create_or_update_user($login, $firstname, $lastname, $email, $groupId, User $actor)
{
	global $db;

	$login = trim((string) $login);
	$firstname = trim((string) $firstname);
	$lastname = trim((string) $lastname);
	$email = trim((string) $email);
	$groupId = (int) $groupId;

	if ($login === '' || !preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $login)) {
		return array(-1, 'Identifiant invalide.');
	}
	if ($firstname === '' || $lastname === '') {
		return array(-1, 'Le prenom et le nom sont obligatoires.');
	}
	if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
		return array(-1, 'Adresse email invalide.');
	}
	if (!array_key_exists($groupId, mjl_auth_groups())) {
		return array(-1, 'Profil MJL invalide.');
	}

	$emailOwner = mjl_auth_user_by_email($email, false);
	$target = mjl_auth_user_by_login($login);
	if ($emailOwner && (!$target || (int) $emailOwner->id !== (int) $target->id)) {
		return array(-1, 'Cette adresse email est deja utilisee.');
	}
	if (!$target) {
		$target = new User($db);
		$target->login = $login;
		$target->entity = mjl_auth_entity();
		$target->admin = 0;
		$target->statut = 0;
		$target->firstname = $firstname;
		$target->lastname = $lastname;
		$target->email = $email;
	} else {
		if ((int) $target->entity !== mjl_auth_entity() || !empty($target->admin) || (int) $target->statut === 1) {
			return array(-1, 'Cet identifiant correspond deja a un utilisateur existant.');
		}
		if (strcasecmp(trim((string) $target->email), $email) !== 0) {
			return array(-1, 'Cet identifiant existe deja avec une autre adresse email.');
		}
		if (!mjl_auth_user_has_reinvitable_invitation((int) $target->id)) {
			return array(-1, 'Cet identifiant existe deja et ne peut pas etre reinvite.');
		}
	}

	$db->begin('mjl auth user profile');
	if (empty($target->id)) {
			$target->admin = 0;
			$target->statut = 0;
			$target->firstname = $firstname;
			$target->lastname = $lastname;
		$target->email = $email;
		$result = $target->create($actor, 1);
		if ($result <= 0) {
			$db->rollback('mjl auth user create failed');
			return array(-1, $target->error);
		}
		$target->fetch($result);
	}

	$target->firstname = $firstname;
	$target->lastname = $lastname;
	$target->email = $email;
	$target->statut = 0;
	$target->status = 0;
	if ($target->update($actor, 1, 1, 1, 1) < 0) {
		$db->rollback('mjl auth user update failed');
		return array(-1, $target->error);
	}
	$sql = 'UPDATE '.$db->prefix().'user SET statut = 0 WHERE rowid = '.((int) $target->id).' AND entity = '.mjl_auth_entity().' AND admin = 0';
	if (!$db->query($sql)) {
		$db->rollback('mjl auth user deactivate failed');
		return array(-1, $db->lasterror());
	}
	$target->statut = 0;
	$target->status = 0;

	if ($groupId > 0) {
		$sql = 'DELETE FROM '.$db->prefix().'usergroup_user WHERE entity = '.mjl_auth_entity().' AND fk_user = '.((int) $target->id);
		$sql .= ' AND fk_usergroup IN (SELECT rowid FROM '.$db->prefix()."usergroup WHERE entity = ".mjl_auth_entity()." AND nom LIKE 'MJL POC - %')";
		if (!$db->query($sql)) {
			$db->rollback('mjl auth group cleanup failed');
			return array(-1, $db->lasterror());
		}
		$sql = 'INSERT INTO '.$db->prefix().'usergroup_user (entity, fk_user, fk_usergroup) VALUES ('.mjl_auth_entity().', '.((int) $target->id).', '.((int) $groupId).')';
		if (!$db->query($sql)) {
			$db->rollback('mjl auth group assign failed');
			return array(-1, $db->lasterror());
		}
	}

	if (!$db->commit('mjl auth user profile')) {
		return array(-1, $db->lasterror());
	}

	return array((int) $target->id, '');
}

function mjl_auth_user_has_reinvitable_invitation($userId)
{
	global $db;

	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_invitation';
	$sql .= ' WHERE entity = '.mjl_auth_entity();
	$sql .= ' AND fk_user = '.((int) $userId);
	$sql .= " AND (status IN ('sent', 'revoked', 'expired', 'send_failed') OR (status = 'accepting' AND tms < ".mjl_auth_datetime_sql(dol_now() - 900).'))';
	$sql .= ' ORDER BY rowid DESC LIMIT 1';
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_auth_create_invitation($targetUserId, User $actor)
{
	global $db;

	$token = mjl_auth_token();
	$expires = dol_now() + (7 * 24 * 3600);

	mjl_auth_reconcile_stale_invitations((int) $targetUserId);
	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation SET status = \'revoked\', date_revoked = '.mjl_auth_now_sql().', fk_user_revoked = '.((int) $actor->id);
	$sql .= ' WHERE entity = '.mjl_auth_entity().' AND fk_user = '.((int) $targetUserId)." AND status IN ('sent', 'pending_send')";
	$db->query($sql);

	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_invitation';
	$sql .= ' (entity, fk_user, status, token_hash, date_expiry, date_sent, fk_user_sender, date_creation, fk_user_creat)';
	$sql .= ' VALUES (';
	$sql .= mjl_auth_entity();
	$sql .= ', '.((int) $targetUserId);
	$sql .= ", 'pending_send'";
	$sql .= ', '.mjl_auth_string_sql(mjl_auth_token_hash($token));
	$sql .= ', '.mjl_auth_datetime_sql($expires);
	$sql .= ', NULL';
	$sql .= ', '.((int) $actor->id);
	$sql .= ', '.mjl_auth_now_sql();
	$sql .= ', '.((int) $actor->id);
	$sql .= ')';
	if (!$db->query($sql)) {
		return array('', $db->lasterror());
	}
	$invitationId = $db->last_insert_id($db->prefix().'mjlfinancement_invitation');

	$link = DOL_URL_ROOT.'/custom/mjlfinancement/invitation.php?invite='.urlencode($token);
	$target = new User($db);
	if ($target->fetch((int) $targetUserId) <= 0) {
		return array('', 'Utilisateur invite introuvable.');
	}
	if (mjl_auth_e2e_tokens_enabled()) {
		$mail = mjl_auth_send_link_email($target, 'invitation', $link);
		if ($mail[0] < 0) {
			mjl_auth_fail_invitation_send($invitationId, (int) $targetUserId, (int) $actor->id, 'delivery=e2e;error=outbox');
			return array('', 'Echec d envoi.');
		}
		if (!mjl_auth_mark_invitation_sent($invitationId, (int) $actor->id)) {
			mjl_auth_fail_invitation_send($invitationId, (int) $targetUserId, (int) $actor->id, 'delivery=e2e;error=status');
			return array('', 'Echec d envoi.');
		}
		mjl_auth_record_event('invitation_sent', (int) $targetUserId, (int) $actor->id, 'delivery=e2e');
		return array($link, '');
	}

	$mail = mjl_auth_send_link_email($target, 'invitation', $link);
	if ($mail[0] < 0) {
		mjl_auth_fail_invitation_send($invitationId, (int) $targetUserId, (int) $actor->id, 'error='.$mail[1]);
		return array('', 'Echec d envoi.');
	}
	if (!mjl_auth_mark_invitation_sent($invitationId, (int) $actor->id)) {
		mjl_auth_fail_invitation_send($invitationId, (int) $targetUserId, (int) $actor->id, 'error=status');
		return array('', 'Echec d envoi.');
	}

	mjl_auth_record_event('invitation_sent', (int) $targetUserId, (int) $actor->id, 'delivery=mail');
	return array($link, '');
}

function mjl_auth_mark_invitation_sent($invitationId, $actorId)
{
	global $db;

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
	$sql .= " SET status = 'sent', date_sent = ".mjl_auth_now_sql().', fk_user_modif = '.((int) $actorId);
	$sql .= ' WHERE rowid = '.((int) $invitationId)." AND status = 'pending_send'";
	$resql = $db->query($sql);
	return $resql && $db->affected_rows($resql) === 1;
}

function mjl_auth_fail_invitation_send($invitationId, $targetUserId, $actorId, $context)
{
	global $db;

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
	$sql .= " SET status = 'send_failed', token_hash = NULL, fk_user_modif = ".((int) $actorId);
	$sql .= ' WHERE rowid = '.((int) $invitationId);
	$db->query($sql);
	mjl_auth_record_event('invitation_send_failed', (int) $targetUserId, (int) $actorId, $context);
}

function mjl_auth_fetch_invitation_by_token($token)
{
	global $db;

	$sql = 'SELECT * FROM '.$db->prefix().'mjlfinancement_invitation';
	$sql .= ' WHERE entity = '.mjl_auth_entity();
	$sql .= ' AND token_hash = '.mjl_auth_string_sql(mjl_auth_token_hash($token));
	$sql .= ' ORDER BY rowid DESC';
	$resql = $db->query($sql);
	if (!$resql) {
		return null;
	}
	$obj = $db->fetch_object($resql);
	return $obj ?: null;
}

function mjl_auth_fetch_invitation_by_id($invitationId)
{
	global $db;

	$sql = 'SELECT * FROM '.$db->prefix().'mjlfinancement_invitation';
	$sql .= ' WHERE entity = '.mjl_auth_entity();
	$sql .= ' AND rowid = '.((int) $invitationId);
	$resql = $db->query($sql);
	if (!$resql) {
		return null;
	}
	$obj = $db->fetch_object($resql);
	return $obj ?: null;
}

function mjl_auth_invitation_status($token)
{
	$row = $token ? mjl_auth_fetch_invitation_by_token($token) : null;
	if (!$row) {
		return 'invalid';
	}
	if ($row->status === 'accepting') {
		mjl_auth_reconcile_invitation_claim($row);
		$row = mjl_auth_fetch_invitation_by_token($token);
		if (!$row) {
			return 'invalid';
		}
	}
	if ($row->status === 'accepted' || !empty($row->date_accepted)) {
		return 'accepted';
	}
	if ($row->status === 'revoked' || !empty($row->date_revoked)) {
		return 'revoked';
	}
	if ($row->status === 'send_failed') {
		return 'send_failed';
	}
	if ($row->status !== 'sent') {
		return 'invalid';
	}
	if (strtotime($row->date_expiry) < dol_now()) {
		return 'expired';
	}
	return 'valid';
}

function mjl_auth_reconcile_stale_invitations($targetUserId)
{
	global $db;

	$sql = 'SELECT * FROM '.$db->prefix().'mjlfinancement_invitation';
	$sql .= ' WHERE entity = '.mjl_auth_entity().' AND fk_user = '.((int) $targetUserId);
	$sql .= " AND status = 'accepting' AND tms < ".mjl_auth_datetime_sql(dol_now() - 900);
	$resql = $db->query($sql);
	if (!$resql) {
		return;
	}
	while ($row = $db->fetch_object($resql)) {
		mjl_auth_reconcile_invitation_claim($row);
	}
}

function mjl_auth_reconcile_invitation_claim($row)
{
	global $db;

	if (!$row || $row->status !== 'accepting' || strtotime($row->tms) >= dol_now() - 900) {
		return;
	}
	$target = new User($db);
	if ($target->fetch((int) $row->fk_user) <= 0 || !empty($target->admin) || (int) $target->entity !== mjl_auth_entity()) {
		$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
		$sql .= " SET status = 'revoked', date_revoked = ".mjl_auth_now_sql().', fk_user_modif = '.((int) $row->fk_user_sender);
		$sql .= ' WHERE rowid = '.((int) $row->rowid)." AND status = 'accepting'";
		$db->query($sql);
		return;
	}
	if ((int) $target->statut === 1) {
		$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
		$sql .= " SET status = 'accepted', date_accepted = COALESCE(date_accepted, ".mjl_auth_now_sql().'), fk_user_modif = '.((int) $target->id);
		$sql .= ' WHERE rowid = '.((int) $row->rowid)." AND status = 'accepting'";
		$db->query($sql);
		return;
	}
	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
	$sql .= " SET status = 'sent', fk_user_modif = ".((int) $target->id);
	$sql .= ' WHERE rowid = '.((int) $row->rowid)." AND status = 'accepting'";
	$db->query($sql);
}

function mjl_auth_revoke_invitation($invitationId, User $actor)
{
	global $db;

	$row = mjl_auth_fetch_invitation_by_id($invitationId);
	if (!$row) {
		return array(-1, 'Invitation introuvable.');
	}
	$lockName = mjl_auth_invitation_lock((int) $row->rowid);
	if ($lockName === '') {
		return array(-1, 'Invitation en cours de traitement. Veuillez reessayer.');
	}

	$row = mjl_auth_fetch_invitation_by_id($invitationId);
	if (!$row) {
		mjl_auth_release_named_lock($lockName);
		return array(-1, 'Invitation introuvable.');
	}
	if (!empty($row->date_accepted) || $row->status === 'accepted') {
		mjl_auth_release_named_lock($lockName);
		return array(0, 'Cette invitation est deja acceptee.');
	}
	if (!empty($row->date_revoked) || $row->status === 'revoked') {
		mjl_auth_release_named_lock($lockName);
		return array(0, 'Cette invitation est deja revoquee.');
	}
	if ($row->status === 'accepting') {
		mjl_auth_release_named_lock($lockName);
		return array(0, 'Cette invitation est en cours d acceptation.');
	}
	if (!in_array($row->status, array('sent', 'pending_send'), true)) {
		mjl_auth_release_named_lock($lockName);
		return array(0, 'Cette invitation ne peut pas etre revoquee dans son etat actuel.');
	}

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
	$sql .= " SET status = 'revoked', date_revoked = ".mjl_auth_now_sql().', fk_user_revoked = '.((int) $actor->id);
	$sql .= ', fk_user_modif = '.((int) $actor->id);
	$sql .= ' WHERE rowid = '.((int) $row->rowid);
	$sql .= " AND status IN ('sent', 'pending_send') AND date_accepted IS NULL";
	$resql = $db->query($sql);
	if (!$resql || $db->affected_rows($resql) !== 1) {
		mjl_auth_release_named_lock($lockName);
		return array(-1, 'L invitation n a pas pu etre revoquee.');
	}

	mjl_auth_record_event('invitation_revoked', (int) $row->fk_user, (int) $actor->id, 'invitation='.((int) $row->rowid));
	mjl_auth_release_named_lock($lockName);
	return array(1, 'Invitation revoquee.');
}

function mjl_auth_accept_invitation($token, $password, $passwordConfirm)
{
	global $db;

	if ($password === '' || $password !== $passwordConfirm) {
		return 'Les mots de passe saisis ne correspondent pas.';
	}
	if (strlen($password) < 10) {
		return 'Le mot de passe doit contenir au moins 10 caracteres.';
	}

	$row = mjl_auth_fetch_invitation_by_token($token);
	if (!$row) {
		return 'Cette invitation est invalide ou expiree.';
	}
	$lockName = mjl_auth_invitation_lock((int) $row->rowid);
	if ($lockName === '') {
		return 'Cette invitation est en cours de traitement. Veuillez reessayer.';
	}
	$row = mjl_auth_fetch_invitation_by_token($token);
	if (!$row || mjl_auth_invitation_status($token) !== 'valid') {
		mjl_auth_release_named_lock($lockName);
		return 'Cette invitation est invalide ou expiree.';
	}
	$row = mjl_auth_fetch_invitation_by_token($token);
	if (!$row || !empty($row->date_revoked) || $row->status === 'revoked') {
		mjl_auth_release_named_lock($lockName);
		return 'Cette invitation est invalide ou expiree.';
	}

	$target = new User($db);
	if ($target->fetch((int) $row->fk_user) <= 0) {
		mjl_auth_release_named_lock($lockName);
		return 'Cette invitation est invalide.';
	}
	if (!empty($target->admin) || (int) $target->statut === 1 || (int) $target->entity !== mjl_auth_entity()) {
		mjl_auth_release_named_lock($lockName);
		return 'Cette invitation est invalide.';
	}
	$actor = mjl_auth_system_user();
	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
	$sql .= " SET status = 'accepting', fk_user_modif = ".((int) $target->id);
	$sql .= ' WHERE rowid = '.((int) $row->rowid)." AND status = 'sent' AND date_accepted IS NULL AND date_revoked IS NULL AND date_expiry >= ".mjl_auth_now_sql();
	$resql = $db->query($sql);
	if (!$resql || $db->affected_rows($resql) !== 1) {
		mjl_auth_release_named_lock($lockName);
		return 'Cette invitation est invalide ou expiree.';
	}

	$result = $target->setPassword($actor, $password, 0, 0);
	if (is_int($result) && $result < 0) {
		$db->query('UPDATE '.$db->prefix()."mjlfinancement_invitation SET status = 'sent', fk_user_modif = ".((int) $target->id).' WHERE rowid = '.((int) $row->rowid)." AND status = 'accepting'");
		mjl_auth_release_named_lock($lockName);
		return $target->error ?: 'Le mot de passe n a pas pu etre defini.';
	}

	$target->statut = 1;
	$target->status = 1;
	if ($target->update($actor, 1, 1, 1, 1) < 0) {
		mjl_auth_revoke_failed_acceptance($row, $target, $actor, 'activation_failed');
		mjl_auth_release_named_lock($lockName);
		return 'Votre acces n a pas pu etre active. Veuillez contacter l administrateur.';
	}
	$sql = 'UPDATE '.$db->prefix().'user SET statut = 1 WHERE rowid = '.((int) $target->id).' AND entity = '.mjl_auth_entity().' AND admin = 0';
	if (!$db->query($sql)) {
		mjl_auth_revoke_failed_acceptance($row, $target, $actor, 'activation_failed');
		mjl_auth_release_named_lock($lockName);
		return 'Votre acces n a pas pu etre active. Veuillez contacter l administrateur.';
	}

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
	$sql .= " SET status = 'accepted', date_accepted = ".mjl_auth_now_sql().', fk_user_modif = '.((int) $target->id);
	$sql .= ' WHERE rowid = '.((int) $row->rowid)." AND status = 'accepting' AND date_accepted IS NULL AND date_revoked IS NULL";
	$resql = $db->query($sql);
	if (!$resql || $db->affected_rows($resql) < 1) {
		$current = mjl_auth_fetch_invitation_by_id((int) $row->rowid);
		if ($current && ($current->status === 'accepted' || !empty($current->date_accepted))) {
			mjl_auth_record_event('invitation_accepted', (int) $target->id, (int) $target->id, 'idempotent_finalization');
			mjl_auth_release_named_lock($lockName);
			return '';
		}
		if ($current && ($current->status === 'revoked' || !empty($current->date_revoked))) {
			mjl_auth_record_event('invitation_accept_failed', (int) $target->id, (int) $actor->id, 'finalization_conflict_revoked');
			mjl_auth_release_named_lock($lockName);
			return 'Votre acces est active, mais l invitation a ete revoquee pendant la finalisation. Veuillez contacter l administrateur.';
		}
		mjl_auth_record_event('invitation_accept_failed', (int) $target->id, (int) $actor->id, 'acceptance_update_failed_after_activation');
		mjl_auth_release_named_lock($lockName);
		return 'Votre acces est active, mais le statut de l invitation n a pas pu etre finalise. Veuillez contacter l administrateur.';
	}
	mjl_auth_record_event('invitation_accepted', (int) $target->id, (int) $target->id);
	mjl_auth_release_named_lock($lockName);

	return '';
}

function mjl_auth_revoke_failed_acceptance($row, User $target, User $actor, $reason)
{
	global $db;

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation';
	$sql .= " SET status = 'revoked', date_revoked = ".mjl_auth_now_sql().', fk_user_revoked = '.((int) $actor->id);
	$sql .= ', fk_user_modif = '.((int) $actor->id);
	$sql .= ' WHERE rowid = '.((int) $row->rowid);
	$db->query($sql);
	mjl_auth_record_event('invitation_accept_failed', (int) $target->id, (int) $actor->id, $reason);
}

function mjl_auth_write_test_outbox($type, $userId, $link)
{
	global $db;

	if (!mjl_auth_e2e_tokens_enabled()) {
		return false;
	}

	$constName = 'MJL_AUTH_E2E_LAST_'.strtoupper((string) $type).'_LINK';
	$sql = 'DELETE FROM '.$db->prefix().'const WHERE name = '.mjl_auth_string_sql($constName).' AND entity = '.mjl_auth_entity();
	if (!$db->query($sql)) {
		return false;
	}
	$sql = 'INSERT INTO '.$db->prefix().'const (name, entity, value, type, visible, note) VALUES (';
	$sql .= mjl_auth_string_sql($constName).', '.mjl_auth_entity().', '.mjl_auth_string_sql($link).", 'chaine', 0, 'MJL E2E test link')";
	if (!$db->query($sql)) {
		return false;
	}

	$dir = DOL_DATA_ROOT.'/mjlfinancement/auth-test-outbox';
	if (!is_dir($dir)) {
		dol_mkdir($dir);
	}
	if (!is_writable($dir)) {
		return false;
	}
	$payload = json_encode(array(
		'type' => $type,
		'user_id' => (int) $userId,
		'link' => $link,
		'created_at' => date('c'),
	), JSON_UNESCAPED_SLASHES);
	return file_put_contents($dir.'/latest-'.$type.'.json', $payload) !== false;
}

function mjl_auth_e2e_tokens_enabled()
{
	global $db;

	$sql = 'SELECT value FROM '.$db->prefix().'const WHERE name = \'MJL_AUTH_E2E_EXPOSE_TOKENS\'';
	$sql .= ' AND entity IN (0, '.mjl_auth_entity().') ORDER BY entity DESC, rowid DESC LIMIT 1';
	$resql = $db->query($sql);
	if (!$resql) {
		return false;
	}
	$obj = $db->fetch_object($resql);
	return $obj && (string) $obj->value === '1';
}

function mjl_auth_groups()
{
	global $db;

	$groups = array();
	$sql = 'SELECT rowid, nom FROM '.$db->prefix().'usergroup WHERE entity = '.mjl_auth_entity()." AND nom LIKE 'MJL POC - %' ORDER BY nom";
	$resql = $db->query($sql);
	if (!$resql) {
		return $groups;
	}
	while ($obj = $db->fetch_object($resql)) {
		$groups[(int) $obj->rowid] = $obj->nom;
	}
	return $groups;
}
