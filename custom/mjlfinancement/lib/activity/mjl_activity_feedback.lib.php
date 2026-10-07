<?php

/** Convert a bounded result code into prepared presentation data. */
function mjl_activity_result_feedback(array $get)
{
	if (!isset($get['result']) || !is_scalar($get['result'])) return array();
	$messages = array(
		'OK' => array('success', 'Opération enregistrée', 'La fiche a été mise à jour.'),
		'INVALID_INPUT' => array('danger', 'Saisie non valide', 'Vérifiez les champs obligatoires, les montants et les Opérations, puis réessayez.'),
		'FORBIDDEN' => array('danger', 'Action non autorisée', 'Votre profil, votre affectation ou l’état actuel ne permet pas cette action.'),
		'NOT_FOUND' => array('danger', 'Activité introuvable', 'La fiche demandée n’existe plus dans cette entité.'),
		'STALE_VERSION' => array('warning', 'La fiche a changé', 'Rechargez la page avant de reprendre votre modification.'),
		'CONFLICT' => array('warning', 'Action impossible dans l’état actuel', 'Vérifiez le statut, la date de début et l’équilibre des montants.'),
		'RETRYABLE_CONFLICT' => array('warning', 'Conflit temporaire', 'Aucune modification n’a été enregistrée. Réessayez dans quelques instants.'),
		'MIGRATION_REQUIRED' => array('unavailable', 'Migration requise', 'Le suivi d’exécution est indisponible jusqu’à la migration RST-006B.'),
		'FAILED' => array('danger', 'Échec de l’enregistrement', 'Aucune modification n’a été enregistrée. Contactez l’administrateur si le problème persiste.'),
	);
	$code = (string) $get['result'];
	return $messages[$code] ?? array();
}
