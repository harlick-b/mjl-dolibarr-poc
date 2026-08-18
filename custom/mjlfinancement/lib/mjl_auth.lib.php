<?php

require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_email.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

function mjl_auth_entity() { global $conf; return max(1, (int) $conf->entity); }
function mjl_auth_business_role_codes() { return array('AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'); }
function mjl_auth_now_sql() { global $db; return "'".$db->idate(dol_now())."'"; }
function mjl_auth_datetime_sql($timestamp) { global $db; return "'".$db->idate($timestamp)."'"; }
function mjl_auth_string_sql($value) { global $db; return $value === null || $value === '' ? 'NULL' : "'".$db->escape((string) $value)."'"; }

function mjl_auth_token_pair()
{
	return array(bin2hex(random_bytes(16)), rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '='));
}

function mjl_auth_token() { $pair = mjl_auth_token_pair(); return $pair[0].'.'.$pair[1]; }
function mjl_auth_token_hash($verifier) { return hash('sha256', (string) $verifier); }

function mjl_auth_user_by_email($email, $activeOnly = false)
{
	global $db;
	$email = strtolower(trim((string) $email));
	if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return null;
	$sql = 'SELECT rowid FROM '.$db->prefix()."user WHERE LOWER(email) = '".$db->escape($email)."' AND entity = ".mjl_auth_entity();
	if ($activeOnly) $sql .= ' AND statut = 1';
	$sql .= ' ORDER BY rowid ASC LIMIT 2';
	$resql = $db->query($sql);
	if (!$resql || $db->num_rows($resql) !== 1) return null;
	$row = $db->fetch_object($resql);
	$user = new User($db);
	return $user->fetch((int) $row->rowid) > 0 ? $user : null;
}

function mjl_auth_user_by_login($login)
{
	global $db;
	$login = trim((string) $login);
	if ($login === '') return null;
	$sql = 'SELECT rowid FROM '.$db->prefix().'user WHERE login = '.mjl_auth_string_sql($login).' AND entity = '.mjl_auth_entity().' ORDER BY rowid ASC LIMIT 2';
	$resql = $db->query($sql);
	if (!$resql || $db->num_rows($resql) !== 1) return null;
	$row = $db->fetch_object($resql);
	$user = new User($db);
	return $user->fetch((int) $row->rowid) > 0 ? $user : null;
}

function mjl_auth_system_user()
{
	global $db, $user;
	if (is_object($user) && !empty($user->id)) return $user;
	$actor = new User($db);
	return $actor->fetch(0, 'admin') > 0 ? $actor : new User($db);
}

function mjl_auth_actor_by_id($actorId)
{
	global $db;
	if ((int) $actorId <= 0) return null;
	$actor = new User($db);
	return $actor->fetch((int) $actorId) > 0 ? $actor : null;
}

function mjl_auth_record_event($event, $targetUserId = null, $actorUserId = null, $context = '')
{
	global $db;
	$failed = preg_match('/(?:failed|unknown|denied|bad_csrf|throttled|invalid)/', (string) $event) === 1;
	$payload = array(
		'entity' => mjl_auth_entity(),
		'object_type' => 'mjlfinancement_user',
		'object_id' => $targetUserId ? (int) $targetUserId : null,
		'actor' => mjl_auth_actor_by_id($actorUserId),
		'action' => (string) $event,
		'result' => $failed ? 'FAILED' : 'SUCCESS',
		'context' => is_array($context) ? $context : array('detail' => (string) $context),
	);
	if ($db->transaction_opened > 0) return mjl_audit_append_in_transaction($db, $payload);
	return $failed ? mjl_audit_record_outcome($db, $payload) : -1;
}

function mjl_auth_context_hash($value)
{
	$key = getDolGlobalString('MJL_AUTH_FINGERPRINT_KEY');
	if ($key === '') return '';
	return hash_hmac('sha256', strtolower(trim((string) $value)), $key);
}

function mjl_auth_client_ip_hash()
{
	return mjl_auth_context_hash(empty($_SERVER['REMOTE_ADDR']) ? 'cli' : $_SERVER['REMOTE_ADDR']);
}

