<?php

/** Presentation-only status registry. Stored codes and audit/export values stay unchanged. */
function mjl_status_presentation($objectType, $status, $surface = 'operational')
{
	$aliases = array(
		'mjlfinancement_activity' => 'activity',
		'mjlfinancement_expense' => 'expense',
		'mjlfinancement_convention' => 'convention',
		'mjlfinancement_budget_line' => 'budget_line',
		'mjlfinancement_fund_receipt' => 'fund_receipt',
	);
	$objectType = (string) $objectType;
	if (isset($aliases[$objectType])) $objectType = $aliases[$objectType];
	$surface = in_array((string) $surface, array('operational', 'history'), true) ? (string) $surface : 'operational';
	$key = (string) $status;
	if ($key === '') return array('label' => 'Statut non renseigné', 'tone' => 'neutral');

	$maps = array(
		'activity' => array(
			'0' => array('Brouillon', 'neutral'), 'draft' => array('Brouillon', 'neutral'),
			'1' => array('En cours', 'info'), 'ongoing' => array('En cours', 'info'),
			'2' => array('Terminée', 'success'), 'completed' => array('Terminée', 'success'),
			'3' => array('Soumise', 'warning'), 'submitted' => array('Soumise', 'warning'),
			'4' => array('Correction demandée', 'danger'), 'correction_requested' => array('Correction demandée', 'danger'),
			'5' => array('Corrigée', 'warning'), 'corrected' => array('Corrigée', 'warning'),
			'6' => array('Validée définitivement', 'success'), 'validated' => array('Validée définitivement', 'success'), 'final_validated' => array('Validée définitivement', 'success'),
			'7' => array('Prévalidée', 'warning'), 'prevalidated' => array('Prévalidée', 'warning'),
			'8' => array('Rejetée', 'danger'), 'rejected' => array('Rejetée', 'danger'),
			'9' => array('Annulée', 'neutral'), 'cancelled' => array('Annulée', 'neutral'),
		),
		'activity_execution' => array(
			'not_started' => array('Planifiée', 'neutral'), 'in_progress' => array('En cours', 'info'),
			'blocked' => array('Bloquée', 'danger'), 'completed' => array('Exécutée', 'success'),
		),
		'expense' => array(
			'0' => array('Brouillon', 'neutral'), 'draft' => array('Brouillon', 'neutral'),
			'1' => array('Soumise', 'warning'), 'submitted' => array('Soumise', 'warning'),
			'2' => array($surface === 'history' ? 'Validation enregistrée' : 'Validée définitivement', 'success'),
			'legacy_validated' => array($surface === 'history' ? 'Validation enregistrée' : 'Validée définitivement', 'success'),
			'validated' => array($surface === 'history' ? 'Validation enregistrée' : 'Validée définitivement', 'success'),
			'3' => array('Corrigée', 'warning'), 'corrected' => array('Corrigée', 'warning'),
			'4' => array('Prévalidée', 'warning'), 'prevalidated' => array('Prévalidée', 'warning'),
			'6' => array('Validée définitivement', 'success'), 'final_validated' => array('Validée définitivement', 'success'),
			'7' => array('Décaissée', 'success'), 'disbursed' => array('Décaissée', 'success'),
			'8' => array('Rejetée', 'danger'), 'rejected' => array('Rejetée', 'danger'),
		),
		'convention' => array('0' => array('Brouillon', 'neutral'), 'draft' => array('Brouillon', 'neutral'), '1' => array('Active', 'success'), 'active' => array('Active', 'success'), '2' => array('Clôturée', 'neutral'), 'closed' => array('Clôturée', 'neutral')),
		'budget_line' => array('0' => array('Brouillon', 'neutral'), 'draft' => array('Brouillon', 'neutral'), '1' => array('Active', 'success'), 'active' => array('Active', 'success'), 'closed' => array('Clôturée', 'neutral')),
		'fund_receipt' => array('0' => array('Brouillon', 'neutral'), 'draft' => array('Brouillon', 'neutral'), '1' => array('Reçu', 'success'), 'received' => array('Reçu', 'success'), '8' => array('Non reçu', 'danger'), 'not_received' => array('Non reçu', 'danger')),
	);
	if (!isset($maps[$objectType][$key])) return array('label' => 'Statut non reconnu', 'tone' => 'neutral');
	return array('label' => $maps[$objectType][$key][0], 'tone' => $maps[$objectType][$key][1]);
}
