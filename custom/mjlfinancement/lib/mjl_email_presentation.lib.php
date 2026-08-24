<?php

/** Plain-text transactional email presentation metadata. */
function mjl_email_templates()
{
	return array(
		'invitation' => array('subject' => 'Invitation à votre espace', 'title' => 'Invitation à votre espace MJL', 'message' => 'Vous êtes invité à accéder à l’espace MJL Financement.', 'action_label' => 'Définir mon mot de passe', 'security_note' => 'Si vous n’attendiez pas cette invitation, ignorez ce message et contactez l’administrateur.', 'status_label' => ''),
		'password_reset' => array('subject' => 'Réinitialisation du mot de passe', 'title' => 'Réinitialisation du mot de passe', 'message' => 'Une demande de réinitialisation du mot de passe a été reçue pour votre accès MJL.', 'action_label' => 'Choisir un nouveau mot de passe', 'security_note' => 'Si vous n’avez pas effectué cette demande, ignorez ce message.', 'status_label' => ''),
		'alert_deadline_approaching' => array('subject' => 'Échéance proche', 'title' => 'Échéance proche', 'message' => 'Une activité approche de son échéance et nécessite votre attention.', 'action_label' => 'Consulter l’alerte', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => ''),
		'alert_overdue_activity' => array('subject' => 'Activité en retard', 'title' => 'Activité en retard', 'message' => 'Une activité a dépassé son échéance et nécessite une action.', 'action_label' => 'Consulter l’alerte', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => ''),
	);
}
