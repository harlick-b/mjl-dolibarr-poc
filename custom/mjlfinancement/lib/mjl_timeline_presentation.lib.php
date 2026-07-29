<?php

/**
 * Presentation-only vocabulary for normal timeline and audit UI.
 *
 * Persistence and official export formatters must not depend on this module.
 */
function mjl_timeline_presentation_action_label($objectType, $action)
{
	$action = (string) $action;
	if ($action === '') return 'Événement non renseigné';

	$labels = array(
		'created' => 'Création',
		'field_changed' => 'Modification',
		'execution_updated' => 'Exécution mise à jour',
		'document_uploaded' => 'Document ajouté',
		'document_downloaded' => 'Document téléchargé',
		'proof_uploaded' => 'Preuve ajoutée',
		'unsafe_edit_rejected' => 'Modification refusée',
		'received' => 'Réception',
		'not_received' => 'Non-réception',
		'submitted' => 'Soumission',
		'correction_requested' => 'Correction demandée',
		'corrected' => 'Correction',
		'prevalidated' => 'Prévalidation',
		'validated' => 'Validation définitive',
		'legacy_validated' => 'Validation définitive',
		'final_validated' => 'Validation définitive',
		'disbursed' => 'Décaissement',
		'rejected' => 'Rejet',
		'deleted' => 'Suppression',
		'activated' => 'Activation',
		'closed' => 'Clôture',
		'note_added' => 'Commentaire ajouté',
		'export_generated' => 'Export généré',
	);
	if ((string) $objectType === 'mjlfinancement_expense') {
		if ($action === 'document_uploaded') return 'Pièce justificative ajoutée';
		if (in_array($action, array('validated', 'legacy_validated'), true)) return 'Validation enregistrée';
	}
	return isset($labels[$action]) ? $labels[$action] : 'Événement non reconnu';
}

function mjl_timeline_presentation_actor_role_label($objectType, $action, $role)
{
	$role = (string) $role;
	if ($role === '') return 'Rôle non renseigné';

	$labels = array(
		'AGENT' => 'Agent de saisie',
		'AGENT_SAISIE' => 'Agent de saisie',
		'SUPERVISEUR_N1' => 'Agent vérificateur',
		'SUPERVISEUR_N2' => 'Agent vérificateur',
		'AGENT_VERIFICATEUR' => 'Agent vérificateur',
		'VALIDATEUR_DEFINITIF' => 'Validateur définitif',
		'ADMIN' => 'Administrateur plateforme',
		'ADMIN_PLATEFORME' => 'Administrateur plateforme',
	);
	if (isset($labels[$role])) return $labels[$role];
	if ($role === 'DPAF') {
		$activityActions = array('validated', 'final_validated', 'rejected', 'correction_requested');
		$expenseActions = array('validated', 'legacy_validated', 'final_validated', 'disbursed', 'rejected');
		if ((string) $objectType === 'mjlfinancement_activity' && in_array((string) $action, $activityActions, true)) return 'Validateur définitif';
		if ((string) $objectType === 'mjlfinancement_expense' && in_array((string) $action, $expenseActions, true)) return 'Validateur définitif';
		return 'Rôle historique non résolu';
	}
	if (in_array($role, array('N1', 'N2', 'LEGACY'), true)) return 'Rôle historique non résolu';
	return 'Rôle non reconnu';
}

function mjl_timeline_presentation_object_label($objectType)
{
	$objectType = (string) $objectType;
	if ($objectType === '') return 'Objet non renseigné';
	$labels = array(
		'mjlfinancement_project' => 'Projet',
		'mjlfinancement_activity' => 'Activité',
		'mjlfinancement_expense' => 'Dépense',
		'mjlfinancement_convention' => 'Enveloppe de financement',
		'mjlfinancement_budget_line' => 'Ligne budgétaire',
		'mjlfinancement_fund_receipt' => 'Fonds reçu',
		'mjlfinancement_report' => 'Rapport / export',
	);
	return isset($labels[$objectType]) ? $labels[$objectType] : 'Objet non reconnu';
}

