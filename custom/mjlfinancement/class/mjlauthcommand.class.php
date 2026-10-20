<?php

/** Cohesive owner of MJL invitation, reset, and OTP workflows. */
class MjlAuthCommand
{
	private $db;
	private $conf;
	private $entity;
	private $fingerprintReady;
	private $failSessionCompletion;
	private $connectionUsable = true;

	public function __construct($db, $conf, $entity, $fingerprintReady, $failSessionCompletion)
	{
		$this->db = $db;
		$this->conf = $conf;
		$this->entity = max(1, (int) $entity);
		$this->fingerprintReady = (bool) $fingerprintReady;
		$this->failSessionCompletion = (bool) $failSessionCompletion;
	}

	public function issueInvitation(array $input, User $actor)
	{
		$db = $this->db;
		list($data, $error) = mjl_auth_validate_identity_input($input);
		if ($data === false || !mjl_scope_is_platform_admin($actor, $this->entity)) return array('', $error !== '' ? $error : 'Action interdite.', 0);
		if (!$this->fingerprintReady) return array('', 'Configuration de sécurité indisponible.', 0);
		$beforeLogin = mjl_auth_user_by_login($data['login']);
		$beforeEmail = mjl_auth_user_by_email($data['email']);
		$beforeIds = array_values(array_unique(array_filter(array($beforeLogin ? (int) $beforeLogin->id : 0, $beforeEmail ? (int) $beforeEmail->id : 0))));
		$beforeInvitationId = mjl_auth_live_credential_max_id('mjlfinancement_invitation', $beforeIds);
		if ($beforeInvitationId < 0) return array('', 'Configuration de sécurité indisponible.', 0);
		$locks = $this->identityLocks($data['login'], $data['email']);
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
			if (!$this->beginTransaction('mjl issue invitation')) return array('', 'Configuration de sécurité indisponible.', 0);
			$byLogin = mjl_auth_user_by_login($data['login']);
			$byEmail = mjl_auth_user_by_email($data['email']);
			if ($byLogin && $byEmail && (int) $byLogin->id !== (int) $byEmail->id) throw new RuntimeException('Cette adresse e-mail est déjà utilisée.');
			$target = $byLogin ?: $byEmail;
			if ($target && (!empty($target->admin) || (int) $target->statut === 1 || (int) $target->entity !== $this->entity)) throw new RuntimeException('Cet utilisateur ne peut pas être invité.');
			if (!$target) {
				$target = new User($db);
				$target->login = $data['login']; $target->entity = $this->entity; $target->admin = 0; $target->statut = 0;
				$target->firstname = $data['firstname']; $target->lastname = $data['lastname']; $target->email = $data['email'];
				if ($target->create($actor, 1) <= 0) throw new RuntimeException($target->error ?: 'Création utilisateur impossible.');
			} else {
				$target->firstname = $data['firstname']; $target->lastname = $data['lastname']; $target->email = $data['email']; $target->statut = 0; $target->status = 0;
				if ($target->update($actor, 1, 1, 1, 1) < 0) throw new RuntimeException($target->error ?: 'Mise à jour utilisateur impossible.');
			}
			$sql = 'UPDATE '.$db->prefix().'user SET statut=0, admin=0 WHERE rowid='.((int) $target->id).' AND entity='.$this->entity.' AND admin=0';
			if (!$db->query($sql)) throw new RuntimeException($db->lasterror());
			$target->statut = 0; $target->status = 0; $target->admin = 0;
			$accessCommand = new MjlAccessCommand($db, $this->entity);
			if ($accessCommand->assignProfileInTransaction((int) $target->id, $data['role_code'], $actor, 'invitation', 'Invitation administrateur')[0] < 0) throw new RuntimeException('Attribution du rôle impossible.');
			$sql = 'UPDATE '.$db->prefix()."mjlfinancement_invitation SET status='revoked', token_hash=NULL, date_revoked=".mjl_auth_now_sql().', fk_user_revoked='.((int) $actor->id).' WHERE entity='.$this->entity.' AND fk_user='.((int) $target->id)." AND status IN ('pending_send','sent')";
			if (!$db->query($sql)) throw new RuntimeException($db->lasterror());
			list($selector, $verifier) = mjl_auth_token_pair();
			$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_invitation (entity,fk_user,role_code,status,token_selector,token_hash,date_expiry,fk_user_sender,date_creation,fk_user_creat) VALUES (';
			$sql .= $this->entity.','.((int) $target->id).','.mjl_auth_string_sql($data['role_code']).",'pending_send',".mjl_auth_string_sql($selector).','.mjl_auth_string_sql(mjl_auth_token_hash($verifier)).','.mjl_auth_datetime_sql(dol_now() + 604800).','.((int) $actor->id).','.mjl_auth_now_sql().','.((int) $actor->id).')';
			if (!$db->query($sql)) throw new RuntimeException($db->lasterror());
			$invitationId = (int) $db->last_insert_id($db->prefix().'mjlfinancement_invitation');
			if (mjl_auth_record_event('invitation_issued', (int) $target->id, (int) $actor->id, array('invitation_id' => $invitationId, 'role_code' => $data['role_code'])) < 1) throw new RuntimeException('Audit indisponible.');
			if (!$db->commit('mjl issue invitation')) throw new RuntimeException($db->lasterror());
			$link = '/custom/mjlfinancement/invitation.php?selector='.rawurlencode($selector).'#verifier='.rawurlencode($verifier);
			$mail = mjl_auth_send_link_email($target, 'invitation', $link);
			if (!$this->beginTransaction('mjl invitation delivery')) return array('', 'Le résultat de l’envoi n’a pas pu être enregistré.', (int) $target->id);
			$status = $mail[0] > 0 ? 'sent' : 'send_failed';
			$sql = 'UPDATE '.$db->prefix().'mjlfinancement_invitation SET status='.mjl_auth_string_sql($status).($status === 'sent' ? ', date_sent='.mjl_auth_now_sql() : ', token_hash=NULL, date_revoked='.mjl_auth_now_sql()).', fk_user_modif='.((int) $actor->id).' WHERE rowid='.$invitationId." AND status='pending_send'";
			$resql = $db->query($sql);
			if (!$resql || $db->affected_rows($resql) !== 1 || mjl_auth_record_event($status === 'sent' ? 'invitation_sent' : 'invitation_send_failed', (int) $target->id, (int) $actor->id, array('invitation_id' => $invitationId)) < 1 || !$db->commit('mjl invitation delivery')) {
				$this->rollbackTransaction('mjl invitation delivery failed');
				return array('', 'Le résultat de l’envoi n’a pas pu être enregistré.', (int) $target->id);
			}
			return array($status === 'sent' && mjl_auth_e2e_tokens_enabled() ? $link : '', $mail[0] > 0 ? '' : 'Échec de l’envoi.', (int) $target->id);
		} catch (RuntimeException $exception) {
			$this->rollbackTransaction('mjl issue invitation failed');
			return array('', $exception->getMessage(), $target ? (int) $target->id : 0);
		} finally {
			foreach (array_reverse($locks) as $lock) $this->releaseNamedLock($lock);
		}
	}

