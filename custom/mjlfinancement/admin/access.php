<?php

require '../../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

if (!mjl_scope_is_platform_admin($user)) {
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
		$roleCode = GETPOST('role_code', 'aZ09');
		$inviteLogin = GETPOST('login', 'alphanohtml');
		$existingInvitee = mjl_auth_user_by_login($inviteLogin);
		$recoveringInvitee = $existingInvitee && mjl_access_user_requires_recovery((int) $existingInvitee->id);
		if ($recoveringInvitee && strcasecmp(trim((string) $existingInvitee->email), trim(GETPOST('email', 'restricthtml'))) === 0) {
			$result = array((int) $existingInvitee->id, '');
		} else {
			$result = mjl_auth_create_or_update_user(
				$inviteLogin,
				GETPOST('firstname', 'restricthtml'),
				GETPOST('lastname', 'restricthtml'),
				GETPOST('email', 'restricthtml'),
				0,
				$user
			);
		}
		if ($result[0] < 0) {
			$error = $result[1];
		} else {
			$profile = mjl_scope_assign_access_profile($result[0], $roleCode, $user, mjl_auth_entity(), 'admin_access', 'Invitation administrateur');
			if ($profile[0] < 0) {
				if (!$existingInvitee && !mjl_access_delete_failed_invitee((int) $result[0], $user)) {
					mjl_ui_log_error('admin_access', array('route' => 'admin/access', 'action' => 'invite_compensation', 'entity' => mjl_auth_entity(), 'user_id' => (int) $user->id), 'Failed to remove an unprofiled invitee.');
					if (mjl_auth_record_event('invite_compensation_failed', (int) $result[0], (int) $user->id, 'source=admin_access;state=inactive_recovery_required') < 1) {
						mjl_ui_log_error('admin_access', array('route' => 'admin/access', 'action' => 'invite_compensation_audit', 'entity' => mjl_auth_entity(), 'user_id' => (int) $user->id), 'Failed to audit an invitee recovery blocker; current-state discovery remains active.');
					}
					$error = 'La création du compte a échoué. Un compte inactif sans accès exige une récupération administrative avant toute nouvelle invitation.';
				} else {
					$error = $profile[1];
				}
			} else {
				$linkResult = mjl_auth_create_invitation($result[0], $user);
				if ($linkResult[1] !== '') {
					$error = $linkResult[1];
				} else {
					$message = 'Invitation envoyee.';
					if (mjl_auth_e2e_tokens_enabled()) {
						$generatedLink = $linkResult[0];
					}
				}
			}
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

$roles = mjl_scope_role_labels();
$users = mjl_access_users();

llxHeader('', 'Gestion des accès MJL');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render(
	'Gestion des accès MJL',
	array(
		'breadcrumb' => array(array('label' => 'Administration')),
		'description' => 'Invitez les utilisateurs et gérez leur rôle de production.',
		'context' => array('label' => 'Accès', 'value' => 'Administration'),
	)
);

if ($generatedLink !== '') {
	print '<div class="info">Lien E2E: <code>'.dol_escape_htmltag($generatedLink).'</code></div>';
}

print '<form method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php">';
print '<input type="hidden" name="token" value="'.newToken().'">';
print '<input type="hidden" name="action" value="invite">';
print '<table class="border centpercent">';
print '<tr><td><label for="mjl-login">Identifiant</label></td><td><input id="mjl-login" class="flat minwidth300" name="login" required></td></tr>';
print '<tr><td><label for="mjl-firstname">Prénom</label></td><td><input id="mjl-firstname" class="flat minwidth300" name="firstname" required></td></tr>';
print '<tr><td><label for="mjl-lastname">Nom</label></td><td><input id="mjl-lastname" class="flat minwidth300" name="lastname" required></td></tr>';
print '<tr><td><label for="mjl-email">Email</label></td><td><input id="mjl-email" class="flat minwidth300" type="email" name="email" required></td></tr>';
print '<tr><td><label for="mjl-role">Profil de production</label></td><td>'.mjl_access_role_select('role_code', 'AGENT_SAISIE', $roles).'</td></tr>';
print '</table>';
print '<div class="tabsAction"><button class="butAction" type="submit">Envoyer l’invitation</button></div>';
print '</form>';

print '<br>';
print load_fiche_titre('Utilisateurs MJL', '', '');
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><th>Utilisateur</th><th>Email</th><th>Statut</th><th>Profil</th><th>Actions</th></tr>';
foreach ($users as $row) {
	print '<tr class="oddeven">';
	print '<td>'.dol_escape_htmltag($row['login']).'</td>';
	print '<td>'.dol_escape_htmltag($row['email']).'</td>';
	print '<td>'.((int) $row['statut'] === 1 ? 'Actif' : 'Inactif').'</td>';
	print '<td>'.dol_escape_htmltag($row['role_label']).'</td>';
	print '<td>';
	print '<form method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php">';
	print '<input type="hidden" name="token" value="'.newToken().'">';
	print '<input type="hidden" name="action" value="update_profile">';
	print '<input type="hidden" name="user_id" value="'.((int) $row['rowid']).'">';
	if (!empty($row['native_admin'])) {
		print '<input type="hidden" name="role_code" value="ADMIN_PLATEFORME">';
		print '<span class="opacitymedium">Admin natif Dolibarr</span>';
	} else {
		print mjl_access_role_select('role_code', $row['role_code'] !== '' ? $row['role_code'] : 'AGENT_SAISIE', $roles);
	}
	print '<button class="button small" type="submit">Enregistrer</button>';
	print '</form>';
	if ((int) $row['statut'] === 1) {
		print '<form method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php">';
		print '<input type="hidden" name="token" value="'.newToken().'">';
		print '<input type="hidden" name="action" value="deactivate">';
		print '<input type="hidden" name="user_id" value="'.((int) $row['rowid']).'">';
		print '<button class="button small" type="submit">Désactiver</button>';
		print '</form>';
	}
	print '</td>';
	print '</tr>';
}
print '</table>';

print '<br>';
print load_fiche_titre('Invitations récentes', '', '');
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><th>Utilisateur</th><th>Email</th><th>Statut</th><th>Envoi</th><th>Expiration</th><th></th></tr>';
$sql = 'SELECT i.rowid, i.status, i.date_sent, i.date_expiry, u.login, u.email FROM '.$db->prefix().'mjlfinancement_invitation i';
$sql .= ' INNER JOIN '.$db->prefix().'user u ON u.rowid = i.fk_user';
$sql .= ' WHERE i.entity = '.mjl_auth_entity().' ORDER BY i.rowid DESC LIMIT 50';
$resql = $db->query($sql);
if ($resql) {
	while ($obj = $db->fetch_object($resql)) {
		print '<tr class="oddeven">';
		print '<td>'.dol_escape_htmltag($obj->login).'</td>';
		print '<td>'.dol_escape_htmltag($obj->email).'</td>';
		print '<td>'.dol_escape_htmltag($obj->status).'</td>';
		print '<td>'.dol_escape_htmltag($obj->date_sent).'</td>';
		print '<td>'.dol_escape_htmltag($obj->date_expiry).'</td>';
		print '<td>';
		if ($obj->status === 'sent') {
			print '<form method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php">';
			print '<input type="hidden" name="token" value="'.newToken().'">';
			print '<input type="hidden" name="action" value="revoke">';
			print '<input type="hidden" name="id" value="'.((int) $obj->rowid).'">';
			print '<button class="button small" type="submit">Révoquer</button>';
			print '</form>';
		}
		print '</td>';
		print '</tr>';
	}
}
print '</table>';

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_access_delete_failed_invitee($userId, User $actor)
{
	global $db;

	$target = new User($db);
	if ($target->fetch((int) $userId) <= 0 || (int) $target->entity !== mjl_auth_entity() || !empty($target->admin) || (int) $target->statut !== 0) {
		return false;
	}
	return $target->delete($actor) > 0;
}

function mjl_access_user_requires_recovery($userId)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'user recovery_user';
	$sql .= ' WHERE recovery_user.rowid = '.((int) $userId).' AND '.mjl_access_recovery_state_sql('recovery_user');
	return mjl_scope_scalar_int($sql) === 1;
}

function mjl_access_recovery_state_sql($userAlias)
{
	global $db;

	$userAlias = preg_replace('/[^A-Za-z0-9_]/', '', (string) $userAlias);
	return $userAlias.'.entity = '.mjl_auth_entity().' AND '.$userAlias.'.admin = 0 AND '.$userAlias.'.statut = 0'
		.' AND NOT EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_user_role recovery_role WHERE recovery_role.entity = '.$userAlias.'.entity AND recovery_role.fk_user = '.$userAlias.'.rowid)'
		.' AND NOT EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_invitation recovery_invitation WHERE recovery_invitation.entity = '.$userAlias.'.entity AND recovery_invitation.fk_user = '.$userAlias.'.rowid)';
}

function mjl_access_users()
{
	global $db;

	$rows = array();
	$sql = "SELECT u.rowid, u.login, u.email, u.statut, u.admin AS native_admin, CASE WHEN u.admin = 1 THEN 'ADMIN_PLATEFORME' ELSE r.role_code END AS role_code";
	$sql .= ', ('.mjl_access_recovery_state_sql('u').') AS recovery_required';
	$sql .= ' FROM '.$db->prefix().'user u';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_user_role r ON r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1';
	$sql .= ' WHERE u.entity = '.mjl_auth_entity().' AND (r.rowid IS NOT NULL OR EXISTS (SELECT 1 FROM '.$db->prefix().'usergroup_user ugu INNER JOIN '.$db->prefix()."usergroup ug ON ug.rowid = ugu.fk_usergroup AND ug.entity = u.entity WHERE ugu.fk_user = u.rowid AND ugu.entity = u.entity AND ug.nom LIKE 'MJL POC - %') OR u.admin = 1 OR (".mjl_access_recovery_state_sql('u').'))';
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

function mjl_access_role_select($name, $selected, array $roles)
{
	$html = '<select name="'.dol_escape_htmltag($name).'" required>';
	foreach ($roles as $code => $label) {
		$html .= '<option value="'.dol_escape_htmltag($code).'"'.($code === $selected ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	$html .= '</select>';
	return $html;
}
