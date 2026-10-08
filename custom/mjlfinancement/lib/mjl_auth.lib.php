<?php

require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_email.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlaccesscommand.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/auth/mjl_auth_session.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlauthcommand.class.php';

function mjl_auth_entity() { global $conf; return max(1, (int) $conf->entity); }
function mjl_auth_fail_session_completion() { return getenv('MJL_DISPOSABLE_TEST_TENANT') === '1' && getDolGlobalString('MJL_AUTH_E2E_FAIL_SESSION_COMPLETION') === '1'; }
function mjl_auth_command()
{
	global $db, $conf;
	return new MjlAuthCommand($db, $conf, mjl_auth_entity(), getDolGlobalString('MJL_AUTH_FINGERPRINT_KEY') !== '', mjl_auth_fail_session_completion());
}
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
	$sql = 'SELECT rowid FROM '.$db->prefix()."user WHERE LOWER(email) = '".$db->escape($email)."' AND entity IN (0,".mjl_auth_entity().')';
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

function mjl_auth_absolute_url($relativeUrl) { return mjl_email_absolute_url($relativeUrl); }
function mjl_auth_mail_from() { return mjl_email_mail_from(); }

function mjl_auth_send_link_email(User $target, $type, $link)
{
	return mjl_email_send($target, $type === 'invitation' ? 'invitation' : 'password_reset', array('link' => $link, 'auth_link_type' => $type), array('object_type' => 'mjlfinancement_auth', 'object_id' => (int) $target->id));
}