	public function acceptInvitation($selector, $verifier, $password, $passwordConfirm)
	{
		$db = $this->db;
		$passwordError = mjl_auth_password_error($password, $passwordConfirm);
		if ($passwordError !== '') return $passwordError;
		$lock = $this->namedLock('accept_'.$selector, 5);
		if ($lock === '') return 'Cette invitation est déjà en cours de traitement.';
		mjl_auth_disposable_lock_barrier();
		try {
			if (!$this->beginTransaction('mjl accept invitation')) return 'L’activation n’a pas pu être finalisée.';
			$row = mjl_auth_fetch_invitation_by_selector($selector, true);
			if (!$row || $row->status !== 'sent' || strtotime($row->date_expiry) < dol_now() || empty($row->token_hash) || !hash_equals((string) $row->token_hash, mjl_auth_token_hash($verifier))) throw new RuntimeException('Cette invitation est invalide ou expirée.');
			$target = new User($db);
			if ($target->fetch((int) $row->fk_user) <= 0 || !empty($target->admin) || (int) $target->statut !== 0 || (int) $target->entity !== $this->entity) throw new RuntimeException('Ce compte ne peut pas être activé.');
			$role = mjl_scope_active_role_row((int) $target->id, $this->entity);
			if (empty($role) || (string) $role['role_code'] !== (string) $row->role_code || !in_array($row->role_code, mjl_auth_business_role_codes(), true)) throw new RuntimeException('Le rôle de cette invitation a changé. Demandez une nouvelle invitation.');
			$actor = mjl_auth_system_user();
			if ($this->setPassword($target, $actor, $password) <= 0) throw new RuntimeException($target->error ?: 'Le mot de passe n’a pas pu être enregistré.');
			if (!$db->query('UPDATE '.$db->prefix().'user SET statut=1 WHERE rowid='.((int) $target->id).' AND entity='.$this->entity.' AND admin=0')) throw new RuntimeException($db->lasterror());
			$sql = 'UPDATE '.$db->prefix()."mjlfinancement_invitation SET status='accepted', token_hash=NULL, date_accepted=".mjl_auth_now_sql().', fk_user_modif='.((int) $target->id).' WHERE rowid='.((int) $row->rowid)." AND status='sent'";
			if (!$db->query($sql) || mjl_auth_record_event('invitation_accepted', (int) $target->id, (int) $target->id, array('role_code' => $row->role_code)) < 1) throw new RuntimeException('L’activation n’a pas pu être finalisée.');
			if (!$db->commit('mjl accept invitation')) throw new RuntimeException($db->lasterror());
			return '';
		} catch (RuntimeException $exception) {
			$this->rollbackTransaction('mjl accept invitation failed');
			return $exception->getMessage();
		} finally {
			$this->releaseNamedLock($lock);
		}
	}

