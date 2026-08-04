<?php

/**
 * Storage-only labels used by supplemental-document workflow audit rows.
 *
 * These values preserve the legacy persisted bytes. Presentation registries
 * must not be imported here because display wording can evolve independently.
 */
function mjl_document_audit_status_label($objectType, $status)
{
	$maps = array(
		'mjlfinancement_activity' => array(
			'0' => 'Brouillon',
			'1' => 'En cours',
			'2' => 'Terminée',
			'3' => 'Soumise',
			'4' => 'Correction demandée',
			'5' => 'Corrigée',
			'6' => 'Validée définitivement',
			'7' => 'Prévalidée',
			'8' => 'Rejetée',
			'9' => 'Annulée',
		),
		'mjlfinancement_convention' => array(
			'0' => 'Brouillon',
			'1' => 'Active',
			'2' => 'Clôturée',
		),
	);
	$objectType = (string) $objectType;
	$key = (string) $status;
	return isset($maps[$objectType][$key]) ? $maps[$objectType][$key] : 'Statut non reconnu';
}