function mjl_auth_password_error($password, $passwordConfirm)
{
	if ((string) $password !== (string) $passwordConfirm) return 'Les mots de passe ne correspondent pas.';
	if (dol_strlen((string) $password) < 8
		|| !preg_match('/\p{Lu}/u', (string) $password)
		|| !preg_match('/\p{Ll}/u', (string) $password)
		|| !preg_match('/\p{N}/u', (string) $password)
		|| !preg_match('/[^\p{L}\p{N}\s]/u', (string) $password)) {
		return 'Le mot de passe ne respecte pas les critères requis.';
	}
	return '';
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
	return mjl_auth_command()->issueInvitation($input, $actor);
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

function mjl_auth_invitation_email($selector)
{
	global $db;
	$row = mjl_auth_fetch_invitation_by_selector($selector);
	if (!$row || mjl_auth_invitation_status($selector) !== 'valid') return '';
	$target = new User($db);
	return $target->fetch((int) $row->fk_user) > 0 ? (string) $target->email : '';
}

function mjl_auth_accept_invitation($selector, $verifier, $password, $passwordConfirm)
{
	return mjl_auth_command()->acceptInvitation($selector, $verifier, $password, $passwordConfirm);
}

function mjl_auth_revoke_invitation($invitationId, User $actor)
{
	return mjl_auth_command()->revokeInvitation($invitationId, $actor);
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
	return mjl_auth_command()->createPasswordReset($email, $actorUserId);
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

function mjl_auth_reset_email($selector)
{
	global $db;
	$row = mjl_auth_fetch_reset_by_selector($selector);
	if (!$row || mjl_auth_reset_status($selector) !== 'valid') return '';
	$target = new User($db);
	return $target->fetch((int) $row->fk_user) > 0 ? (string) $target->email : '';
}

function mjl_auth_consume_password_reset($selector, $verifier, $password, $passwordConfirm)
{
	return mjl_auth_command()->consumePasswordReset($selector, $verifier, $password, $passwordConfirm);
}

function mjl_auth_otp_enabled()
{
	return getDolGlobalString('MJL_AUTH_OTP_ENABLED') === '1';
}

function mjl_auth_schema_normalize($value)
{
	if ($value === null) return '<null>';
	$value = strtolower(trim((string) $value));
	if (strlen($value) >= 2 && $value[0] === "'" && substr($value, -1) === "'") $value = substr($value, 1, -1);
	if ($value === 'null') return '<null>';
	return preg_replace('/[`\\s]+/', '', $value);
}

function mjl_auth_otp_table_ready()
{
	global $db;
	if (getDolGlobalString('MJL_AUTH_FINGERPRINT_KEY') === '') return false;
	$table = $db->prefix().'mjlfinancement_login_otp';
	$quotedTable = "'".$db->escape($table)."'";

	$resql = $db->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=".$quotedTable." AND TABLE_TYPE='BASE TABLE'");
	$row = $resql ? $db->fetch_object($resql) : null;
	if (!$row || strtolower((string) $row->ENGINE) !== 'innodb') return false;

	$expectedColumns = array(
		'rowid' => array('int(11)','no','<null>','auto_increment','<null>'),
		'entity' => array('int(11)','no','1','','<null>'),
		'fk_user' => array('int(11)','no','<null>','','<null>'),
		'status' => array('varchar(32)','no','pending','','<null>'),
		'code_hash' => array('char(64)','yes','<null>','','<null>'),
		'session_hash' => array('char(64)','no','<null>','','<null>'),
		'credential_hash' => array('char(64)','no','<null>','','<null>'),
		'attempt_count' => array('int(11)','no','0','','<null>'),
		'resend_count' => array('int(11)','no','0','','<null>'),
		'live_user_id' => array('int(11)','yes','<null>','storedgenerated',"casewhenstatus='pending'thenfk_userelsenullend"),
		'date_code_issued' => array('datetime','no','<null>','','<null>'),
		'date_expiry' => array('datetime','no','<null>','','<null>'),
		'date_last_send' => array('datetime','no','<null>','','<null>'),
		'date_lockout_until' => array('datetime','yes','<null>','','<null>'),
		'date_verified' => array('datetime','yes','<null>','','<null>'),
		'date_creation' => array('datetime','no','<null>','','<null>'),
		'tms' => array('timestamp','yes','current_timestamp()','onupdatecurrent_timestamp()','<null>'),
	);
	$actualColumns = array();
	$resql = $db->query('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='.$quotedTable.' ORDER BY ORDINAL_POSITION');
	if (!$resql) return false;
	while ($column = $db->fetch_object($resql)) {
		$actualColumns[(string) $column->COLUMN_NAME] = array(
			mjl_auth_schema_normalize($column->COLUMN_TYPE), mjl_auth_schema_normalize($column->IS_NULLABLE),
			mjl_auth_schema_normalize($column->COLUMN_DEFAULT), mjl_auth_schema_normalize($column->EXTRA),
			mjl_auth_schema_normalize($column->GENERATION_EXPRESSION),
		);
	}
	if ($actualColumns !== $expectedColumns) return false;

	$expectedIndexes = array(
		'PRIMARY' => '0|BTREE|rowid',
		'fk_mjl_login_otp_user' => '1|BTREE|fk_user',
		'idx_mjl_login_otp_lockout' => '1|BTREE|entity,fk_user,date_lockout_until',
		'idx_mjl_login_otp_user' => '1|BTREE|entity,fk_user,status',
		'uk_mjl_login_otp_live_user' => '0|BTREE|entity,live_user_id',
	);
	$actualIndexes = array();
	$resql = $db->query('SELECT INDEX_NAME,NON_UNIQUE,INDEX_TYPE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns_list FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='.$quotedTable.' GROUP BY INDEX_NAME,NON_UNIQUE,INDEX_TYPE ORDER BY INDEX_NAME');
	if (!$resql) return false;
	while ($index = $db->fetch_object($resql)) $actualIndexes[(string) $index->INDEX_NAME] = ((int) $index->NON_UNIQUE).'|'.strtoupper((string) $index->INDEX_TYPE).'|'.(string) $index->columns_list;
	ksort($expectedIndexes); ksort($actualIndexes);
	if ($actualIndexes !== $expectedIndexes) return false;

	$expectedConstraints = array(
		'PRIMARY' => 'PRIMARY KEY', 'chk_mjl_login_otp_counts' => 'CHECK', 'chk_mjl_login_otp_secret' => 'CHECK',
		'chk_mjl_login_otp_status' => 'CHECK', 'fk_mjl_login_otp_user' => 'FOREIGN KEY', 'uk_mjl_login_otp_live_user' => 'UNIQUE',
	);
	$actualConstraints = array();
	$resql = $db->query('SELECT CONSTRAINT_NAME,CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='.$quotedTable.' ORDER BY CONSTRAINT_NAME');
	if (!$resql) return false;
	while ($constraint = $db->fetch_object($resql)) $actualConstraints[(string) $constraint->CONSTRAINT_NAME] = (string) $constraint->CONSTRAINT_TYPE;
	ksort($expectedConstraints); ksort($actualConstraints);
	if ($actualConstraints !== $expectedConstraints) return false;

	$expectedChecks = array(
		'chk_mjl_login_otp_counts' => 'attempt_countbetween0and5andresend_countbetween0and3',
		'chk_mjl_login_otp_secret' => "status='pending'andcode_hashisnotnullorstatus<>'pending'andcode_hashisnull",
		'chk_mjl_login_otp_status' => "statusin('pending','verified','cancelled','delivery_failed','locked')",
	);
	$actualChecks = array();
	$resql = $db->query('SELECT CONSTRAINT_NAME,CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='.$quotedTable.' ORDER BY CONSTRAINT_NAME');
	if (!$resql) return false;
	while ($check = $db->fetch_object($resql)) $actualChecks[(string) $check->CONSTRAINT_NAME] = mjl_auth_schema_normalize($check->CHECK_CLAUSE);
	ksort($expectedChecks); ksort($actualChecks);
	if ($actualChecks !== $expectedChecks) return false;

	$resql = $db->query("SELECT k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.UPDATE_RULE,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME=".$quotedTable." AND k.CONSTRAINT_NAME='fk_mjl_login_otp_user'");
	$foreign = $resql ? $db->fetch_object($resql) : null;
	if (!$foreign || (string) $foreign->COLUMN_NAME !== 'fk_user' || (string) $foreign->REFERENCED_TABLE_NAME !== $db->prefix().'user' || (string) $foreign->REFERENCED_COLUMN_NAME !== 'rowid' || (string) $foreign->UPDATE_RULE !== 'RESTRICT' || (string) $foreign->DELETE_RULE !== 'RESTRICT') return false;

	$userTable = $db->prefix().'user';
	$expectedTriggers = array(
		$db->prefix().'mjlfinancement_login_otp_bi' => array('BEFORE','INSERT',mjl_auth_schema_normalize("BEGIN DECLARE target_entity INTEGER DEFAULT -1; DECLARE target_admin INTEGER DEFAULT 0; SELECT entity,admin INTO target_entity,target_admin FROM ".$userTable." WHERE rowid=NEW.fk_user; IF NOT ((target_admin=1 AND target_entity=0 AND NEW.entity>=1) OR (target_admin=0 AND target_entity=NEW.entity)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid OTP target'; END IF; END")),
		$db->prefix().'mjlfinancement_login_otp_bu' => array('BEFORE','UPDATE',mjl_auth_schema_normalize("BEGIN IF NEW.entity<>OLD.entity OR NEW.fk_user<>OLD.fk_user OR NEW.credential_hash<>OLD.credential_hash OR (NEW.session_hash<>OLD.session_hash AND NOT (OLD.status='pending' AND NEW.status='pending')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid OTP mutation'; END IF; END")),
	);
	$actualTriggers = array();
	$resql = $db->query('SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='.$quotedTable.' ORDER BY TRIGGER_NAME');
	if (!$resql) return false;
	while ($trigger = $db->fetch_object($resql)) $actualTriggers[(string) $trigger->TRIGGER_NAME] = array((string) $trigger->ACTION_TIMING, (string) $trigger->EVENT_MANIPULATION, mjl_auth_schema_normalize($trigger->ACTION_STATEMENT));
	ksort($expectedTriggers); ksort($actualTriggers);
	return $actualTriggers === $expectedTriggers;
}

function mjl_auth_otp_hash($purpose, $value)
{
	$key = getDolGlobalString('MJL_AUTH_FINGERPRINT_KEY');
	return $key === '' ? '' : hash_hmac('sha256', (string) $purpose."\0".(string) $value, $key);
}

function mjl_auth_credential_hash(User $target)
{
	global $db;
	$resql = $db->query('SELECT pass_crypted,datelastpassvalidation,flagdelsessionsbefore,email,statut,admin,entity FROM '.$db->prefix().'user WHERE rowid='.((int) $target->id).' LIMIT 1');
	$row = $resql ? $db->fetch_object($resql) : null;
	if (!$row) return '';
	$value = implode('|', array((string) $row->pass_crypted, (string) $row->datelastpassvalidation, (string) $row->flagdelsessionsbefore, strtolower((string) $row->email), (int) $row->statut, (int) $row->admin, (int) $row->entity, mjl_scope_effective_role_code($target, mjl_auth_entity())));
	return mjl_auth_otp_hash('credential', $value);
}

function mjl_auth_otp_session_binding()
{
	return mjl_auth_session_binding();
}

function mjl_auth_otp_clear_pending_session()
{
	mjl_auth_session_clear_pending();
}

function mjl_auth_clear_native_session()
{
	mjl_auth_session_clear_native();
}

function mjl_auth_safe_backtopage($value)
{
	$value = is_string($value) ? trim($value) : '';
	if ($value === '' || strpos($value, "\0") !== false || preg_match('#^[a-z][a-z0-9+.-]*:#i', $value) || strpos($value, '//') === 0) return '/custom/mjlfinancement/index.php';
	$path = parse_url($value, PHP_URL_PATH);
	if (!is_string($path) || strpos($path, '/custom/mjlfinancement/') !== 0 || strpos($path, '..') !== false) return '/custom/mjlfinancement/index.php';
	return $value;
}

function mjl_auth_register_failed_password($email)
{
	global $db;
	$failed = new User($db);
	$failed->login = substr((string) $email, 0, 255);
	$failed->context['audit'] = 'ErrorBadLoginPassword - login='.substr((string) $email, 0, 255);
	$failed->call_trigger('USER_LOGIN_FAILED', $failed);
}

function mjl_auth_verify_password($email, $password)
{
	global $conf, $db;
	$email = strtolower(trim((string) $email));
	if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !is_string($password) || $password === '') {
		mjl_auth_register_failed_password($email);
		return null;
	}
	require_once DOL_DOCUMENT_ROOT.'/core/lib/security2.lib.php';
	$login = checkLoginPassEntity($email, $password, mjl_auth_entity(), array('dolibarr'));
	if (!$login) {
		mjl_auth_register_failed_password($email);
		return null;
	}
	$target = new User($db);
	if ($target->fetch(0, $login, '', 1, -1) <= 0 || (int) $target->statut !== 1 || strtolower((string) $target->email) !== $email) {
		mjl_auth_register_failed_password($email);
		return null;
	}
	$role = mjl_scope_effective_role_code($target, mjl_auth_entity());
	if ($role === '') {
		mjl_auth_register_failed_password($email);
		return null;
	}
	return $target;
}

function mjl_auth_send_otp_email(User $target, $code)
{
	return mjl_email_send($target, 'login_otp', array('code' => (string) $code, 'secret_auth_type' => 'login_otp'), array('object_type' => 'mjlfinancement_auth', 'object_id' => (int) $target->id));
}

function mjl_auth_start_otp($email, $password, $backtopage = '')
{
	return mjl_auth_command()->startOtp($email, $password, $backtopage);
}

function mjl_auth_otp_pending_row($forUpdate = false)
{
	global $db;
	$id = mjl_auth_session_pending_challenge_id();
	$userId = mjl_auth_session_pending_user_id();
	$binding = mjl_auth_otp_session_binding();
	if ($id <= 0 || $userId <= 0 || $binding === '') return null;
	$sql = 'SELECT * FROM '.$db->prefix().'mjlfinancement_login_otp WHERE rowid='.$id.' AND entity='.mjl_auth_entity().' AND fk_user='.$userId.' AND session_hash='.mjl_auth_string_sql(mjl_auth_otp_hash('session', $binding)).' LIMIT 1'.($forUpdate ? ' FOR UPDATE' : '');
	$resql = $db->query($sql);
	return $resql ? $db->fetch_object($resql) : null;
}

function mjl_auth_otp_pending()
{
	$row = mjl_auth_otp_pending_row(false);
	return $row && $row->status === 'pending';
}

function mjl_auth_complete_session(User $target, $challengeId)
{
	mjl_auth_session_complete($target, $challengeId, mjl_auth_entity(), mjl_auth_fail_session_completion());
}

function mjl_auth_verify_otp($code)
{
	return mjl_auth_command()->verifyOtp($code);
}

function mjl_auth_resend_otp()
{
	return mjl_auth_command()->resendOtp();
}

function mjl_auth_session_is_otp_verified(User $target)
{
	global $db;
	$enabled = mjl_auth_otp_enabled();
	$state = mjl_auth_session_verified_state();
	if (!$enabled) return mjl_auth_session_validity_decision(false, (int) $target->id, $state, false, false);
	$id = (int) $state['challenge_id'];
	$userId = (int) $state['user_id'];
	$binding = (string) $state['binding'];
	if ($id <= 0 || $userId !== (int) $target->id || $binding === '') return mjl_auth_session_validity_decision(true, (int) $target->id, $state, false, false);
	$sql = 'SELECT credential_hash FROM '.$db->prefix()."mjlfinancement_login_otp WHERE rowid=".$id.' AND entity='.mjl_auth_entity().' AND fk_user='.$userId." AND status='verified' AND session_hash=".mjl_auth_string_sql(mjl_auth_otp_hash('session', $binding)).' LIMIT 1';
	$resql = $db->query($sql); $row = $resql ? $db->fetch_object($resql) : null;
	$matches = $row && hash_equals((string) $row->credential_hash, mjl_auth_credential_hash($target));
	return mjl_auth_session_validity_decision(true, (int) $target->id, $state, (bool) $row, $matches);
}