	public function revokeInvitation($invitationId, User $actor)
	{
		$db = $this->db;
		if (!mjl_scope_is_platform_admin($actor, $this->entity)) return array(-1, 'Action interdite.');
		if (!$this->beginTransaction('mjl revoke invitation')) return array(-1, 'Cette invitation ne peut pas être révoquée.');
		$sql = 'UPDATE '.$db->prefix()."mjlfinancement_invitation SET status='revoked', token_hash=NULL, date_revoked=".mjl_auth_now_sql().', fk_user_revoked='.((int) $actor->id).', fk_user_modif='.((int) $actor->id).' WHERE entity='.$this->entity.' AND rowid='.((int) $invitationId)." AND status IN ('pending_send','sent')";
		$resql = $db->query($sql);
		if (!$resql || $db->affected_rows($resql) !== 1 || mjl_auth_record_event('invitation_revoked', null, (int) $actor->id, array('invitation_id' => (int) $invitationId)) < 1 || !$db->commit('mjl revoke invitation')) {
			$this->rollbackTransaction('mjl revoke invitation failed');
			return array(-1, 'Cette invitation ne peut pas être révoquée.');
		}
		return array(1, 'Invitation révoquée.');
	}

	public function createPasswordReset($email, $actorUserId = null)
	{
		$db = $this->db;
		$email = strtolower(trim((string) $email)); $emailHash = mjl_auth_context_hash($email); $ipHash = mjl_auth_client_ip_hash();
		$target = filter_var($email, FILTER_VALIDATE_EMAIL) ? mjl_auth_user_by_email($email, true) : null;
		if (!$target || mjl_auth_reset_throttled($email)) {
			mjl_auth_record_event($target ? 'password_reset_throttled' : 'password_reset_unknown', $target ? (int) $target->id : null, $actorUserId, array('email_fingerprint' => $emailHash, 'ip_fingerprint' => $ipHash));
			return null;
		}
		$role = mjl_scope_effective_role_code($target, $this->entity);
		if ($role === '' || (!in_array($role, mjl_auth_business_role_codes(), true) && $role !== 'ADMIN_PLATEFORME')) return null;
		$beforeResetId = mjl_auth_live_credential_max_id('mjlfinancement_password_reset', array((int) $target->id));
		if ($beforeResetId < 0) return null;
		$lock = $this->namedLock('reset_'.$target->id, 5); if ($lock === '') return null;
		mjl_auth_disposable_lock_barrier();
		try {
			$currentResetId = mjl_auth_live_credential_max_id('mjlfinancement_password_reset', array((int) $target->id));
			if ($currentResetId < 0 || $currentResetId > $beforeResetId) return null;
			if (!$this->beginTransaction('mjl request reset')) return null;
			if (!$db->query('UPDATE '.$db->prefix()."mjlfinancement_password_reset SET status='revoked', token_hash=NULL, date_consumed=".mjl_auth_now_sql().' WHERE entity='.$this->entity.' AND fk_user='.((int) $target->id)." AND status IN ('pending_send','sent')")) throw new RuntimeException();
			list($selector, $verifier) = mjl_auth_token_pair();
			$sql = 'INSERT INTO '.$db->prefix()."mjlfinancement_password_reset (entity,fk_user,status,token_selector,token_hash,date_expiry,date_creation,fk_user_creat) VALUES (".$this->entity.','.((int) $target->id).",'pending_send',".mjl_auth_string_sql($selector).','.mjl_auth_string_sql(mjl_auth_token_hash($verifier)).','.mjl_auth_datetime_sql(dol_now() + 3600).','.mjl_auth_now_sql().','.((int) $target->id).')';
			if (!$db->query($sql)) throw new RuntimeException();
			$id = (int) $db->last_insert_id($db->prefix().'mjlfinancement_password_reset');
			if (mjl_auth_record_event('password_reset_requested', (int) $target->id, $actorUserId, array('email_fingerprint' => $emailHash, 'ip_fingerprint' => $ipHash)) < 1 || !$db->commit('mjl request reset')) throw new RuntimeException();
			$link = '/user/passwordforgotten.php?setnewpassword=1&mjlselector='.rawurlencode($selector).'#verifier='.rawurlencode($verifier);
			$mail = mjl_auth_send_link_email($target, 'password_reset', $link);
			if (!$this->beginTransaction('mjl reset delivery')) return null;
			$status = $mail[0] > 0 ? 'sent' : 'send_failed';
			$sql = 'UPDATE '.$db->prefix().'mjlfinancement_password_reset SET status='.mjl_auth_string_sql($status).($status === 'send_failed' ? ',token_hash=NULL,date_consumed='.mjl_auth_now_sql() : '').' WHERE rowid='.$id." AND status='pending_send'";
			if (!$db->query($sql) || mjl_auth_record_event($status === 'sent' ? 'password_reset_sent' : 'password_reset_send_failed', (int) $target->id, $actorUserId, array('reset_id' => $id)) < 1 || !$db->commit('mjl reset delivery')) { $this->rollbackTransaction('mjl reset delivery failed'); return null; }
			return $status === 'sent' && mjl_auth_e2e_tokens_enabled() ? $link : null;
		} catch (RuntimeException $exception) { $this->rollbackTransaction('mjl request reset failed'); return null; }
		finally { $this->releaseNamedLock($lock); }
	}

