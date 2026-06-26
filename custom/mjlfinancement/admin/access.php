<?php

require '../../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

if (empty($user->admin)) {
	accessforbidden();
}

$action = GETPOST('action', 'aZ09');
$message = '';
$error = '';
$generatedLink = '';

if ($action === 'invite') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		$error = 'Jeton de securite invalide.';
	} else {
		$result = mjl_auth_create_or_update_user(
			GETPOST('login', 'alphanohtml'),
			GETPOST('firstname', 'restricthtml'),
			GETPOST('lastname', 'restricthtml'),
			GETPOST('email', 'restricthtml'),
			GETPOSTINT('group_id'),
			$user
		);
		if ($result[0] < 0) {
			$error = $result[1];
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
}

if ($action === 'revoke') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		$error = 'Jeton de securite invalide.';
	} else {
		$invitationId = GETPOSTINT('id');
		$sql = 'UPDATE '.$db->prefix()."mjlfinancement_invitation SET status = 'revoked', date_revoked = '".$db->idate(dol_now())."', fk_user_revoked = ".((int) $user->id);
		$sql .= ' WHERE rowid = '.$invitationId.' AND entity = '.mjl_auth_entity();
		if ($db->query($sql)) {
			$message = 'Invitation revoquee.';
			mjl_auth_record_event('invitation_revoked', null, (int) $user->id, 'invitation='.$invitationId);
		} else {
			$error = $db->lasterror();
		}
	}
}

$groups = mjl_auth_groups();

llxHeader('', 'Gestion des acces MJL');
print load_fiche_titre('Gestion des acces MJL', '', 'user');

if ($message !== '') {
	print '<div class="ok">'.$message.'</div>';
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
print '<tr><td><label for="mjl-group">Profil MJL</label></td><td><select id="mjl-group" name="group_id" required>';
foreach ($groups as $groupId => $groupName) {
	print '<option value="'.((int) $groupId).'">'.dol_escape_htmltag($groupName).'</option>';
}
print '</select></td></tr>';
print '</table>';
print '<div class="tabsAction"><button class="butAction" type="submit">Envoyer l invitation</button></div>';
print '</form>';

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

llxFooter();
$db->close();
