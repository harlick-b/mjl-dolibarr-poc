<?php

require_once __DIR__.'/mjl_presentation.lib.php';

function mjl_alert_presentation_registry()
{
	return array(
		'activity_overdue' => array('severity' => 'Échéance dépassée', 'tone' => 'danger', 'audience' => 'Agent de saisie', 'expected_action' => 'Examiner l’échéance et confirmer la prochaine action.', 'route' => 'activities.php', 'priority' => 10),
		'activity_deadline_soon' => array('severity' => 'Échéance proche', 'tone' => 'warning', 'audience' => 'Agent de saisie', 'expected_action' => 'Examiner l’échéance et confirmer la prochaine action.', 'route' => 'activities.php', 'priority' => 90),
		'activity_awaiting_prevalidation' => array('severity' => 'Décision attendue', 'tone' => 'warning', 'audience' => 'Agent vérificateur et prévalidateur', 'expected_action' => 'Prévalider l’activité ou demander une correction.', 'route' => 'activities.php', 'priority' => 60),
		'activity_awaiting_final_validation' => array('severity' => 'Décision attendue', 'tone' => 'warning', 'audience' => 'Validateur définitif', 'expected_action' => 'Valider définitivement l’activité ou demander une correction.', 'route' => 'activities.php', 'priority' => 60),
		'activity_returned_for_correction' => array('severity' => 'Correction demandée', 'tone' => 'danger', 'audience' => 'Agent de saisie', 'expected_action' => 'Corriger l’activité, puis la soumettre à nouveau.', 'route' => 'activities.php', 'priority' => 50),
		'activity_stale_execution' => array('severity' => 'Exécution à actualiser', 'tone' => 'warning', 'audience' => 'Agent de saisie', 'expected_action' => 'Mettre à jour l’exécution physique de l’activité.', 'route' => 'activities.php', 'priority' => 80),
		'expense_awaiting_prevalidation' => array('severity' => 'Décision attendue', 'tone' => 'warning', 'audience' => 'Agent vérificateur et prévalidateur', 'expected_action' => 'Contrôler la dépense, puis la prévalider ou la rejeter.', 'route' => 'expenses.php', 'priority' => 60),
		'expense_awaiting_final_validation' => array('severity' => 'Décision attendue', 'tone' => 'warning', 'audience' => 'Validateur définitif', 'expected_action' => 'Valider définitivement la dépense ou la rejeter.', 'route' => 'expenses.php', 'priority' => 60),
		'expense_returned_for_correction' => array('severity' => 'Correction demandée', 'tone' => 'danger', 'audience' => 'Agent de saisie', 'expected_action' => 'Corriger la dépense rejetée, puis la soumettre à nouveau.', 'route' => 'expenses.php', 'priority' => 50),
		'expense_missing_document' => array('severity' => 'Pièce justificative manquante', 'tone' => 'danger', 'audience' => 'Agent de saisie', 'expected_action' => 'Ajouter une pièce justificative disponible avant validation.', 'route' => 'expenses.php', 'priority' => 30),
		'expense_exceeds_budget' => array('severity' => 'Budget dépassé', 'tone' => 'danger', 'audience' => 'Agent de saisie', 'expected_action' => 'Corriger la dépense avant de la soumettre.', 'route' => 'expenses.php', 'priority' => 20),
		'expense_validated_not_disbursed' => array('severity' => 'Décaissement attendu', 'tone' => 'warning', 'audience' => 'Validateur définitif', 'expected_action' => 'Enregistrer le décaissement si le paiement a été effectué.', 'route' => 'expenses.php', 'priority' => 70),
		'budget_warning' => array('severity' => 'Budget sous surveillance', 'tone' => 'warning', 'audience' => 'Validateur définitif', 'expected_action' => 'Vérifier la consommation validée de la ligne budgétaire.', 'route' => 'budgetlines.php', 'priority' => 100),
		'budget_critical' => array('severity' => 'Budget critique', 'tone' => 'danger', 'audience' => 'Validateur définitif', 'expected_action' => 'Vérifier la consommation validée de la ligne budgétaire.', 'route' => 'budgetlines.php', 'priority' => 25),
		'funding_envelope_near_end' => array('severity' => 'Fin proche', 'tone' => 'warning', 'audience' => 'Validateur définitif', 'expected_action' => 'Vérifier la clôture ou la prolongation de l’enveloppe.', 'route' => 'conventions.php', 'priority' => 110),
		'partner_overallocated' => array('severity' => 'Budget suralloué', 'tone' => 'danger', 'audience' => 'Validateur définitif', 'expected_action' => 'Réviser les allocations budgétaires du Partenaire / Programme.', 'route' => 'partners.php', 'priority' => 15),
	);
}