function mjl_auth_e2e_context_suffix() { return mjl_auth_e2e_tokens_enabled() ? ';delivery=e2e' : ''; }

function mjl_auth_named_lock($name, $timeout = 2)
{
	global $db;
	$name = substr('mjl_auth_'.mjl_auth_entity().'_'.preg_replace('/[^a-z0-9_-]/i', '', (string) $name), 0, 64);
	$resql = $db->query('SELECT GET_LOCK('.mjl_auth_string_sql($name).', '.((int) $timeout).') AS locked');
	$row = $resql ? $db->fetch_object($resql) : null;
	return $row && (int) $row->locked === 1 ? $name : '';
}

function mjl_auth_release_named_lock($name)
{
	global $db;
	if ($name !== '') $db->query('SELECT RELEASE_LOCK('.mjl_auth_string_sql($name).')');
}

function mjl_auth_live_credential_max_id($table, array $userIds)
{
	global $db;
	if (!in_array($table, array('mjlfinancement_invitation', 'mjlfinancement_password_reset'), true)) return -1;
	$userIds = array_values(array_unique(array_filter(array_map('intval', $userIds))));
	if (empty($userIds)) return 0;
	$resql = $db->query('SELECT COALESCE(MAX(rowid),0) AS rowid FROM '.$db->prefix().$table.' WHERE entity='.mjl_auth_entity().' AND fk_user IN ('.implode(',', $userIds).") AND status IN ('pending_send','sent')");
	$row = $resql ? $db->fetch_object($resql) : null;
	return $row ? (int) $row->rowid : -1;
}

function mjl_auth_disposable_lock_barrier()
{
	global $db;
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1') return;
	$seconds = (int) getDolGlobalString('MJL_AUTH_E2E_LOCK_HOLD_SECONDS');
	if ($seconds > 0 && $seconds <= 2) $db->query('SELECT SLEEP('.$seconds.')');
}

function mjl_auth_identity_locks($login, $email)
{
	$identities = array(
		'email_'.hash('sha256', strtolower(trim((string) $email))),
		'login_'.hash('sha256', strtolower(trim((string) $login))),
	);
	sort($identities, SORT_STRING);
	$locks = array();
	foreach ($identities as $identity) {
		$lock = mjl_auth_named_lock($identity, 5);
		if ($lock === '') {
			foreach (array_reverse($locks) as $held) mjl_auth_release_named_lock($held);
			return array();
		}
		$locks[] = $lock;
	}
	return $locks;
}

function mjl_auth_absolute_url($relativeUrl) { return mjl_email_absolute_url($relativeUrl); }
function mjl_auth_mail_from() { return mjl_email_mail_from(); }

function mjl_auth_send_link_email(User $target, $type, $link)
{
	return mjl_email_send($target, $type === 'invitation' ? 'invitation' : 'password_reset', array('link' => $link, 'auth_link_type' => $type), array('object_type' => 'mjlfinancement_auth', 'object_id' => (int) $target->id));
}

function mjl_auth_validate_identity_input(array $input)
{
	$login = trim(isset($input['login']) ? $input['login'] : '');
	$firstname = trim(isset($input['firstname']) ? $input['firstname'] : '');
	$lastname = trim(isset($input['lastname']) ? $input['lastname'] : '');
	$email = strtolower(trim(isset($input['email']) ? $input['email'] : ''));
	$role = isset($input['role_code']) ? (string) $input['role_code'] : '';
	if (!preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $login)) return array(false, 'Identifiant invalide.');
	if ($firstname === '' || $lastname === '') return array(false, 'Le prénom et le nom sont obligatoires.');
	if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return array(false, 'Adresse e-mail invalide.');
	if (!in_array($role, mjl_auth_business_role_codes(), true)) return array(false, 'Rôle métier invalide.');
	return array(array('login' => $login, 'firstname' => $firstname, 'lastname' => $lastname, 'email' => $email, 'role_code' => $role), '');
}