	public function consumePasswordReset($selector, $verifier, $password, $passwordConfirm)
	{
		$db = $this->db;
		$passwordError = mjl_auth_password_error($password, $passwordConfirm);
		if ($passwordError !== '') return $passwordError;
		$lock = $this->namedLock('consume_'.$selector, 5); if ($lock === '') return 'Ce lien est déjà en cours de traitement.';
		mjl_auth_disposable_lock_barrier();
		try {
			if (!$this->beginTransaction('mjl consume reset')) return 'La réinitialisation n’a pas pu être finalisée.';
			$row = mjl_auth_fetch_reset_by_selector($selector, true);
			if (!$row || $row->status !== 'sent' || !empty($row->date_consumed) || strtotime($row->date_expiry) < dol_now() || !hash_equals((string) $row->token_hash, mjl_auth_token_hash($verifier))) throw new RuntimeException('Ce lien de réinitialisation est invalide ou expiré.');
			$target = new User($db);
			if ($target->fetch((int) $row->fk_user) <= 0) throw new RuntimeException('Votre accès est désactivé.');
			$targetInScope = ((int) $target->admin === 1 && (int) $target->entity === 0) || ((int) $target->admin === 0 && (int) $target->entity === $this->entity);
			if ((int) $target->statut !== 1 || !$targetInScope || mjl_scope_effective_role_code($target, $this->entity) === '') throw new RuntimeException('Votre accès est désactivé.');
			if ($this->setPassword($target, mjl_auth_system_user(), $password) <= 0) throw new RuntimeException($target->error ?: 'Le mot de passe n’a pas pu être enregistré.');
			$sql = 'UPDATE '.$db->prefix()."mjlfinancement_password_reset SET status='consumed', token_hash=NULL, date_consumed=".mjl_auth_now_sql().', fk_user_modif='.((int) $target->id).' WHERE rowid='.((int) $row->rowid)." AND status='sent'";
			if (!$db->query($sql) || mjl_auth_record_event('password_reset_completed', (int) $target->id, (int) $target->id, array('reset_id' => (int) $row->rowid)) < 1 || !$db->commit('mjl consume reset')) throw new RuntimeException('La réinitialisation n’a pas pu être finalisée.');
			return '';
		} catch (RuntimeException $exception) { $this->rollbackTransaction('mjl consume reset failed'); return $exception->getMessage(); }
		finally { $this->releaseNamedLock($lock); }
	}

