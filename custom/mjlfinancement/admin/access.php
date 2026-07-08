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
		$error = 'Jeton de securite invalide.';
	} elseif ($action === 'invite') {
		$roleCode = GETPOST('role_code', 'aZ09');
		$scopeIds = mjl_access_post_scope_ids();
		$result = mjl_auth_create_or_update_user(
			GETPOST('login', 'alphanohtml'),
			GETPOST('firstname', 'restricthtml'),
			GETPOST('lastname', 'restricthtml'),
			GETPOST('email', 'restricthtml'),
			0,
			$user
		);
		if ($result[0] < 0) {
			$error = $result[1];
		} else {
			$profile = mjl_scope_assign_access_profile($result[0], $roleCode, $scopeIds, $user, mjl_auth_entity(), 'admin_access', 'Invitation administrateur');
			if ($profile[0] < 0) {
				$error = $profile[1];
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
		$profile = mjl_scope_assign_access_profile($targetUserId, GETPOST('role_code', 'aZ09'), mjl_access_post_scope_ids(), $user, mjl_auth_entity(), 'admin_access', 'Modification administrateur');
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
}

$roles = mjl_scope_role_labels();
$partners = mjl_access_partner_options();
$users = mjl_access_users();

llxHeader('', 'Gestion des acces MJL');
mjl_navigation_shell_start($user, 'admin_access');
print '<div class="mjl-workspace">';
print load_fiche_titre('Gestion des acces MJL', '', 'user');

if ($message !== '') {
	print '<div class="ok">'.dol_escape_htmltag($message).'</div>';
}
if ($error !== '') {
	print '<div class="error">'.dol_escape_htmltag($error).'</div>';
}
if ($generatedLink !== '') {
	print '<div class="info">Lien E2E: <code>'.dol_escape_htmltag($generatedLink).'</code></div>';
}

print '<form method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php">';
print '<input type="hidden" name="token" value="'.newToken().'">';
print '<input type="hidden" name="action" value="invite">';
print '<table class="border centpercent">';
print '<tr><td><label for="mjl-login">Identifiant</label></td><td><input id="mjl-login" class="flat minwidth300" name="login" required></td></tr>';
print '<tr><td><label for="mjl-firstname">Prenom</label></td><td><input id="mjl-firstname" class="flat minwidth300" name="firstname" required></td></tr>';
print '<tr><td><label for="mjl-lastname">Nom</label></td><td><input id="mjl-lastname" class="flat minwidth300" name="lastname" required></td></tr>';
print '<tr><td><label for="mjl-email">Email</label></td><td><input id="mjl-email" class="flat minwidth300" type="email" name="email" required></td></tr>';
print '<tr><td><label for="mjl-role">Profil de production</label></td><td>'.mjl_access_role_select('role_code', 'AGENT_SAISIE', $roles).'</td></tr>';
print '<tr><td><label for="mjl-scope">Partenaires / programmes</label></td><td>'.mjl_access_scope_select($partners, array()).'</td></tr>';
print '</table>';
print '<div class="tabsAction"><button class="butAction" type="submit">Envoyer l invitation</button></div>';
print '</form>';

print '<br>';
print load_fiche_titre('Utilisateurs MJL', '', '');
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><th>Utilisateur</th><th>Email</th><th>Statut</th><th>Profil</th><th>Perimetre</th><th>Actions</th></tr>';
foreach ($users as $row) {
	$currentScopes = mjl_access_user_scope_ids((int) $row['rowid']);
	print '<tr class="oddeven">';
	print '<td>'.dol_escape_htmltag($row['login']).'</td>';
	print '<td>'.dol_escape_htmltag($row['email']).'</td>';
	print '<td>'.((int) $row['statut'] === 1 ? 'Actif' : 'Inactif').'</td>';
	print '<td>'.dol_escape_htmltag($row['role_label']).'</td>';
	print '<td>'.dol_escape_htmltag(mjl_access_scope_summary($currentScopes, $partners, $row['role_code'])).'</td>';
	print '<td>';
	print '<form method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php">';
	print '<input type="hidden" name="token" value="'.newToken().'">';
	print '<input type="hidden" name="action" value="update_profile">';
	print '<input type="hidden" name="user_id" value="'.((int) $row['rowid']).'">';
	print mjl_access_role_select('role_code', $row['role_code'] !== '' ? $row['role_code'] : 'AGENT_SAISIE', $roles);
	print mjl_access_scope_select($partners, $currentScopes);
	print '<button class="button small" type="submit">Enregistrer</button>';
	print '</form>';
	if ((int) $row['statut'] === 1) {
		print '<form method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php">';
		print '<input type="hidden" name="token" value="'.newToken().'">';
		print '<input type="hidden" name="action" value="deactivate">';
		print '<input type="hidden" name="user_id" value="'.((int) $row['rowid']).'">';
		print '<button class="button small" type="submit">Desactiver</button>';
		print '</form>';
	}
	print '</td>';
	print '</tr>';
}
print '</table>';

print '<br>';
print load_fiche_titre('Invitations recentes', '', '');
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
			print '<button class="button small" type="submit">Revoquer</button>';
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

function mjl_access_post_scope_ids()
{
	$values = isset($_POST['scope_soc_ids']) && is_array($_POST['scope_soc_ids']) ? $_POST['scope_soc_ids'] : array();
	return array_values(array_unique(array_map('intval', $values)));
}

function mjl_access_partner_options()
{
	global $db;

	$options = array();
	$sql = 'SELECT rowid, nom FROM '.$db->prefix().'societe WHERE entity = '.mjl_auth_entity().' ORDER BY nom';
	$resql = $db->query($sql);
	if ($resql) {
		while ($obj = $db->fetch_object($resql)) {
			$options[(int) $obj->rowid] = $obj->nom;
		}
	}
	return $options;
}

function mjl_access_users()
{
	global $db;

	$rows = array();
	$sql = 'SELECT u.rowid, u.login, u.email, u.statut, r.role_code';
	$sql .= ' FROM '.$db->prefix().'user u';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_user_role r ON r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1';
	$sql .= ' WHERE u.entity = '.mjl_auth_entity().' AND (r.rowid IS NOT NULL OR EXISTS (SELECT 1 FROM '.$db->prefix().'usergroup_user ugu INNER JOIN '.$db->prefix()."usergroup ug ON ug.rowid = ugu.fk_usergroup AND ug.entity = u.entity WHERE ugu.fk_user = u.rowid AND ugu.entity = u.entity AND ug.nom LIKE 'MJL POC - %') OR u.admin = 1)";
	$sql .= ' ORDER BY u.login';
	$resql = $db->query($sql);
	if ($resql) {
		while ($obj = $db->fetch_object($resql)) {
			$row = (array) $obj;
			$row['role_label'] = $row['role_code'] !== null && $row['role_code'] !== '' ? mjl_scope_role_label($row['role_code']) : 'Profil legacy non resolu';
			$rows[] = $row;
		}
	}
	return $rows;
}

function mjl_access_user_scope_ids($userId)
{
	global $db;

	$ids = array();
	$sql = 'SELECT fk_soc FROM '.$db->prefix().'mjlfinancement_user_soc_scope WHERE entity = '.mjl_auth_entity().' AND fk_user = '.((int) $userId).' AND is_active = 1 ORDER BY fk_soc';
	$resql = $db->query($sql);
	if ($resql) {
		while ($obj = $db->fetch_object($resql)) {
			$ids[] = (int) $obj->fk_soc;
		}
	}
	return $ids;
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

function mjl_access_scope_select(array $partners, array $selected)
{
	$html = '<select id="mjl-scope" name="scope_soc_ids[]" multiple size="6">';
	foreach ($partners as $id => $name) {
		$html .= '<option value="'.((int) $id).'"'.(in_array((int) $id, $selected, true) ? ' selected' : '').'>'.dol_escape_htmltag($name).'</option>';
	}
	$html .= '</select>';
	return $html;
}

function mjl_access_scope_summary(array $scopeIds, array $partners, $roleCode)
{
	if ($roleCode === 'ADMIN_PLATEFORME') {
		return 'Tous les perimetres';
	}
	if (empty($scopeIds)) {
		return 'Aucun perimetre actif';
	}
	$labels = array();
	foreach ($scopeIds as $id) {
		$labels[] = isset($partners[$id]) ? $partners[$id] : '#'.$id;
	}
	return implode(', ', $labels);
}