function mjl_auth_issue_invitation(array $input, User $actor)
{
	global $db;
	list($data, $error) = mjl_auth_validate_identity_input($input);
	if ($data === false || !mjl_scope_is_platform_admin($actor, mjl_auth_entity())) return array('', $error !== '' ? $error : 'Action interdite.', 0);
	if (getDolGlobalString('MJL_AUTH_FINGERPRINT_KEY') === '') return array('', 'Configuration de sécurité indisponible.', 0);
	$beforeLogin = mjl_auth_user_by_login($data['login']);
	$beforeEmail = mjl_auth_user_by_email($data['email']);
	$beforeIds = array_values(array_unique(array_filter(array($beforeLogin ? (int) $beforeLogin->id : 0, $beforeEmail ? (int) $beforeEmail->id : 0))));
	$beforeInvitationId = mjl_auth_live_credential_max_id('mjlfinancement_invitation', $beforeIds);
	if ($beforeInvitationId < 0) return array('', 'Configuration de sécurité indisponible.', 0);
	$locks = mjl_auth_identity_locks($data['login'], $data['email']);
	if (empty($locks)) return array('', 'Une invitation concurrente est déjà en cours.', 0);
	mjl_auth_disposable_lock_barrier();
	$target = null;
	$link = '';
	try {
		$currentLogin = mjl_auth_user_by_login($data['login']);
		$currentEmail = mjl_auth_user_by_email($data['email']);
		$currentIds = array_values(array_unique(array_filter(array($currentLogin ? (int) $currentLogin->id : 0, $currentEmail ? (int) $currentEmail->id : 0))));
		$currentInvitationId = mjl_auth_live_credential_max_id('mjlfinancement_invitation', $currentIds);
		if ($currentInvitationId < 0) throw new RuntimeException('Configuration de sécurité indisponible.');
		if ((empty($beforeIds) && !empty($currentIds)) || $currentInvitationId > $beforeInvitationId) throw new RuntimeException('Une invitation concurrente est déjà en cours.');
		$db->begin('mjl issue invitation');
		$byLogin = mjl_auth_user_by_login($data['login']);
		$byEmail = mjl_auth_user_by_email($data['email']);
		if ($byLogin && $byEmail && (int) $byLogin->id !== (int) $byEmail->id) throw new RuntimeException('Cette adresse e-mail est déjà utilisée.');
		$target = $byLogin ?: $byEmail;
		if ($target && (!empty($target->admin) || (int) $target->statut === 1 || (int) $target->entity !== mjl_auth_entity())) throw new RuntimeException('Cet utilisateur ne peut pas être invité.');
		if (!$target) {
			$target = new User($db);
			$target->login = $data['login']; $target->entity = mjl_auth_entity(); $target->admin = 0; $target->statut = 0;
			$target->firstname = $data['firstname']; $target->lastname = $data['lastname']; $target->email = $data['email'];
			if ($target->create($actor, 1) <= 0) throw new RuntimeException($target->error ?: 'Création utilisateur impossible.');
		} else {
			$target->firstname = $data['firstname']; $target->lastname = $data['lastname']; $target->email = $data['email']; $target->statut = 0; $target->status = 0;
			if ($target->update($actor, 1, 1, 1, 1) < 0) throw new RuntimeException($target->error ?: 'Mise à jour utilisateur impossible.');
		}
		$sql = 'UPDATE '.$db->prefix().'user SET statut=0, admin=0 WHERE rowid='.((int) $target->id).' AND entity='.mjl_auth_entity().' AND admin=0';
		if (!$db->query($sql)) throw new RuntimeException($db->lasterror());
		$target->statut = 0; $target->status = 0; $target->admin = 0;
		if (mjl_scope_assign_access_profile((int) $target->id, $data['role_code'], $actor, mjl_auth_entity(), 'invitation', 'Invitation administrateur')[0] < 0) throw new RuntimeException('Attribution du rôle impossible.');
		$sql = 'UPDATE '.$db->prefix()."mjlfinancement_invitation SET status='revoked', token_hash=NULL, date_revoked=".mjl_auth_now_sql().', fk_user_revoked='.((int) $actor->id).' WHERE entity='.mjl_auth_entity().' AND fk_user='.((int) $target->id)." AND status IN ('pending_send','sent')";
		if (!$db->query($sql)) throw new RuntimeException($db->lasterror());
		list($selector, $verifier) = mjl_auth_token_pair();
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_invitation (entity,fk_user,role_code,status,token_selector,token_hash,date_expiry,fk_user_sender,date_creation,fk_user_creat) VALUES (';
		$sql .= mjl_auth_entity().','.((int) $target->id).','.mjl_auth_string_sql($data['role_code']).",'pending_send',".mjl_auth_string_sql($selector).','.mjl_auth_string_sql(mjl_auth_token_hash($verifier)).','.mjl_auth_datetime_sql(dol_now() + 604800).','.((int) $actor->id).','.mjl_auth_now_sql().','.((int) $actor->id).')';
		if (!$db->query($sql)) throw new RuntimeException($db->lasterror());
		$invitationId = (int) $db->last_insert_id($db->prefix().'mjlfinancement_invitation');
		if (mjl_auth_record_event('invitation_issued', (int) $target->id, (int) $actor->id, array('invitation_id' => $invitationId, 'role_code' => $data['role_code'])) < 1) throw new RuntimeException('Audit indisponible.');
		if (!$db->commit('mjl issue invitation')) throw new RuntimeException($db->lasterror());
		$link = '/custom/mjlfinancement/invitation.php?selector='.rawurlencode($selector).'#verifier='.rawurlencode($verifier);
		$mail = mjl_auth_send_link_email($target, 'invitation', $link);
		$db->begin('mjl invitation delivery');
		$status = $mail[0] > 0 ? 'sent' : 'send_failed';
		$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation SET status='.mjl_auth_string_sql($status).($status === 'sent' ? ', date_sent='.mjl_auth_now_sql() : ', token_hash=NULL, date_revoked='.mjl_auth_now_sql()).', fk_user_modif='.((int) $actor->id).' WHERE rowid='.$invitationId." AND status='pending_send'";
		$resql = $db->query($sql);
		if (!$resql || $db->affected_rows($resql) !== 1 || mjl_auth_record_event($status === 'sent' ? 'invitation_sent' : 'invitation_send_failed', (int) $target->id, (int) $actor->id, array('invitation_id' => $invitationId)) < 1 || !$db->commit('mjl invitation delivery')) {
			$db->rollback('mjl invitation delivery failed');
			return array('', 'Le résultat de l’envoi n’a pas pu être enregistré.', (int) $target->id);
		}
		return array($status === 'sent' && mjl_auth_e2e_tokens_enabled() ? $link : '', $mail[0] > 0 ? '' : 'Échec de l’envoi.', (int) $target->id);
	} catch (RuntimeException $exception) {
		$db->rollback('mjl issue invitation failed');
		return array('', $exception->getMessage(), $target ? (int) $target->id : 0);
	} finally {
		foreach (array_reverse($locks) as $lock) mjl_auth_release_named_lock($lock);
	}
}

function mjl_auth_fetch_invitation_by_selector($selector, $forUpdate = false)
{
	global $db;
	if (!preg_match('/^[a-f0-9]{32}$/', (string) $selector)) return null;
	$sql = 'SELECT rowid,fk_user,role_code,status,token_hash,date_expiry,date_accepted,date_revoked,fk_user_sender FROM '.$db->prefix().'mjlfinancement_invitation WHERE entity='.mjl_auth_entity().' AND token_selector='.mjl_auth_string_sql($selector).' LIMIT 1'.($forUpdate ? ' FOR UPDATE' : '');
	$resql = $db->query($sql);
	return $resql ? $db->fetch_object($resql) : null;
}

function mjl_auth_invitation_status($selector)
{
	$row = mjl_auth_fetch_invitation_by_selector($selector);
	if (!$row) return 'invalid';
	if ($row->status === 'accepted') return 'accepted';
	if ($row->status === 'revoked') return 'revoked';
	if ($row->status === 'send_failed') return 'send_failed';
	if ($row->status !== 'sent') return 'invalid';
	return strtotime($row->date_expiry) < dol_now() ? 'expired' : 'valid';
}

function mjl_auth_accept_invitation($selector, $verifier, $password, $passwordConfirm)
{
	global $db;
	if ($password !== $passwordConfirm || dol_strlen($password) < 10) return 'Les mots de passe doivent correspondre et contenir au moins 10 caractères.';
	$lock = mjl_auth_named_lock('accept_'.$selector, 5);
	if ($lock === '') return 'Cette invitation est déjà en cours de traitement.';
	mjl_auth_disposable_lock_barrier();
	try {
		$db->begin('mjl accept invitation');
		$row = mjl_auth_fetch_invitation_by_selector($selector, true);
		if (!$row || $row->status !== 'sent' || strtotime($row->date_expiry) < dol_now() || empty($row->token_hash) || !hash_equals((string) $row->token_hash, mjl_auth_token_hash($verifier))) throw new RuntimeException('Cette invitation est invalide ou expirée.');
		$target = new User($db);
		if ($target->fetch((int) $row->fk_user) <= 0 || !empty($target->admin) || (int) $target->statut !== 0 || (int) $target->entity !== mjl_auth_entity()) throw new RuntimeException('Ce compte ne peut pas être activé.');
		$role = mjl_scope_active_role_row((int) $target->id, mjl_auth_entity());
		if (empty($role) || (string) $role['role_code'] !== (string) $row->role_code || !in_array($row->role_code, mjl_auth_business_role_codes(), true)) throw new RuntimeException('Le rôle de cette invitation a changé. Demandez une nouvelle invitation.');
		$actor = mjl_auth_system_user();
		if ($target->setPassword($actor, $password, 0, 0) <= 0) throw new RuntimeException($target->error ?: 'Le mot de passe n’a pas pu être enregistré.');
		if (!$db->query('UPDATE '.$db->prefix().'user SET statut=1 WHERE rowid='.((int) $target->id).' AND entity='.mjl_auth_entity().' AND admin=0')) throw new RuntimeException($db->lasterror());
		$sql = 'UPDATE '.$db->prefix()."mjlfinancement_invitation SET status='accepted', token_hash=NULL, date_accepted=".mjl_auth_now_sql().', fk_user_modif='.((int) $target->id).' WHERE rowid='.((int) $row->rowid)." AND status='sent'";
		if (!$db->query($sql) || mjl_auth_record_event('invitation_accepted', (int) $target->id, (int) $target->id, array('role_code' => $row->role_code)) < 1) throw new RuntimeException('L’activation n’a pas pu être finalisée.');
		if (!$db->commit('mjl accept invitation')) throw new RuntimeException($db->lasterror());
		return '';
	} catch (RuntimeException $exception) {
		$db->rollback('mjl accept invitation failed');
		return $exception->getMessage();
	} finally {
		mjl_auth_release_named_lock($lock);
	}
}

function mjl_auth_revoke_invitation($invitationId, User $actor)
{
	global $db;
	if (!mjl_scope_is_platform_admin($actor, mjl_auth_entity())) return array(-1, 'Action interdite.');
	$db->begin('mjl revoke invitation');
	$sql = 'UPDATE '.$db->prefix()."mjlfinancement_invitation SET status='revoked', token_hash=NULL, date_revoked=".mjl_auth_now_sql().', fk_user_revoked='.((int) $actor->id).', fk_user_modif='.((int) $actor->id).' WHERE entity='.mjl_auth_entity().' AND rowid='.((int) $invitationId)." AND status IN ('pending_send','sent')";
	$resql = $db->query($sql);
	if (!$resql || $db->affected_rows($resql) !== 1 || mjl_auth_record_event('invitation_revoked', null, (int) $actor->id, array('invitation_id' => (int) $invitationId)) < 1 || !$db->commit('mjl revoke invitation')) {
		$db->rollback('mjl revoke invitation failed');
		return array(-1, 'Cette invitation ne peut pas être révoquée.');
	}
	return array(1, 'Invitation révoquée.');
}

function mjl_auth_reset_throttled($email)
{
	global $db;
	$emailHash = mjl_auth_context_hash($email); $ipHash = mjl_auth_client_ip_hash();
	if ($emailHash === '' || $ipHash === '') return true;
	$since = $db->idate(dol_now() - 900);
	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix()."mjlfinancement_audit_event WHERE entity=".mjl_auth_entity()." AND action LIKE 'password_reset_%' AND event_date >= '".$db->escape($since)."' AND (context_json LIKE '%".$db->escape($emailHash)."%' OR context_json LIKE '%".$db->escape($ipHash)."%')";
	$resql = $db->query($sql); $row = $resql ? $db->fetch_object($resql) : null;
	return !$row || (int) $row->nb >= 5;
}

function mjl_auth_create_password_reset($email, $actorUserId = null)
{
	global $db;
	$email = strtolower(trim((string) $email)); $emailHash = mjl_auth_context_hash($email); $ipHash = mjl_auth_client_ip_hash();
	$target = filter_var($email, FILTER_VALIDATE_EMAIL) ? mjl_auth_user_by_email($email, true) : null;
	if (!$target || mjl_auth_reset_throttled($email)) {
		mjl_auth_record_event($target ? 'password_reset_throttled' : 'password_reset_unknown', $target ? (int) $target->id : null, $actorUserId, array('email_fingerprint' => $emailHash, 'ip_fingerprint' => $ipHash));
		return null;
	}
	$role = mjl_scope_effective_role_code($target, mjl_auth_entity());
	if ($role === '' || (!in_array($role, mjl_auth_business_role_codes(), true) && $role !== 'ADMIN_PLATEFORME')) return null;
	$beforeResetId = mjl_auth_live_credential_max_id('mjlfinancement_password_reset', array((int) $target->id));
	if ($beforeResetId < 0) return null;
	$lock = mjl_auth_named_lock('reset_'.$target->id, 5); if ($lock === '') return null;
	mjl_auth_disposable_lock_barrier();
	try {
		$currentResetId = mjl_auth_live_credential_max_id('mjlfinancement_password_reset', array((int) $target->id));
		if ($currentResetId < 0 || $currentResetId > $beforeResetId) return null;
		$db->begin('mjl request reset');
		if (!$db->query('UPDATE '.$db->prefix()."mjlfinancement_password_reset SET status='revoked', token_hash=NULL, date_consumed=".mjl_auth_now_sql().' WHERE entity='.mjl_auth_entity().' AND fk_user='.((int) $target->id)." AND status IN ('pending_send','sent')")) throw new RuntimeException();
		list($selector, $verifier) = mjl_auth_token_pair();
		$sql = 'INSERT INTO '.$db->prefix()."mjlfinancement_password_reset (entity,fk_user,status,token_selector,token_hash,date_expiry,date_creation,fk_user_creat) VALUES (".mjl_auth_entity().','.((int) $target->id).",'pending_send',".mjl_auth_string_sql($selector).','.mjl_auth_string_sql(mjl_auth_token_hash($verifier)).','.mjl_auth_datetime_sql(dol_now() + 3600).','.mjl_auth_now_sql().','.((int) $target->id).')';
		if (!$db->query($sql)) throw new RuntimeException();
		$id = (int) $db->last_insert_id($db->prefix().'mjlfinancement_password_reset');
		if (mjl_auth_record_event('password_reset_requested', (int) $target->id, $actorUserId, array('email_fingerprint' => $emailHash, 'ip_fingerprint' => $ipHash)) < 1 || !$db->commit('mjl request reset')) throw new RuntimeException();
		$link = '/user/passwordforgotten.php?setnewpassword=1&mjlselector='.rawurlencode($selector).'#verifier='.rawurlencode($verifier);
		$mail = mjl_auth_send_link_email($target, 'password_reset', $link);
		$db->begin('mjl reset delivery');
		$status = $mail[0] > 0 ? 'sent' : 'send_failed';
		$sql = 'UPDATE '.$db->prefix().'mjlfinancement_password_reset SET status='.mjl_auth_string_sql($status).($status === 'send_failed' ? ',token_hash=NULL,date_consumed='.mjl_auth_now_sql() : '').' WHERE rowid='.$id." AND status='pending_send'";
		if (!$db->query($sql) || mjl_auth_record_event($status === 'sent' ? 'password_reset_sent' : 'password_reset_send_failed', (int) $target->id, $actorUserId, array('reset_id' => $id)) < 1 || !$db->commit('mjl reset delivery')) { $db->rollback(); return null; }
		return $status === 'sent' && mjl_auth_e2e_tokens_enabled() ? $link : null;
	} catch (RuntimeException $exception) { $db->rollback(); return null; }
	finally { mjl_auth_release_named_lock($lock); }
}

function mjl_auth_fetch_reset_by_selector($selector, $forUpdate = false)
{
	global $db;
	if (!preg_match('/^[a-f0-9]{32}$/', (string) $selector)) return null;
	$sql = 'SELECT rowid,fk_user,status,token_hash,date_expiry,date_consumed FROM '.$db->prefix().'mjlfinancement_password_reset WHERE entity='.mjl_auth_entity().' AND token_selector='.mjl_auth_string_sql($selector).' LIMIT 1'.($forUpdate ? ' FOR UPDATE' : '');
	$resql = $db->query($sql); return $resql ? $db->fetch_object($resql) : null;
}

function mjl_auth_reset_status($selector)
{
	$row = mjl_auth_fetch_reset_by_selector($selector);
	return $row && $row->status === 'sent' && empty($row->date_consumed) && strtotime($row->date_expiry) >= dol_now() ? 'valid' : 'invalid';
}

function mjl_auth_consume_password_reset($selector, $verifier, $password, $passwordConfirm)
{
	global $db;
	if ($password !== $passwordConfirm || dol_strlen($password) < 10) return 'Les mots de passe doivent correspondre et contenir au moins 10 caractères.';
	$lock = mjl_auth_named_lock('consume_'.$selector, 5); if ($lock === '') return 'Ce lien est déjà en cours de traitement.';
	mjl_auth_disposable_lock_barrier();
	try {
		$db->begin('mjl consume reset');
		$row = mjl_auth_fetch_reset_by_selector($selector, true);
		if (!$row || $row->status !== 'sent' || !empty($row->date_consumed) || strtotime($row->date_expiry) < dol_now() || !hash_equals((string) $row->token_hash, mjl_auth_token_hash($verifier))) throw new RuntimeException('Ce lien de réinitialisation est invalide ou expiré.');
		$target = new User($db);
		if ($target->fetch((int) $row->fk_user) <= 0 || (int) $target->statut !== 1 || (int) $target->entity !== mjl_auth_entity() || mjl_scope_effective_role_code($target, mjl_auth_entity()) === '') throw new RuntimeException('Votre accès est désactivé.');
		if ($target->setPassword(mjl_auth_system_user(), $password, 0, 0) <= 0) throw new RuntimeException($target->error ?: 'Le mot de passe n’a pas pu être enregistré.');
		$sql = 'UPDATE '.$db->prefix()."mjlfinancement_password_reset SET status='consumed', token_hash=NULL, date_consumed=".mjl_auth_now_sql().', fk_user_modif='.((int) $target->id).' WHERE rowid='.((int) $row->rowid)." AND status='sent'";
		if (!$db->query($sql) || mjl_auth_record_event('password_reset_completed', (int) $target->id, (int) $target->id, array('reset_id' => (int) $row->rowid)) < 1 || !$db->commit('mjl consume reset')) throw new RuntimeException('La réinitialisation n’a pas pu être finalisée.');
		return '';
	} catch (RuntimeException $exception) { $db->rollback(); return $exception->getMessage(); }
	finally { mjl_auth_release_named_lock($lock); }
}

function mjl_auth_write_test_outbox($type, $userId, $link)
{
	if (!mjl_auth_e2e_tokens_enabled()) return false;
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') === '1' && getDolGlobalString('MJL_AUTH_E2E_FAIL_AUTH_OUTBOX') === '1') return false;
	$dir = DOL_DATA_ROOT.'/mjlfinancement/auth-test-outbox';
	if (!is_dir($dir)) dol_mkdir($dir);
	if (!is_writable($dir)) return false;
	$payload = json_encode(array('type' => $type, 'user_id' => (int) $userId, 'link' => $link, 'created_at' => date('c')), JSON_UNESCAPED_SLASHES);
	return file_put_contents($dir.'/latest-'.$type.'.json', $payload, LOCK_EX) !== false;
}

function mjl_auth_e2e_tokens_enabled()
{
	return getenv('MJL_DISPOSABLE_TEST_TENANT') === '1'
		&& getDolGlobalString('MJL_AUTH_E2E_EXPOSE_TOKENS') === '1';
}