	public function startOtp($email, $password, $backtopage = '')
	{
		$db = $this->db;
		if (!mjl_auth_otp_enabled() || !mjl_auth_otp_table_ready()) return array(false, 'La vérification est temporairement indisponible.');
		$target = mjl_auth_verify_password($email, $password);
		if (!$target) return array(false, 'Adresse email ou mot de passe incorrect.');
		$lock = $this->namedLock('otp_user_'.((int) $target->id), 5);
		if ($lock === '') return array(false, 'La vérification est temporairement indisponible.');
		$binding = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
		$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
		$challengeId = 0;
		try {
			$resql = $db->query('SELECT date_lockout_until FROM '.$db->prefix()."mjlfinancement_login_otp WHERE entity=".$this->entity.' AND fk_user='.((int) $target->id)." AND status='locked' AND date_lockout_until>".mjl_auth_now_sql().' ORDER BY rowid DESC LIMIT 1');
			if ($resql && $db->fetch_object($resql)) return array(false, 'Trop de codes incorrects. Réessayez dans quelques minutes.');
			if (!$this->beginTransaction('mjl start login otp')) return array(false, 'La vérification est temporairement indisponible.');
			$pendingResult = $db->query('SELECT rowid,credential_hash,date_expiry FROM '.$db->prefix()."mjlfinancement_login_otp WHERE entity=".$this->entity.' AND fk_user='.((int) $target->id)." AND status='pending' LIMIT 1 FOR UPDATE");
			$pending = $pendingResult ? $db->fetch_object($pendingResult) : null;
			if ($pending && strtotime($pending->date_expiry) >= dol_now() && hash_equals((string) $pending->credential_hash, mjl_auth_credential_hash($target))) {
				$challengeId = (int) $pending->rowid;
				$rebound = $db->query('UPDATE '.$db->prefix().'mjlfinancement_login_otp SET session_hash='.mjl_auth_string_sql(mjl_auth_otp_hash('session', $binding)).' WHERE rowid='.$challengeId." AND status='pending'");
				if (!$rebound || $db->affected_rows($rebound) !== 1 || !$db->commit('mjl rebind login otp')) throw new RuntimeException();
				mjl_auth_session_begin_pending($binding, $challengeId, $target, mjl_auth_safe_backtopage($backtopage));
				return array(true, '');
			}
			if ($pending && !$db->query('UPDATE '.$db->prefix()."mjlfinancement_login_otp SET status='cancelled',code_hash=NULL WHERE rowid=".((int) $pending->rowid)." AND status='pending'")) throw new RuntimeException();
			$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_login_otp (entity,fk_user,status,code_hash,session_hash,credential_hash,attempt_count,resend_count,date_code_issued,date_expiry,date_last_send,date_creation) VALUES (';
			$sql .= $this->entity.','.((int) $target->id).",'pending',".mjl_auth_string_sql(mjl_auth_otp_hash('otp:'.$target->id, $code)).','.mjl_auth_string_sql(mjl_auth_otp_hash('session', $binding)).','.mjl_auth_string_sql(mjl_auth_credential_hash($target)).',0,0,'.mjl_auth_now_sql().','.mjl_auth_datetime_sql(dol_now() + 600).','.mjl_auth_now_sql().','.mjl_auth_now_sql().')';
			if (!$db->query($sql)) throw new RuntimeException();
			$challengeId = (int) $db->last_insert_id($db->prefix().'mjlfinancement_login_otp');
			if (mjl_auth_record_event('login_otp_issued', (int) $target->id, (int) $target->id, array('challenge_id' => $challengeId)) < 1 || !$db->commit('mjl start login otp')) throw new RuntimeException();
			$mail = mjl_auth_send_otp_email($target, $code);
			if ($mail[0] <= 0) {
				$db->query('UPDATE '.$db->prefix()."mjlfinancement_login_otp SET status='delivery_failed',code_hash=NULL WHERE rowid=".$challengeId." AND status='pending'");
				return array(false, 'Le code ne peut pas être envoyé pour le moment.');
			}
			mjl_auth_session_begin_pending($binding, $challengeId, $target, mjl_auth_safe_backtopage($backtopage));
			return array(true, '');
		} catch (Throwable $exception) {
			$this->rollbackTransaction('mjl start login otp failed');
			return array(false, 'La vérification est temporairement indisponible.');
		} finally {
			$this->releaseNamedLock($lock);
		}
	}

	public function verifyOtp($code)
	{
		$db = $this->db;
		$code = trim((string) $code);
		if (!preg_match('/^[0-9]{6}$/', $code)) return array(false, 'Code incorrect.');
		$userId = mjl_auth_session_pending_user_id();
		$lock = $userId > 0 ? $this->namedLock('otp_user_'.$userId, 5) : '';
		if ($lock === '') return array(false, 'Votre session de vérification a expiré.');
		try {
			if (!$this->beginTransaction('mjl verify login otp')) return array(false, 'La vérification est temporairement indisponible.');
			$row = mjl_auth_otp_pending_row(true);
			if (!$row || $row->status !== 'pending') throw new RuntimeException('Votre session de vérification a expiré.');
			if (strtotime($row->date_expiry) < dol_now()) { $this->rollbackTransaction('mjl expired login otp'); return array(false, 'Ce code a expiré.'); }
			if (!hash_equals((string) $row->code_hash, mjl_auth_otp_hash('otp:'.$userId, $code))) {
				$attempts = (int) $row->attempt_count + 1;
				$terminal = $attempts >= 5;
				$sql = 'UPDATE '.$db->prefix().'mjlfinancement_login_otp SET attempt_count='.$attempts.($terminal ? ",status='locked',code_hash=NULL,date_lockout_until=".mjl_auth_datetime_sql(dol_now() + 600) : '').' WHERE rowid='.((int) $row->rowid)." AND status='pending'";
				if (!$db->query($sql) || mjl_auth_record_event($terminal ? 'login_otp_locked' : 'login_otp_invalid', $userId, $userId, array('challenge_id' => (int) $row->rowid, 'attempt_count' => $attempts)) < 1 || !$db->commit('mjl reject login otp')) throw new RuntimeException('La vérification est temporairement indisponible.');
				if ($terminal) mjl_auth_session_clear_pending();
				return array(false, $terminal ? 'Trop de codes incorrects. Réessayez dans quelques minutes.' : 'Code incorrect.');
			}
			$target = new User($db);
			if ($target->fetch($userId) <= 0 || (int) $target->statut !== 1 || mjl_scope_effective_role_code($target, $this->entity) === '' || !hash_equals((string) $row->credential_hash, mjl_auth_credential_hash($target))) {
				$invalidated = $db->query('UPDATE '.$db->prefix()."mjlfinancement_login_otp SET status='cancelled',code_hash=NULL WHERE rowid=".((int) $row->rowid)." AND status='pending'");
				if (!$invalidated || mjl_auth_record_event('login_otp_invalidated', $userId, $userId, array('challenge_id' => (int) $row->rowid)) < 1 || !$db->commit('mjl invalidate login otp')) throw new RuntimeException('La vérification est temporairement indisponible.');
				mjl_auth_session_clear_pending();
				return array(false, 'Votre session de vérification a expiré.');
			}
			$verifiedUpdate = $db->query('UPDATE '.$db->prefix()."mjlfinancement_login_otp SET status='verified',code_hash=NULL,date_verified=".mjl_auth_now_sql().' WHERE rowid='.((int) $row->rowid)." AND status='pending'");
			if (!$verifiedUpdate || $db->affected_rows($verifiedUpdate) !== 1) throw new RuntimeException('Votre session de vérification a expiré.');
			$target->context['audit'] = 'authmode=mjl_email_otp - entity='.$this->entity;
			$target->context['authentication_method'] = 'mjl_email_otp';
			$target->update_last_login_date();
			if ($target->call_trigger('USER_LOGIN', $target) < 0 || mjl_auth_record_event('login_otp_verified', $userId, $userId, array('challenge_id' => (int) $row->rowid)) < 1 || !$db->commit('mjl verify login otp')) throw new RuntimeException('La vérification est temporairement indisponible.');
			$backtopage = mjl_auth_safe_backtopage(mjl_auth_session_pending_backtopage());
			mjl_auth_session_complete($target, (int) $row->rowid, $this->entity, $this->failSessionCompletion);
			return array(true, $backtopage);
		} catch (Throwable $exception) {
			$this->rollbackTransaction('mjl verify login otp failed');
			return array(false, $exception->getMessage());
		} finally {
			$this->releaseNamedLock($lock);
		}
	}

	public function resendOtp()
	{
		$db = $this->db;
		$userId = mjl_auth_session_pending_user_id();
		$lock = $userId > 0 ? $this->namedLock('otp_user_'.$userId, 5) : '';
		if ($lock === '') return array(false, 'Votre session de vérification a expiré.');
		try {
			if (!$this->beginTransaction('mjl resend login otp')) return array(false, 'La vérification est temporairement indisponible.');
			$row = mjl_auth_otp_pending_row(true);
			if (!$row || $row->status !== 'pending') throw new RuntimeException('Votre session de vérification a expiré.');
			if ((int) $row->resend_count >= 3 || strtotime($row->date_last_send) > dol_now() - 60) { $this->rollbackTransaction('mjl resend login otp refused'); return array(false, 'Le renvoi est temporairement indisponible.'); }
			$target = new User($db);
			if ($target->fetch($userId) <= 0 || (int) $target->statut !== 1 || mjl_scope_effective_role_code($target, $this->entity) === '' || !hash_equals((string) $row->credential_hash, mjl_auth_credential_hash($target))) {
				$invalidated = $db->query('UPDATE '.$db->prefix()."mjlfinancement_login_otp SET status='cancelled',code_hash=NULL WHERE rowid=".((int) $row->rowid)." AND status='pending'");
				if (!$invalidated || !$db->commit('mjl invalidate login otp resend')) throw new RuntimeException('La vérification est temporairement indisponible.');
				mjl_auth_session_clear_pending();
				return array(false, 'Votre session de vérification a expiré.');
			}
			do {
				$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
				$codeHash = mjl_auth_otp_hash('otp:'.$userId, $code);
			} while (hash_equals((string) $row->code_hash, $codeHash));
			$sql = 'UPDATE '.$db->prefix().'mjlfinancement_login_otp SET code_hash='.mjl_auth_string_sql($codeHash).',resend_count=resend_count+1,date_code_issued='.mjl_auth_now_sql().',date_expiry='.mjl_auth_datetime_sql(dol_now() + 600).',date_last_send='.mjl_auth_now_sql().' WHERE rowid='.((int) $row->rowid)." AND status='pending'";
			if (!$db->query($sql) || !$db->commit('mjl resend login otp')) throw new RuntimeException('La vérification est temporairement indisponible.');
			$mail = mjl_auth_send_otp_email($target, $code);
			return $mail[0] > 0 ? array(true, 'Un nouveau code a été envoyé.') : array(false, 'Le code ne peut pas être envoyé pour le moment.');
		} catch (Throwable $exception) {
			$this->rollbackTransaction('mjl resend login otp failed');
			return array(false, $exception->getMessage());
		} finally { $this->releaseNamedLock($lock); }
	}

	private function namedLock($name, $timeout = 2)
	{
		$db = $this->db;
		$name = substr('mjl_auth_'.$this->entity.'_'.preg_replace('/[^a-z0-9_-]/i', '', (string) $name), 0, 64);
		$resql = $db->query('SELECT GET_LOCK('.mjl_auth_string_sql($name).', '.((int) $timeout).') AS locked');
		$row = $resql ? $db->fetch_object($resql) : null;
		return $row && (int) $row->locked === 1 ? $name : '';
	}

	private function beginTransaction($label)
	{
		if (!$this->connectionUsable) return false;
		$db = $this->db;
		return (bool) $db->begin($label);
	}

	private function rollbackTransaction($label)
	{
		$db = $this->db;
		if ($db->rollback($label)) return true;
		$this->connectionUsable = false;
		if (method_exists($db, 'close')) $db->close();
		return false;
	}

	private function releaseNamedLock($name)
	{
		$db = $this->db;
		if ($this->connectionUsable && $name !== '') $db->query('SELECT RELEASE_LOCK('.mjl_auth_string_sql($name).')');
	}

	private function identityLocks($login, $email)
	{
		$identities = array(
			'email_'.hash('sha256', strtolower(trim((string) $email))),
			'login_'.hash('sha256', strtolower(trim((string) $login))),
		);
		sort($identities, SORT_STRING);
		$locks = array();
		foreach ($identities as $identity) {
			$lock = $this->namedLock($identity, 5);
			if ($lock === '') {
				foreach (array_reverse($locks) as $held) $this->releaseNamedLock($held);
				return array();
			}
			$locks[] = $lock;
		}
		return $locks;
	}

	private function setPassword(User $target, User $actor, $password)
	{
		$conf = $this->conf;
		$hadGenerator = isset($conf->global->USER_PASSWORD_GENERATED);
		$generator = $hadGenerator ? $conf->global->USER_PASSWORD_GENERATED : null;
		$hadEncryptedStorage = isset($conf->global->DATABASE_PWD_ENCRYPTED);
		$encryptedStorage = $hadEncryptedStorage ? $conf->global->DATABASE_PWD_ENCRYPTED : null;
		$conf->global->USER_PASSWORD_GENERATED = '';
		$conf->global->DATABASE_PWD_ENCRYPTED = '1';
		try {
			return $target->setPassword($actor, $password, 0, 0);
		} finally {
			if ($hadGenerator) $conf->global->USER_PASSWORD_GENERATED = $generator;
			else unset($conf->global->USER_PASSWORD_GENERATED);
			if ($hadEncryptedStorage) $conf->global->DATABASE_PWD_ENCRYPTED = $encryptedStorage;
			else unset($conf->global->DATABASE_PWD_ENCRYPTED);
		}
	}
}
