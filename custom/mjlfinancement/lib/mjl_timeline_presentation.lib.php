<?php

require_once __DIR__.'/mjl_presentation.lib.php';
require_once __DIR__.'/mjl_scope.lib.php';
require_once __DIR__.'/mjl_ui.lib.php';

function mjl_timeline_state_label($state)
{
	if ((string) $state === '') return '';
	$status = mjl_ui_activity_status($state);
	return $status['label'];
}

function mjl_timeline_present_event(array $row)
{
	$labels = array(
		'ACTIVITY_CREATED'=>'Activité créée',
		'ACTIVITY_STRUCTURE_SAVED'=>'Structure mise à jour',
		'ACTIVITY_REVISION_SUBMITTED'=>'Révision soumise',
		'ACTIVITY_ABANDONED'=>'Brouillon abandonné',
		'ACTIVITY_RESTORED'=>'Brouillon restauré',
		'ACTIVITY_REVIEW_DECIDED'=>'Décision de validation enregistrée',
		'ASSIGNMENT_ADDED'=>'Agent ajouté',
		'ASSIGNMENT_REMOVED'=>'Agent retiré',
		'PRIMARY_TRANSFERRED'=>'Responsabilité principale transférée',
	);
	$action = isset($row['action']) ? (string) $row['action'] : '';
	$malformed = false;
	$decode = function ($value) use (&$malformed) { if ($value === null || $value === '') return array(); $decoded=json_decode((string)$value,true); if (!is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) { $malformed=true; return array(); } return $decoded; };
	$context = $decode($row['context_json'] ?? null);
	$previous = $decode($row['previous_values_json'] ?? null);
	$new = $decode($row['new_values_json'] ?? null);
	$details = array();
	$before = mjl_timeline_state_label(isset($row['state_before']) ? (string) $row['state_before'] : '');
	$after = mjl_timeline_state_label(isset($row['state_after']) ? (string) $row['state_after'] : '');
	if ($before !== '' && $after !== '' && $before !== $after) $details[] = $before.' → '.$after;
	if (!empty($context['revision_number'])) $details[] = 'Révision '.(int) $context['revision_number'];
	$decisions = array('PREVALIDATED'=>'Prévalidation','RETURNED_SUPERVISOR'=>'Retour en correction par le superviseur','FINAL_VALIDATED'=>'Validation définitive','RETURNED_VALIDATOR'=>'Retour en correction par le validateur');
	if (!empty($context['decision']) && isset($decisions[$context['decision']])) $details[] = $decisions[$context['decision']];
	if (array_key_exists('requested_amount', $context) && $context['requested_amount'] !== null) $details[] = 'Montant demandé : '.mjl_format_money($context['requested_amount']);
	if (in_array($action, array('ASSIGNMENT_ADDED','ASSIGNMENT_REMOVED','PRIMARY_TRANSFERRED'), true) && !empty($context['target_agent_name'])) $details[] = 'Agent : '.(string) $context['target_agent_name'];
	if ($action === 'ACTIVITY_STRUCTURE_SAVED' && isset($previous['activity'],$new['activity']) && is_array($previous['activity']) && is_array($new['activity'])) {
		$changed=array(); $fieldLabels=array('partner_id'=>'partenaire','project_id'=>'projet','name'=>'nom','description'=>'description','date_start'=>'date de début','date_end'=>'date de fin','authorized_amount'=>'montant autorisé');
		foreach($fieldLabels as$key=>$label) if (($previous['activity'][$key] ?? null) !== ($new['activity'][$key] ?? null)) $changed[]=$label;
		if ($changed) $details[]='Activité : '.implode(', ',$changed);
		if (isset($previous['operations'],$new['operations']) && $previous['operations'] !== $new['operations']) {
			$beforeCount=count((array)$previous['operations']); $afterCount=count((array)$new['operations']);
			$details[]=$beforeCount===$afterCount?'Opérations modifiées':'Opérations : '.$beforeCount.' → '.$afterCount;
		}
	}
	if (!empty($row['reason']) && in_array($action, array('ACTIVITY_ABANDONED','ACTIVITY_RESTORED','ACTIVITY_REVIEW_DECIDED','ASSIGNMENT_ADDED','ASSIGNMENT_REMOVED','PRIMARY_TRANSFERRED'), true)) $details[] = (string) $row['reason'];
	$role=(string)($row['actor_role_snapshot'] ?? '');
	return array(
		'title'=>!$malformed && isset($labels[$action]) ? $labels[$action] : 'Événement enregistré',
		'actor'=>!empty($row['actor_name_snapshot']) ? (string) $row['actor_name_snapshot'] : 'Système',
		'role'=>$role === 'SYSTEM' ? 'Système' : (mjl_scope_is_valid_role_code($role) ? mjl_scope_role_label($role) : 'Rôle non renseigné'),
		'date'=>mjl_format_date($row['event_date'] ?? null, 'datetime'),
		'detail'=>$malformed ? '' : implode(' · ', $details),
	);
}