function mjl_timeline_presentation_channel_label($channel)
{
	$channel = (string) $channel;
	if ($channel === '') return 'Canal non renseigné';
	$labels = array(
		'commentaire' => 'Commentaire',
		'email' => 'Email',
		'telephone' => 'Téléphone',
		'reunion' => 'Réunion',
		'courrier' => 'Courrier',
		'autre' => 'Autre',
	);
	return isset($labels[$channel]) ? $labels[$channel] : 'Canal non reconnu';
}

function mjl_timeline_presentation_status_label($objectType, $status)
{
	$objectType = (string) $objectType;
	$status = (string) $status;
	if ($status === '') return 'Statut non renseigné';
	if ($objectType === 'mjlfinancement_expense' && in_array($status, array('validated', 'legacy_validated'), true)) {
		return 'Validation enregistrée';
	}

	$common = array(
		'draft' => 'Brouillon',
		'active' => 'Active',
		'closed' => 'Clôturée',
		'deleted' => 'Supprimée',
		'submitted' => 'Soumise',
		'prevalidated' => 'Prévalidée',
		'validated' => 'Validée définitivement',
		'legacy_validated' => 'Validée définitivement',
		'final_validated' => 'Validée définitivement',
		'rejected' => 'Rejetée',
		'corrected' => 'Corrigée',
		'correction_requested' => 'Correction demandée',
		'completed' => 'Terminée',
		'cancelled' => 'Annulée',
		'received' => 'Reçu',
		'not_received' => 'Non reçu',
		'Brouillon' => 'Brouillon',
		'Active' => 'Active',
		'Cloturee' => 'Clôturée',
		'Clôturée' => 'Clôturée',
		'Projet cree' => 'Projet créé',
		'Projet créé' => 'Projet créé',
		'Projet mis a jour' => 'Projet mis à jour',
		'Projet mis à jour' => 'Projet mis à jour',
		'Note projet' => 'Note projet',
		'Document telecharge' => 'Document téléchargé',
		'Document téléchargé' => 'Document téléchargé',
		'Export csv' => 'Export CSV',
		'Export CSV' => 'Export CSV',
		'Export xlsx' => 'Export XLSX',
		'Export XLSX' => 'Export XLSX',
	);
	if (isset($common[$status])) return $common[$status];

	if ($objectType === 'mjlfinancement_activity') {
		$labels = array(
			'0' => 'Brouillon', '1' => 'En cours', '2' => 'Terminée', '3' => 'Soumise',
			'4' => 'Correction demandée', '5' => 'Corrigée', '6' => 'Validée définitivement',
			'7' => 'Prévalidée', '8' => 'Rejetée', '9' => 'Annulée',
			'ongoing' => 'En cours', 'En cours' => 'En cours', 'Terminée' => 'Terminée',
			'Soumise' => 'Soumise', 'Correction demandée' => 'Correction demandée',
			'Corrigée' => 'Corrigée', 'Validée définitivement' => 'Validée définitivement',
			'Prévalidée' => 'Prévalidée', 'Rejetée' => 'Rejetée', 'Annulée' => 'Annulée',
		);
		if (isset($labels[$status])) return $labels[$status];
	}
	if ($objectType === 'mjlfinancement_expense') {
		$labels = array(
			'0' => 'Brouillon', '1' => 'Soumise', '2' => 'Validation enregistrée',
			'3' => 'Corrigée', '4' => 'Prévalidée', '6' => 'Validée définitivement',
			'7' => 'Décaissée', '8' => 'Rejetée', 'Décaissée' => 'Décaissée',
		);
		if (isset($labels[$status])) return $labels[$status];
	}
	if ($objectType === 'mjlfinancement_convention') {
		$labels = array('0' => 'Brouillon', '1' => 'Active', '2' => 'Clôturée');
		if (isset($labels[$status])) return $labels[$status];
	}
	if ($objectType === 'mjlfinancement_budget_line') {
		$labels = array('0' => 'Brouillon', '1' => 'Active');
		if (isset($labels[$status])) return $labels[$status];
	}
	if ($objectType === 'mjlfinancement_fund_receipt') {
		$labels = array('0' => 'Brouillon', '1' => 'Reçu', '8' => 'Non reçu');
		if (isset($labels[$status])) return $labels[$status];
	}
	return 'Statut non reconnu';
}