function mjl_alert_presentation($semanticKey, array $data = array())
{
	$registry = mjl_alert_presentation_registry();
	if (!isset($registry[$semanticKey])) {
		mjl_alert_presentation_log_unknown($semanticKey);
		return array('severity' => 'Alerte non reconnue', 'tone' => 'neutral', 'audience' => 'Administrateur plateforme', 'expected_action' => 'Signaler cette alerte non reconnue à l’administrateur.', 'href' => '', 'priority' => 999);
	}
	$definition = $registry[$semanticKey];
	$id = isset($data['object_id']) ? (int) $data['object_id'] : 0;
	$severity = $definition['severity'];
	$audience = $definition['audience'];
	$action = $definition['expected_action'];
	if ($semanticKey === 'expense_missing_document' && ($data['document_state'] ?? '') === 'unavailable') {
		$severity = 'Pièce justificative indisponible';
		$action = 'Remplacer la pièce justificative indisponible avant validation.';
	}
	if ($semanticKey === 'expense_exceeds_budget') {
		$status = isset($data['status_code']) ? (int) $data['status_code'] : 0;
		if ($status === 1) {
			$audience = 'Agent vérificateur et prévalidateur';
			$action = 'Rejeter ou retourner la dépense pour correction avant prévalidation.';
		} elseif ($status === 4) {
			$audience = 'Validateur définitif';
			$action = 'Rejeter ou retourner la dépense avant validation définitive.';
		}
	}
	$href = $id > 0 ? '/custom/mjlfinancement/'.$definition['route'].'?id='.$id : '';
	return array('severity' => $severity, 'tone' => $definition['tone'], 'audience' => $audience, 'expected_action' => $action, 'href' => mjl_safe_internal_path($href), 'priority' => $definition['priority']);
}

function mjl_alert_presentation_log_unknown($semanticKey)
{
	$context = array('category' => 'unknown_semantic_key', 'key_hash' => substr(hash('sha256', (string) $semanticKey), 0, 12));
	if (function_exists('mjl_ui_log_error')) mjl_ui_log_error('alerts', array('route' => 'alerts', 'action' => 'present_unknown'), 'key_hash='.$context['key_hash']);
	else error_log('MJL_ALERT '.json_encode($context));
}

function mjl_alert_present_condition(array $condition)
{
	$semanticKey = isset($condition['semantic_key']) ? (string) $condition['semantic_key'] : '';
	$presentation = mjl_alert_presentation($semanticKey, array(
		'object_id' => isset($condition['object_id']) ? (int) $condition['object_id'] : 0,
		'document_state' => isset($condition['facts']['document_state']) ? $condition['facts']['document_state'] : '',
		'status_code' => isset($condition['status_code']) ? $condition['status_code'] : null,
	));
	$objectType = isset($condition['object_type']) ? (string) $condition['object_type'] : '';
	$objectLabels = array(
		'mjlfinancement_activity' => 'Activité',
		'mjlfinancement_expense' => 'Dépense',
		'mjlfinancement_budget_line' => 'Ligne budgétaire',
		'mjlfinancement_convention' => 'Enveloppe de financement',
		'societe' => 'Partenaire / Programme',
	);
	$meta = mjl_alert_present_facts($semanticKey, (array) ($condition['facts'] ?? array()), $condition);
	return array(
		'type' => $semanticKey,
		'domain' => isset($condition['domain']) ? (string) $condition['domain'] : '',
		'object_type' => isset($objectLabels[$objectType]) ? $objectLabels[$objectType] : 'Objet non reconnu',
		'object_type_code' => $objectType,
		'object_id' => isset($condition['object_id']) ? (int) $condition['object_id'] : 0,
		'partner_id' => isset($condition['partner_id']) ? (int) $condition['partner_id'] : 0,
		'ref' => isset($condition['reference']) ? (string) $condition['reference'] : '',
		'label' => isset($condition['domain_label']) ? (string) $condition['domain_label'] : '',
		'sort_date' => isset($condition['sort_date']) ? (string) $condition['sort_date'] : '',
		'priority' => isset($condition['priority']) ? (int) $condition['priority'] : 999,
		'meta' => $meta,
	) + $presentation;
}

function mjl_alert_present_facts($semanticKey, array $facts, array $condition)
{
	$meta = array();
	if (isset($facts['project_reference']) && $facts['project_reference'] !== '') $meta['Projet'] = $facts['project_reference'];
	if (isset($facts['envelope_reference']) && $facts['envelope_reference'] !== '') $meta['Enveloppe'] = $facts['envelope_reference'];
	if (isset($facts['activity_reference']) && $facts['activity_reference'] !== '') $meta['Activité'] = $facts['activity_reference'];
	if (isset($facts['deadline'])) $meta['Échéance'] = mjl_format_date($facts['deadline']);
	if (isset($facts['last_execution_update'])) $meta['Dernière mise à jour'] = mjl_format_date($facts['last_execution_update'], 'datetime');
	if (isset($facts['expense_date'])) $meta['Date de dépense'] = mjl_format_date($facts['expense_date']);
	if (isset($facts['amount'])) $meta['Montant'] = mjl_format_money($facts['amount']);
	if (isset($facts['candidate_amount'])) $meta['Montant candidat'] = mjl_format_money($facts['candidate_amount']);
	if (isset($facts['available_amount'])) $meta['Solde disponible'] = mjl_format_money($facts['available_amount']);
	if (isset($facts['revised_budget'])) $meta['Budget révisé'] = mjl_format_money($facts['revised_budget']);
	if (isset($facts['validated_amount'])) $meta['Consommation validée'] = mjl_format_money($facts['validated_amount']);
	if (isset($facts['rate'])) $meta['Taux'] = mjl_format_number($facts['rate'], 'percentage');
	if (isset($facts['overallocation_amount'])) $meta['Dépassement'] = mjl_format_money($facts['overallocation_amount']);
	if (isset($condition['status_code']) && function_exists('mjl_status_presentation')) {
		$statusObjectType = strpos((string) ($condition['object_type'] ?? ''), 'expense') !== false ? 'expense' : 'activity';
		$meta['Statut'] = mjl_status_presentation($statusObjectType, $condition['status_code'], 'operational')['label'];
	}
	return $meta;
}
