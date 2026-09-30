<?php

require '../../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_access_ui.lib.php';

if (!mjl_scope_is_platform_admin($user)) {
	http_response_code(403);
	accessforbidden();
}

$action = GETPOST('action', 'aZ09');
$message = '';
$error = '';
$generatedLink = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		$error = 'Jeton de sécurité invalide.';
	} elseif ($action === 'invite') {
		$result = mjl_auth_issue_invitation(array(
			'login' => GETPOST('login', 'alphanohtml'),
			'firstname' => GETPOST('firstname', 'restricthtml'),
			'lastname' => GETPOST('lastname', 'restricthtml'),
			'email' => GETPOST('email', 'restricthtml'),
			'role_code' => GETPOST('role_code', 'aZ09'),
		), $user);
		$error = $result[1];
		if ($error === '') {
			$message = 'Invitation envoyée.';
			$generatedLink = $result[0];
		}
	} elseif ($action === 'update_profile') {
		$targetUserId = GETPOSTINT('user_id');
		$profile = mjl_scope_assign_access_profile($targetUserId, GETPOST('role_code', 'aZ09'), $user, mjl_auth_entity(), 'admin_access', 'Modification administrateur');
		if ($profile[0] < 0) {
			$error = $profile[1];
		} else {
			$message = $profile[1];
		}
	} elseif ($action === 'deactivate') {
		$result = mjl_scope_deactivate_access(GETPOSTINT('user_id'), $user, mjl_auth_entity());
		if ($result[0] < 0) {
			$error = $result[1];
		} else {
			$message = $result[1];
		}
	} elseif ($action === 'revoke') {
		$revokeResult = mjl_auth_revoke_invitation(GETPOSTINT('id'), $user);
		if ($revokeResult[0] >= 0) {
			$message = $revokeResult[1];
		} else {
			$error = $revokeResult[1];
		}
	}
	$operation = 'admin_access:'.($action !== '' ? $action : 'unknown').':'.GETPOSTINT('user_id').':'.GETPOSTINT('id');
	if ($error !== '') {
		mjl_ui_log_error('admin_access', array('route' => 'admin/access', 'action' => $action, 'entity' => mjl_auth_entity(), 'user_id' => (int) $user->id), $error);
		$errorKey = $error === 'Jeton de sécurité invalide.' ? 'generic.validation' : 'generic.error';
		if ($action === 'deactivate' && GETPOSTINT('user_id') === (int) $user->id) $errorKey = 'access.self_deactivation_denied';
		if ($action === 'invite' && $error === 'Cet identifiant correspond déjà à un utilisateur existant.') $errorKey = 'access.login_exists';
		if ($action === 'invite' && $error === 'Cette adresse e-mail est déjà utilisée.') $errorKey = 'access.email_in_use';
		mjl_feedback_add($operation.':error', $errorKey);
	} elseif ($message !== '') {
		$keys = array('invite' => 'access.invitation_sent', 'update_profile' => 'access.profile_updated', 'deactivate' => 'access.deactivated', 'revoke' => 'access.invitation_revoked');
		if ($action === 'revoke') {
			$revokeKeys = array(
				'Cette invitation est déjà acceptée.' => 'access.invitation_already_accepted',
				'Cette invitation est déjà révoquée.' => 'access.invitation_already_revoked',
				'Cette invitation est en cours d’acceptation.' => 'access.invitation_accepting',
				'Cette invitation ne peut pas être révoquée dans son état actuel.' => 'access.invitation_cannot_revoke',
			);
			if (isset($revokeKeys[$message])) $keys['revoke'] = $revokeKeys[$message];
		}
		mjl_feedback_add($operation, isset($keys[$action]) ? $keys[$action] : 'generic.saved');
	}
}

$roles = array_intersect_key(mjl_scope_role_labels(), array_flip(mjl_auth_business_role_codes()));
$users = mjl_access_users();

$invitations = array();
$sql = 'SELECT i.rowid, i.status, i.date_sent, i.date_expiry, u.login, u.email FROM '.$db->prefix().'mjlfinancement_invitation i';
$sql .= ' INNER JOIN '.$db->prefix().'user u ON u.rowid = i.fk_user';
$sql .= ' WHERE i.entity = '.mjl_auth_entity().' ORDER BY i.rowid DESC LIMIT 50';
$resql = $db->query($sql);
if ($resql) {
	while ($obj = $db->fetch_object($resql)) $invitations[] = (array) $obj;
}

$inviteValues = array();
$inviteError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'invite' && $error !== '') {
	$inviteValues = array(
		'login' => GETPOST('login', 'alphanohtml'),
		'firstname' => GETPOST('firstname', 'restricthtml'),
		'lastname' => GETPOST('lastname', 'restricthtml'),
		'email' => GETPOST('email', 'restricthtml'),
		'role_code' => GETPOST('role_code', 'aZ09'),
	);
	$inviteError = $error;
}

llxHeader('', 'Gestion des accès MJL');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace mjl-access-workspace">';
print mjl_page_header_render(
	'Gestion des accès MJL',
	array(
		'breadcrumb' => array(array('label' => 'Administration')),
		'description' => 'Invitez les utilisateurs et gérez leur rôle de production.',
		'context' => array('label' => 'Accès', 'value' => 'Administration'),
		'primary_action' => array(
			'label' => 'Inviter un utilisateur',
			'href' => DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php#mjl-access-invite-dialog',
		),
	)
);

if ($generatedLink !== '') {
	print '<div class="info">Lien E2E: <code>'.dol_escape_htmltag($generatedLink).'</code></div>';
}

$pageToken = newToken();
print mjl_access_ui_users($users, $roles, $pageToken);
print mjl_access_ui_invitations($invitations, $pageToken);
print mjl_access_ui_invite_dialog($roles, $pageToken, $inviteValues, $inviteError);
print mjl_access_ui_action_dialog();

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_access_users()
{
	global $db;

	$rows = array();
	$sql = "SELECT u.rowid, u.login, u.email, u.statut, u.admin AS native_admin, CASE WHEN u.admin = 1 THEN 'ADMIN_PLATEFORME' ELSE r.role_code END AS role_code";
	$sql .= ', 0 AS recovery_required';
	$sql .= ' FROM '.$db->prefix().'user u';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_user_role r ON r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1';
	$sql .= ' WHERE u.entity = '.mjl_auth_entity().' AND (r.rowid IS NOT NULL OR u.admin = 1)';
	$sql .= ' ORDER BY u.login';
	$resql = $db->query($sql);
	if ($resql) {
		while ($obj = $db->fetch_object($resql)) {
			$row = (array) $obj;
			$row['role_label'] = !empty($row['recovery_required']) ? 'Récupération administrative requise' : ($row['role_code'] !== null && $row['role_code'] !== '' ? mjl_scope_role_label($row['role_code']) : 'Profil historique non résolu');
			$rows[] = $row;
		}
	}
	return $rows;
}
