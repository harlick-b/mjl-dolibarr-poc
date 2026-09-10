<?php

require_once __DIR__.'/mjl_presentation.lib.php';
require_once __DIR__.'/mjl_scope.lib.php';
require_once __DIR__.'/mjl_ui.lib.php';
require_once __DIR__.'/mjl_audit_projection.lib.php';

function mjl_timeline_state_label($state)
{
	if ((string) $state === '') return '';
	$execution = array('CURRENT'=>'Affectation active','ENDED'=>'Affectation terminée','TODO'=>'À faire','IN_PROGRESS'=>'En cours','COMPLETED'=>'Terminée','CANCELLED'=>'Annulée','NOT_STARTED'=>'Non démarrée','UPCOMING'=>'À venir','OVERDUE'=>'En retard','PENDING'=>'En attente','APPROVED'=>'Approuvée','REJECTED'=>'Rejetée','WITHDRAWN'=>'Retirée');
	if (isset($execution[$state])) return $execution[$state];
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
		'OPERATION_EXECUTION_UPDATED'=>'Exécution de l’Opération modifiée',
		'OPERATION_CANCELLED'=>'Opération annulée',
		'OPERATION_REOPENED'=>'Opération rouverte',
		'ACTIVITY_CANCELLED'=>'Activité annulée',
		'ACTIVITY_EXECUTION_STATUS_CHANGED'=>'État d’exécution actualisé',
		'CANCELLATION_REQUESTED'=>'Annulation demandée',
		'REOPENING_REQUESTED'=>'Réouverture demandée',
		'EXPORT_GENERATED'=>'Rapport généré',
	);
	foreach (array('APPROVED'=>'approuvée','REJECTED'=>'rejetée','WITHDRAWN'=>'retirée') as $suffix=>$label) {
		$labels['CANCELLATION_'.$suffix]='Demande d’annulation '.$label;
		$labels['REOPENING_'.$suffix]='Demande de réouverture '.$label;
	}
	$action = isset($row['action']) ? (string) $row['action'] : '';
	$malformed = !empty($row['details_unavailable']);
	$decode = function ($value) use (&$malformed) { try { return mjl_audit_projection_decode($value); } catch (Throwable $e) { $malformed=true; return array(); } };
	$context = $decode($row['context_json'] ?? null);
	$previous = $decode($row['previous_values_json'] ?? null);
	$new = $decode($row['new_values_json'] ?? null);
	$details = array();
	// Only the named scalar fields below may enter ordinary chronology.
	foreach (array($context,$previous,$new) as $payload) foreach (array('reference','target_agent_id','revision_number','decision','requested_amount','target_agent_name','source','status','spent_amount','observation','execution_status','request_id','target_type','report_type','format') as $key) {
		if (array_key_exists($key,$payload) && !is_scalar($payload[$key]) && $payload[$key]!==null) $malformed=true;
	}
	if ($malformed) $context=$previous=$new=array();

	$before = mjl_timeline_state_label(isset($row['state_before']) ? (string) $row['state_before'] : '');
	$after = mjl_timeline_state_label(isset($row['state_after']) ? (string) $row['state_after'] : '');
	if ($before !== '' && $after !== '' && $before !== $after) $details[] = $before.' → '.$after;
	if (!empty($context['revision_number'])) $details[] = 'Révision '.(int) $context['revision_number'];
	$decisions = array('PREVALIDATED'=>'Prévalidation','RETURNED_SUPERVISOR'=>'Retour en correction par le superviseur','FINAL_VALIDATED'=>'Validation définitive','RETURNED_VALIDATOR'=>'Retour en correction par le validateur');
	if (!empty($context['decision']) && isset($decisions[$context['decision']])) $details[] = $decisions[$context['decision']];
	if (array_key_exists('requested_amount', $context) && $context['requested_amount'] !== null) $details[] = 'Montant demandé : '.mjl_format_money($context['requested_amount']);
	if (in_array($action, array('ASSIGNMENT_ADDED','ASSIGNMENT_REMOVED','PRIMARY_TRANSFERRED'), true) && !empty($context['target_agent_name'])) $details[] = 'Agent : '.(string) $context['target_agent_name'];
	if (in_array($action,array('ASSIGNMENT_ADDED','ASSIGNMENT_REMOVED','PRIMARY_TRANSFERRED'),true) && empty($context['target_agent_name']) && !empty($context['target_agent_id'])) $details[]='Agent n° '.(int)$context['target_agent_id'];
	if ($action === 'ACTIVITY_STRUCTURE_SAVED' && isset($previous['activity'],$new['activity']) && is_array($previous['activity']) && is_array($new['activity'])) {
		$changed=array(); $fieldLabels=array('partner_id'=>'partenaire','project_id'=>'projet','name'=>'nom','description'=>'description','date_start'=>'date de début','date_end'=>'date de fin','authorized_amount'=>'montant autorisé');
		foreach($fieldLabels as$key=>$label) if (($previous['activity'][$key] ?? null) !== ($new['activity'][$key] ?? null)) $changed[]=$label;
		if ($changed) $details[]='Activité : '.implode(', ',$changed);
		if (isset($previous['operations'],$new['operations']) && $previous['operations'] !== $new['operations']) {
			$beforeCount=count((array)$previous['operations']); $afterCount=count((array)$new['operations']);
			$details[]=$beforeCount===$afterCount?'Opérations modifiées':'Opérations : '.$beforeCount.' → '.$afterCount;
		}
	}
	if (in_array($action,array('OPERATION_EXECUTION_UPDATED','OPERATION_CANCELLED','OPERATION_REOPENED'),true)) {
		if (!empty($row['operation_id'])) $details[]='Opération n° '.(int)$row['operation_id'];
		foreach (array('status'=>'Statut','spent_amount'=>'Montant dépensé','observation'=>'Observation') as $key=>$label) {
			if (!array_key_exists($key,$previous) || !array_key_exists($key,$new)) { $malformed=true; continue; }
			if ($previous[$key]===$new[$key]) continue;
			$format=function($value) use($key) {
				if ($value===null) return 'Non renseigné';
				if ($key==='status') return mjl_timeline_state_label($value);
				if ($key==='spent_amount') return mjl_format_money($value);
				return $value===''?'Texte vide':(string)$value;
			};
			$details[]=$label.' : '.$format($previous[$key]).' → '.$format($new[$key]);
		}
	}
	if (str_starts_with($action,'CANCELLATION_') || str_starts_with($action,'REOPENING_')) {
		if (!empty($context['request_id'])) $details[]='Demande n° '.(int)$context['request_id'];
		if (!empty($row['operation_id'])) $details[]='Opération n° '.(int)$row['operation_id'];
		elseif (($context['target_type']??$previous['target_type']??'')==='ACTIVITY') $details[]='Activité entière';
		if (!empty($row['reason'])) $details[]=(string)$row['reason'];
	}
	if ($action==='ACTIVITY_EXECUTION_STATUS_CHANGED') {
		try { $labels[$action]=mjl_audit_projection_cause_label($context['source']??''); }
		catch (Throwable $e) { $malformed=true; }
		if ($before==='' && isset($previous['execution_status'],$new['execution_status'])) $details[]=mjl_timeline_state_label($previous['execution_status']).' → '.mjl_timeline_state_label($new['execution_status']);
	}
	if ($action==='EXPORT_GENERATED') {
		$reports=array('activities'=>'Activités','operations'=>'Opérations','activity_detail'=>'Fiche Activité','portfolio'=>'Synthèse du portefeuille');
		if (!isset($reports[$new['report_type']??'']) || !in_array($new['format']??'',array('pdf','xlsx','csv'),true)) $malformed=true;
		else $details[]=$reports[$new['report_type']].' · '.strtoupper($new['format']);
	}
	if (!empty($row['reason']) && in_array($action, array('ACTIVITY_ABANDONED','ACTIVITY_RESTORED','ACTIVITY_REVIEW_DECIDED','ASSIGNMENT_ADDED','ASSIGNMENT_REMOVED','PRIMARY_TRANSFERRED'), true)) $details[] = (string) $row['reason'];
	$role=(string)($row['actor_role_snapshot'] ?? '');
	return array(
		'title'=>!$malformed && isset($labels[$action]) ? $labels[$action] : 'Événement enregistré',
		'actor'=>!empty($row['actor_name_snapshot']) ? mjl_audit_report_redact((string) $row['actor_name_snapshot']) : 'Système',
		'role'=>$role === 'SYSTEM' ? 'Système' : (mjl_scope_is_valid_role_code($role) ? mjl_scope_role_label($role) : 'Rôle non renseigné'),
		'date'=>mjl_format_date($row['event_date'] ?? null, 'datetime'),
		'detail'=>$malformed || !isset($labels[$action]) ? 'Détails indisponibles.' : mjl_audit_report_redact(implode(' · ', $details)),
	);
}
