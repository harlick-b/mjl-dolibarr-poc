<?php

/** Plain-text transactional email presentation metadata. */
function mjl_email_templates()
{
	return array(
		'invitation' => array('subject' => 'Invitation à votre espace', 'title' => 'Invitation à votre espace MJL', 'message' => 'Vous êtes invité à accéder à l’espace MJL Financement.', 'action_label' => 'Définir mon mot de passe', 'security_note' => 'Si vous n’attendiez pas cette invitation, ignorez ce message et contactez l’administrateur.', 'status_label' => ''),
		'password_reset' => array('subject' => 'Réinitialisation du mot de passe', 'title' => 'Réinitialisation du mot de passe', 'message' => 'Une demande de réinitialisation du mot de passe a été reçue pour votre accès MJL.', 'action_label' => 'Choisir un nouveau mot de passe', 'security_note' => 'Si vous n’avez pas effectué cette demande, ignorez ce message.', 'status_label' => ''),
		'activity_submitted' => array('subject' => 'Activité à examiner', 'title' => 'Activité à examiner', 'message' => 'Une activité liée à un projet à financement extérieur attend une décision.', 'action_label' => 'Examiner l’activité', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => 'Soumise'),
		'activity_correction_requested' => array('subject' => 'Correction demandée', 'title' => 'Correction demandée', 'message' => 'Une correction est demandée sur une activité que vous avez soumise.', 'action_label' => 'Corriger l’activité', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => 'Correction demandée'),
		'activity_prevalidated' => array('subject' => 'Activité prévalidée', 'title' => 'Activité prévalidée', 'message' => 'Une activité a été prévalidée et attend la validation définitive.', 'action_label' => 'Examiner l’activité', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => 'Prévalidée'),
		'activity_validated' => array('subject' => 'Activité validée', 'title' => 'Activité validée définitivement', 'message' => 'Une activité que vous avez soumise a été validée définitivement.', 'action_label' => 'Consulter l’activité', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => 'Validée définitivement'),
		'activity_rejected' => array('subject' => 'Activité rejetée', 'title' => 'Activité rejetée', 'message' => 'Une activité que vous avez soumise a été rejetée.', 'action_label' => 'Consulter la décision', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => 'Rejetée'),
		'alert_deadline_approaching' => array('subject' => 'Échéance proche', 'title' => 'Échéance proche', 'message' => 'Une activité approche de son échéance et nécessite votre attention.', 'action_label' => 'Consulter l’alerte', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => ''),
		'alert_overdue_activity' => array('subject' => 'Activité en retard', 'title' => 'Activité en retard', 'message' => 'Une activité a dépassé son échéance et nécessite une action.', 'action_label' => 'Consulter l’alerte', 'security_note' => 'Si vous n’êtes pas concerné par ce message, contactez l’administrateur.', 'status_label' => ''),
	);
}
