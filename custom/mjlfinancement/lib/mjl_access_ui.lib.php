<?php

require_once __DIR__.'/mjl_form.lib.php';
require_once __DIR__.'/mjl_ui.lib.php';

/**
 * Presentation helpers for the Admin-only access screen.
 *
 * Authorization, data selection, invitation delivery, role eligibility, and
 * lifecycle mutations remain owned by the existing access/auth/scope code.
 */

function mjl_access_ui_role_select($name, $selected, array $roles, $id = '')
{
	$html = '<select'.($id !== '' ? ' id="'.mjl_ui_escape($id).'"' : '').' name="'.mjl_ui_escape($name).'" required>';
	foreach ($roles as $code => $label) {
		$html .= '<option value="'.mjl_ui_escape($code).'"'.($code === $selected ? ' selected' : '').'>'.mjl_ui_escape($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_access_ui_invitation_status($status)
{
	$statuses = array(
		'pending_send' => array('label' => 'En attente d’envoi', 'tone' => 'warning'),
		'sent' => array('label' => 'Envoyée', 'tone' => 'success'),
		'accepted' => array('label' => 'Acceptée', 'tone' => 'success'),
		'revoked' => array('label' => 'Révoquée', 'tone' => 'neutral'),
		'send_failed' => array('label' => 'Échec de l’envoi', 'tone' => 'danger'),
	);
	return isset($statuses[$status]) ? $statuses[$status] : array('label' => 'Statut non reconnu', 'tone' => 'warning');
}

function mjl_access_ui_invite_dialog(array $roles, $token, array $values = array(), $error = '')
{
	$login = isset($values['login']) ? (string) $values['login'] : '';
	$firstname = isset($values['firstname']) ? (string) $values['firstname'] : '';
	$lastname = isset($values['lastname']) ? (string) $values['lastname'] : '';
	$email = isset($values['email']) ? (string) $values['email'] : '';
	$role = isset($values['role_code']) && isset($roles[$values['role_code']]) ? $values['role_code'] : 'AGENT_SAISIE';
	$html = '<dialog class="mjl-modal-dialog mjl-access-dialog mjl-workflow-dialog" id="mjl-access-invite-dialog" open aria-labelledby="mjl-access-invite-title" data-mjl-access-invite-dialog'.($error !== '' ? ' data-mjl-open-on-load="true"' : '').'><div class="mjl-dialog-panel">';
	$html .= '<header class="mjl-section-heading"><div><p class="mjl-eyebrow">Nouvel accès</p><h2 id="mjl-access-invite-title">Inviter un utilisateur</h2><p>Créez un accès avec un seul profil de production. L’invitation suit le service d’envoi configuré.</p></div><button class="mjl-action mjl-action-secondary" type="button" data-mjl-access-invite-close>Fermer</button></header>';
	$html .= '<form class="mjl-activity-form mjl-access-invite-form" method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php" data-mjl-validate data-mjl-substantive>';
	$html .= '<input type="hidden" name="token" value="'.mjl_ui_escape($token).'"><input type="hidden" name="action" value="invite">';
	$html .= '<div class="mjl-reference-form-errors" data-mjl-form-errors>'.($error !== '' ? mjl_form_error_summary(array('_form' => $error), 'L’invitation n’a pas été envoyée', 'mjl-access-invite-', true) : '').'</div>';
	$html .= '<div class="mjl-access-form-grid">';
	$html .= mjl_form_field('login', 'Identifiant', '<input name="login" value="'.mjl_ui_escape($login).'" required autocomplete="username">', true, '', '', 'mjl-access-invite-');
	$html .= mjl_form_field('firstname', 'Prénom', '<input name="firstname" value="'.mjl_ui_escape($firstname).'" required autocomplete="given-name">', true, '', '', 'mjl-access-invite-');
	$html .= mjl_form_field('lastname', 'Nom', '<input name="lastname" value="'.mjl_ui_escape($lastname).'" required autocomplete="family-name">', true, '', '', 'mjl-access-invite-');
	$html .= mjl_form_field('email', 'Email', '<input type="email" name="email" value="'.mjl_ui_escape($email).'" required autocomplete="email">', true, '', '', 'mjl-access-invite-');
	$html .= mjl_form_field('role_code', 'Profil de production', mjl_access_ui_role_select('role_code', $role, $roles), true, 'Un utilisateur ne peut avoir qu’un seul profil de production actif.', '', 'mjl-access-invite-');
	$html .= '</div><div class="mjl-activity-form-actions"><button class="mjl-action mjl-action-primary" type="submit">Envoyer l’invitation</button></div></form></div></dialog>';
	return $html;
}

function mjl_access_ui_users(array $users, array $roles, $token)
{
	$html = '<section class="mjl-workspace-section mjl-access-panel" data-mjl-access-users><div class="mjl-section-heading"><div><h2>Utilisateurs MJL</h2><p>Profils de production et état actuel des accès.</p></div></div>';
	$html .= '<div class="div-table-responsive-no-min mjl-operational-table"><table class="noborder centpercent mjl-access-table" aria-label="Utilisateurs MJL"><thead><tr class="liste_titre"><th>Utilisateur</th><th>Statut</th><th>Profil</th><th class="right">Actions</th></tr></thead><tbody>';
	foreach ($users as $row) {
		$id = (int) $row['rowid'];
		$login = (string) $row['login'];
		$isAdmin = !empty($row['native_admin']);
		$isActive = (int) $row['statut'] === 1;
		$html .= '<tr class="oddeven mjl-row-interactive" data-access-user-row><td data-label="Utilisateur"><strong>'.mjl_ui_escape($login).'</strong><small>'.mjl_ui_escape($row['email']).'</small></td>';
		$html .= '<td data-label="Statut">'.mjl_ui_status_badge(array('label' => $isActive ? 'Actif' : 'Inactif', 'tone' => $isActive ? 'success' : 'neutral')).'</td>';
		$html .= '<td data-label="Profil"><strong>'.mjl_ui_escape($row['role_label']).'</strong>'.($isAdmin ? '<small>Compte technique conservé</small>' : '').'</td><td class="right" data-label="Actions">';
		if ($isAdmin) {
			$html .= '<span class="mjl-muted">Administrateur plateforme</span>';
		} else {
			$profileSource = 'mjl-access-profile-'.$id;
			$html .= '<div class="mjl-access-action-source" id="'.$profileSource.'" data-mjl-access-action-source><button class="mjl-action mjl-action-secondary mjl-access-action-trigger" type="button" data-mjl-access-action-open data-access-source="'.$profileSource.'" data-access-title="Modifier le profil" data-access-context="'.mjl_ui_escape($login).'" data-access-guidance="Le nouveau profil remplace le profil de production actif." data-access-confirm-label="Enregistrer">Modifier le profil</button>';
			$html .= '<form class="mjl-access-inline-form" method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php" data-mjl-substantive><input type="hidden" name="token" value="'.mjl_ui_escape($token).'"><input type="hidden" name="action" value="update_profile"><input type="hidden" name="user_id" value="'.$id.'"><label for="mjl-access-role-'.$id.'">Profil de production</label>'.mjl_access_ui_role_select('role_code', $row['role_code'] !== '' ? $row['role_code'] : 'AGENT_SAISIE', $roles, 'mjl-access-role-'.$id).'<button class="mjl-action mjl-action-primary" type="submit">Enregistrer</button></form></div>';
			if ($isActive) {
				$deactivateSource = 'mjl-access-deactivate-'.$id;
				$html .= '<div class="mjl-access-action-source" id="'.$deactivateSource.'" data-mjl-access-action-source><button class="mjl-action mjl-action-danger mjl-access-action-trigger" type="button" data-mjl-access-action-open data-access-source="'.$deactivateSource.'" data-access-title="Désactiver l’utilisateur" data-access-context="'.mjl_ui_escape($login).'" data-access-guidance="L’accès sera désactivé et les réinitialisations en attente seront révoquées." data-access-confirm-label="Confirmer la désactivation">Désactiver</button><form class="mjl-access-inline-form" method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php"><input type="hidden" name="token" value="'.mjl_ui_escape($token).'"><input type="hidden" name="action" value="deactivate"><input type="hidden" name="user_id" value="'.$id.'"><button class="mjl-action mjl-action-danger" type="submit">Désactiver</button></form></div>';
			}
		}
		$html .= '</td></tr>';
	}
	return $html.'</tbody></table></div></section>';
}

function mjl_access_ui_invitations(array $invitations, $token)
{
	$html = '<section class="mjl-workspace-section mjl-access-panel" data-mjl-access-invitations><div class="mjl-section-heading"><div><h2>Invitations récentes</h2><p>Résultats réels du service d’envoi et échéances des invitations.</p></div></div>';
	if (empty($invitations)) return $html.mjl_ui_system_state('initial-empty', 'Aucune invitation', 'Aucune invitation n’a encore été créée.').'</section>';
	$html .= '<div class="div-table-responsive-no-min mjl-operational-table"><table class="noborder centpercent mjl-access-table" aria-label="Invitations récentes"><thead><tr class="liste_titre"><th>Utilisateur</th><th>Statut</th><th>Envoi</th><th>Expiration</th><th class="right">Actions</th></tr></thead><tbody>';
	foreach ($invitations as $row) {
		$id = (int) $row['rowid'];
		$login = (string) $row['login'];
		$status = (string) $row['status'];
		$html .= '<tr class="oddeven mjl-row-interactive" data-access-invitation-row><td data-label="Utilisateur"><strong>'.mjl_ui_escape($login).'</strong><small>'.mjl_ui_escape($row['email']).'</small></td><td data-label="Statut">'.mjl_ui_status_badge(mjl_access_ui_invitation_status($status)).'</td><td data-label="Envoi">'.mjl_ui_escape(mjl_format_date($row['date_sent'], 'datetime')).'</td><td data-label="Expiration">'.mjl_ui_escape(mjl_format_date($row['date_expiry'], 'datetime')).'</td><td class="right" data-label="Actions">';
		if ($status === 'sent') {
			$source = 'mjl-access-revoke-'.$id;
			$html .= '<div class="mjl-access-action-source" id="'.$source.'" data-mjl-access-action-source><button class="mjl-action mjl-action-danger mjl-access-action-trigger" type="button" data-mjl-access-action-open data-access-source="'.$source.'" data-access-title="Révoquer l’invitation" data-access-context="'.mjl_ui_escape($login).'" data-access-guidance="Le lien d’invitation ne pourra plus être utilisé." data-access-confirm-label="Confirmer la révocation">Révoquer</button><form class="mjl-access-inline-form" method="post" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php"><input type="hidden" name="token" value="'.mjl_ui_escape($token).'"><input type="hidden" name="action" value="revoke"><input type="hidden" name="id" value="'.$id.'"><button class="mjl-action mjl-action-danger" type="submit">Révoquer</button></form></div>';
		} else {
			$html .= '<span class="mjl-muted">Aucune action</span>';
		}
		$html .= '</td></tr>';
	}
	return $html.'</tbody></table></div></section>';
}

function mjl_access_ui_action_dialog()
{
	return '<dialog class="mjl-modal-dialog mjl-access-dialog mjl-workflow-dialog" id="mjl-access-action-dialog" aria-labelledby="mjl-access-action-title" data-mjl-access-action-dialog><div class="mjl-dialog-panel"><header class="mjl-section-heading"><div><p class="mjl-eyebrow">Gestion de l’accès</p><h2 id="mjl-access-action-title" data-access-dialog-title>Modifier l’accès</h2><p data-access-dialog-context></p></div><button class="mjl-action mjl-action-secondary" type="button" data-mjl-access-action-close>Fermer</button></header><div class="mjl-system-state mjl-system-state-warning mjl-access-action-guidance" role="status" data-access-dialog-guidance></div><div data-access-dialog-form></div></div></dialog>';
}
