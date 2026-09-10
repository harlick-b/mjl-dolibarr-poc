<?php

require_once __DIR__.'/mjl_audit.lib.php';
require_once __DIR__.'/mjl_report_format.lib.php';

/** Finite schemas for the 42 application actions; no arbitrary JSON export. */
function mjl_audit_projection_schema(array $event,array $new)
{
	$fields=function($names){return $names===''?array():array_fill_keys(explode(' ',$names),true);};
	$structure=array('activity'=>$fields('partner_id project_id name description date_start date_end authorized_amount'),'operations'=>array('*'=>$fields('name type_id authorized_amount')));
	$operation=$fields('rowid entity fk_activity fk_operation_type name authorized_amount status spent_amount observation version date_removed fk_user_removed date_creation tms fk_user_creat fk_user_modif type_label');
	$activity=$fields('rowid entity ref fk_partner fk_project name description date_start date_end draft_authorized_amount first_submitted_amount latest_validated_amount fk_current_revision validation_status is_cancelled version date_creation tms fk_user_creat fk_user_modif');
	$assignment=array('assignments'=>array('*'=>$fields('agent_id is_primary')),'version'=>true);
	$assignmentRow=$fields('rowid entity fk_activity fk_user is_primary date_start date_end fk_user_assign reason date_creation tms current_user_id current_primary_activity_id');
	$cancel=$fields('rowid entity target_type target_id fk_activity fk_target_revision target_version target_operation_set_hash fk_requester requester_name_snapshot requester_role_snapshot reason status fk_reviewer reviewer_name_snapshot reviewer_role_snapshot decision_reason date_request date_decision date_withdrawal version pending_target_key tms');
	$reopen=$fields('rowid entity fk_activity fk_operation fk_target_revision target_version fk_requester requester_name_snapshot requester_role_snapshot reason status fk_reviewer reviewer_name_snapshot reviewer_role_snapshot decision_reason date_request date_decision date_withdrawal version pending_operation_id tms');
	$none=array(); $request=$fields('request_id');
	$map=array(
		'ACTIVITY_CREATED'=>array('Activité créée',$none,$none,$fields('reference')),
		'ACTIVITY_STRUCTURE_SAVED'=>array('Structure de l’Activité modifiée',$structure,$structure,$fields('candidate_revision')),
		'ACTIVITY_REVISION_SUBMITTED'=>array('Révision soumise',$none,$none,$fields('revision_id revision_number')),
		'ACTIVITY_ABANDONED'=>array('Brouillon abandonné',$none,$none,$none),
		'ACTIVITY_RESTORED'=>array('Activité restaurée',$none,$none,$fields('primary_agent_id')),
		'ACTIVITY_REVIEW_DECIDED'=>array('Décision sur la révision',$fields('validation_status'),$fields('validation_status decision requested_amount'),$fields('revision_id revision_number decision requested_amount')),
		'OPERATION_EXECUTION_UPDATED'=>array('Exécution de l’Opération modifiée',$operation,$operation,$none),
		'OPERATION_CANCELLED'=>array('Opération annulée',$operation,$operation,$request),
		'OPERATION_REOPENED'=>array('Opération rouverte',$operation,$operation,$request),
		'ACTIVITY_CANCELLED'=>array('Activité annulée',$activity,$activity,$request),
		'ACTIVITY_EXECUTION_STATUS_CHANGED'=>array('État d’exécution actualisé',$fields('execution_status'),$fields('execution_status'),$fields('source')),
		'CANCELLATION_REQUESTED'=>array('Annulation demandée',$none,$fields('target_type target_id request_id'),$fields('request_id target_type')),
		'REOPENING_REQUESTED'=>array('Réouverture demandée',$none,$request,$request),
		'ASSIGNMENT_ADDED'=>array('Agent supplémentaire affecté',$assignment,$assignment,$fields('operation target_agent_id target_agent_name')),
		'PRIMARY_TRANSFERRED'=>array('Affectation principale transférée',$assignment,$assignment,$fields('operation target_agent_id target_agent_name')),
		'ASSIGNMENT_REMOVED'=>($event['object_type']??'')==='activity'?array('Affectation retirée',$assignmentRow,$fields('date_end'),$fields('request_id target_agent_id')):array('Affectation retirée',$assignment,$assignment,$fields('operation target_agent_id target_agent_name')),
	);
	foreach (array('APPROVED'=>'approuvée','REJECTED'=>'rejetée','WITHDRAWN'=>'retirée') as $suffix=>$label) {
		$map['CANCELLATION_'.$suffix]=array('Demande d’annulation '.$label,$cancel,$request,$request);
		$map['REOPENING_'.$suffix]=array('Demande de réouverture '.$label,$reopen,$request,$request);
	}
	foreach (array('created'=>'Référence créée','field_changed'=>'Libellé de référence modifié','activated'=>'Référence activée','deactivated'=>'Référence désactivée') as $action=>$label) $map[$action]=array($label,$none,array(in_array($action,array('created','field_changed'),true)?'label':'active'=>$fields('before after')),$fields('legacy_ref_prefix import_key'));
	foreach (array(
		'invitation_issued'=>array('Invitation créée','invitation_id role_code'), 'invitation_sent'=>array('Invitation envoyée','invitation_id'), 'invitation_send_failed'=>array('Envoi de l’invitation échoué','invitation_id'), 'invitation_accepted'=>array('Invitation acceptée','role_code'), 'invitation_revoked'=>array('Invitation révoquée','invitation_id'),
		'password_reset_requested'=>array('Réinitialisation du mot de passe demandée','email_fingerprint ip_fingerprint'), 'password_reset_sent'=>array('Message de réinitialisation envoyé','reset_id'), 'password_reset_send_failed'=>array('Envoi du message de réinitialisation échoué','reset_id'), 'password_reset_completed'=>array('Mot de passe réinitialisé','reset_id'), 'password_reset_throttled'=>array('Réinitialisation limitée','email_fingerprint ip_fingerprint'), 'password_reset_unknown'=>array('Demande de réinitialisation sans compte correspondant','email_fingerprint ip_fingerprint'), 'password_reset_bad_csrf'=>array('Formulaire de réinitialisation refusé','detail'), 'access_profile_assigned'=>array('Profil d’accès affecté','detail'), 'access_deactivated'=>array('Accès désactivé','detail'), 'email_send_failed'=>array('Envoi du courriel échoué','detail'),
	) as $action=>$definition) $map[$action]=array($definition[0],$none,$none,$fields($definition[1]));
	$report=$new['report_type']??null;
	$filters=$fields($report==='audit'?'q object_type object_id activity_id operation_id revision_id actor_id event_id target_version audit_action result date_from date_to cursor direction page':'q partner_id project_id activity_id validation_status execution_status completeness type_id operation_status date_from date_to grouping page');
	$map['EXPORT_GENERATED']=array('Rapport généré',$none,$fields('report_type projection_version format body_row_count byte_count content_sha256'),array('filters'=>$filters,'activity_ids'=>array('*'=>true),'snapshot_time'=>true));
	$action=$event['action']??'';
	if (!isset($map[$action])) throw new RuntimeException('UNSUPPORTED_RECORD');
	if ($action==='EXPORT_GENERATED' && (!in_array($report,array('activities','operations','activity_detail','portfolio','audit'),true) || (string)($new['projection_version']??'')!=='1' || !in_array($new['format']??'',array('pdf','xlsx','csv'),true))) throw new RuntimeException('UNSUPPORTED_RECORD');
	if (in_array($action,array('created','field_changed','activated','deactivated'),true) && !in_array($event['object_type']??'',array('mjlfinancement_partner','mjlfinancement_project','mjlfinancement_operation_type'),true)) throw new RuntimeException('UNSUPPORTED_RECORD');
	return $map[$action];
}

function mjl_audit_projection_decode($json)
{
	if ($json===null || $json==='') return array();
	if (!is_string($json) || strlen($json)>5242880) throw new RuntimeException('UNSUPPORTED_RECORD');
	mjl_report_memory_headroom(strlen($json)*16+8388608);
	try { $value=json_decode($json,true,32,JSON_BIGINT_AS_STRING|JSON_THROW_ON_ERROR); }
	catch (Throwable $e) { throw new RuntimeException('UNSUPPORTED_RECORD'); }
	if (!is_array($value)) throw new RuntimeException('UNSUPPORTED_RECORD');
	return $value;
}

/** Validate containers and keys before flattening; every leaf is scalar or null. */
function mjl_audit_projection_flatten($value,$schema,$path,array &$flat)
{
	if ($schema===true) {
		if (!is_scalar($value) && $value!==null) throw new RuntimeException('UNSUPPORTED_RECORD');
		if (is_string($value) && !preg_match('//u',$value)) throw new RuntimeException('UNSUPPORTED_RECORD');
		if (count($flat)>=10000) throw new RuntimeException('REPORT_LIMIT');
		$flat[$path]=$value; return;
	}
	if (!is_array($value)) throw new RuntimeException('UNSUPPORTED_RECORD');
	if (isset($schema['*'])) {
		if (!array_is_list($value)) throw new RuntimeException('UNSUPPORTED_RECORD');
		if (!$value) { $flat[$path]=array(); return; }
		foreach ($value as $index=>$child) mjl_audit_projection_flatten($child,$schema['*'],$path.'['.$index.']',$flat);
		return;
	}
	if (count($value)!==count($schema) || array_diff(array_keys($value),array_keys($schema))) throw new RuntimeException('UNSUPPORTED_RECORD');
	foreach ($schema as $key=>$child) mjl_audit_projection_flatten($value[$key],$child,$path===''?$key:$path.'.'.$key,$flat);
}

function mjl_audit_report_metadata_columns()
{
	return array('event_id'=>array('Identifiant événement','integer'),'entity'=>array('Entité','integer'),'object_type'=>array('Type d’objet','text'),'object_id'=>array('Identifiant objet','integer'),'object_ref'=>array('Référence historique','text'),'activity_id'=>array('Activité','integer'),'operation_id'=>array('Opération','integer'),'revision_id'=>array('Révision','integer'),'target_version'=>array('Version cible','integer'),'actor_id'=>array('Identifiant acteur','integer'),'actor_name'=>array('Nom historique de l’acteur','text'),'actor_role'=>array('Rôle enregistré','text'),'event_date'=>array('Date de l’événement','text'),'action'=>array('Code action','text'),'action_label'=>array('Action','text'),'result'=>array('Résultat','text'),'state_before'=>array('État avant','text'),'state_after'=>array('État après','text'));
}

function mjl_audit_report_metadata(array $event)
{
	$labels=array('SUCCESS'=>'Réussite','DENIED'=>'Refus','FAILED'=>'Échec');
	$meta=array('event_id'=>$event['rowid']??null,'actor_name'=>$event['actor_name_snapshot']??null,'actor_role'=>$event['actor_role_snapshot']??null);
	foreach (mjl_audit_report_metadata_columns() as $key=>$column) if (!array_key_exists($key,$meta)) $meta[$key]=$event[$key]??null;
	try { $schema=mjl_audit_projection_schema($event,mjl_audit_projection_decode($event['new_values_json']??null)); $meta['action_label']=$schema[0]; if (($event['action']??'')==='ACTIVITY_EXECUTION_STATUS_CHANGED') { $context=mjl_audit_projection_decode($event['context_json']??null); $meta['action_label']=mjl_audit_projection_cause_label($context['source']??''); } }
	catch (Throwable $e) { $meta['action_label']='Événement non représentable'; }
	$meta['result']=$labels[$event['result']??'']??'Résultat non renseigné';
	foreach ($meta as &$value) if (is_string($value)) $value=mjl_audit_report_redact($value); unset($value);
	return $meta;
}

function mjl_audit_report_change_columns()
{
	return array('path'=>array('Chemin du champ','text'),'field_label'=>array('Champ','text'),'kind'=>array('Nature du détail','text'),'part'=>array('Partie','integer'),'parts'=>array('Nombre de parties','integer'),'before_type'=>array('Type avant','text'),'before'=>array('Valeur avant','text'),'after_type'=>array('Type après','text'),'after'=>array('Valeur après','text'));
}

function mjl_audit_projection_scalar($present,$value)
{
	if (!$present) return array('Non enregistré','Non enregistré');
	if ($value===null) return array('Non renseigné','Non renseigné');
	if ($value===array()) return array('Liste vide','Liste vide');
	if (is_bool($value)) return array('Booléen',$value?'Vrai':'Faux');
	if (is_int($value)) return array('Entier',(string)$value);
	if (is_float($value)) return array('Nombre',json_encode($value,JSON_PRESERVE_ZERO_FRACTION|JSON_THROW_ON_ERROR));
	return array('Texte',mjl_audit_report_redact($value));
}

function mjl_audit_project_event(array $event,$maxRows=10000)
{
	$previous=mjl_audit_projection_decode($event['previous_values_json']??null); $new=mjl_audit_projection_decode($event['new_values_json']??null); $context=mjl_audit_projection_decode($event['context_json']??null);
	$schema=mjl_audit_projection_schema($event,$new); if ($event['action']==='ACTIVITY_EXECUTION_STATUS_CHANGED') mjl_audit_projection_cause_label($context['source']??''); $p=$n=$c=array();
	mjl_audit_projection_flatten($previous,$schema[1],'',$p); mjl_audit_projection_flatten($new,$schema[2],'',$n); mjl_audit_projection_flatten($context,$schema[3],'context',$c);
	if (in_array($event['action'],array('created','field_changed','activated','deactivated'),true)) { $key=in_array($event['action'],array('created','field_changed'),true)?'label':'active'; $p=array($key=>$new[$key]['before']); $n=array($key=>$new[$key]['after']); }
	if (isset($event['reason'])) $c['reason']=$event['reason'];
	$paths=array_unique(array_merge(array_keys($p),array_keys($n))); sort($paths,SORT_NATURAL); ksort($c,SORT_NATURAL);
	$details=array();
	foreach ($paths as $path) if (!array_key_exists($path,$p) || !array_key_exists($path,$n) || $p[$path]!==$n[$path]) $details[]=array($path,'Valeurs enregistrées',array_key_exists($path,$p),$p[$path]??null,array_key_exists($path,$n),$n[$path]??null);
	foreach ($c as $path=>$value) $details[]=array($path,$path==='reason'?'Motif':'Contexte',false,null,true,$value);
	if (!$details) $details[]=array('','Événement sans détail enregistré',false,null,false,null);
	$meta=mjl_audit_report_metadata($event); $rows=array();
	foreach ($details as $detail) {
		list($path,$kind,$hasBefore,$before,$hasAfter,$after)=$detail;
		list($beforeType,$before)=mjl_audit_projection_scalar($hasBefore,$before); list($afterType,$after)=mjl_audit_projection_scalar($hasAfter,$after);
		// Redaction above sees the complete value, including tokens crossing a boundary.
		$parts=max(1,(int)ceil(mb_strlen($before)/4000),(int)ceil(mb_strlen($after)/4000));
		if (count($rows)+$parts>$maxRows) throw new RuntimeException('REPORT_LIMIT');
		mjl_report_memory_headroom($parts*16384+8388608);
		for ($i=0;$i<$parts;$i++) $rows[]=array_merge($meta,array('path'=>$path,'field_label'=>mjl_audit_projection_field_label($path),'kind'=>$kind,'part'=>$i+1,'parts'=>$parts,'before_type'=>$beforeType,'before'=>mb_substr($before,$i*4000,4000),'after_type'=>$afterType,'after'=>mb_substr($after,$i*4000,4000)));
	}
	return $rows;
}


function mjl_audit_projection_field_label($path)
{
	$labels=array('context'=>'Contexte','activity'=>'Activité','operations'=>'Opérations','assignments'=>'Affectations','filters'=>'Filtres','reference'=>'Référence','rowid'=>'Identifiant enregistré','entity'=>'Entité','ref'=>'Référence','name'=>'Nom','description'=>'Description','partner_id'=>'Partenaire','fk_partner'=>'Partenaire','project_id'=>'Projet','fk_project'=>'Projet','activity_id'=>'Activité','fk_activity'=>'Activité','operation_id'=>'Opération','fk_operation'=>'Opération','revision_id'=>'Révision','fk_current_revision'=>'Révision courante','fk_target_revision'=>'Révision cible','revision_number'=>'Numéro de révision','candidate_revision'=>'Révision candidate','date_start'=>'Début','date_end'=>'Fin','authorized_amount'=>'Montant autorisé','draft_authorized_amount'=>'Montant proposé courant','first_submitted_amount'=>'Première proposition soumise','latest_validated_amount'=>'Dernier montant validé','spent_amount'=>'Montant dépensé','observation'=>'Observation','status'=>'État','validation_status'=>'Validation','execution_status'=>'Exécution','version'=>'Version','target_version'=>'Version cible','type_id'=>'Type d’Opération','fk_operation_type'=>'Type d’Opération','type_label'=>'Libellé du type','date_removed'=>'Date de retrait','fk_user_removed'=>'Auteur du retrait','date_creation'=>'Création','tms'=>'Dernière modification','fk_user_creat'=>'Créateur','fk_user_modif'=>'Dernier auteur','is_cancelled'=>'Annulation','is_primary'=>'Affectation principale','agent_id'=>'Agent','fk_user'=>'Utilisateur','fk_user_assign'=>'Auteur de l’affectation','primary_agent_id'=>'Agent principal','target_agent_id'=>'Agent concerné','target_agent_name'=>'Nom de l’Agent concerné','current_user_id'=>'Utilisateur courant','current_primary_activity_id'=>'Activité principale courante','operation'=>'Opération d’affectation','target_type'=>'Type de cible','target_id'=>'Cible','request_id'=>'Demande','target_operation_set_hash'=>'Empreinte des Opérations ciblées','fk_requester'=>'Demandeur','requester_name_snapshot'=>'Nom enregistré du demandeur','requester_role_snapshot'=>'Rôle enregistré du demandeur','fk_reviewer'=>'Décideur','reviewer_name_snapshot'=>'Nom enregistré du décideur','reviewer_role_snapshot'=>'Rôle enregistré du décideur','reason'=>'Motif','decision_reason'=>'Motif de décision','decision'=>'Décision','requested_amount'=>'Montant demandé','date_request'=>'Date de demande','date_decision'=>'Date de décision','date_withdrawal'=>'Date de retrait de la demande','pending_target_key'=>'Clé de cible en attente','pending_operation_id'=>'Opération en attente','source'=>'Origine','label'=>'Libellé','active'=>'Activation','legacy_ref_prefix'=>'Préfixe de référence enregistré','import_key'=>'Clé d’import enregistrée','invitation_id'=>'Invitation','role_code'=>'Profil','reset_id'=>'Réinitialisation','email_fingerprint'=>'Empreinte du courriel','ip_fingerprint'=>'Empreinte réseau','detail'=>'Détail enregistré','report_type'=>'Rapport','projection_version'=>'Version de projection','format'=>'Format','body_row_count'=>'Nombre de lignes','byte_count'=>'Taille en octets','content_sha256'=>'Empreinte du fichier','activity_ids'=>'Activités incluses','snapshot_time'=>'Date de capture','q'=>'Recherche','object_type'=>'Type d’objet','object_id'=>'Objet','actor_id'=>'Acteur','event_id'=>'Événement','audit_action'=>'Action','result'=>'Résultat','completeness'=>'Complétude','operation_status'=>'État d’Opération','date_from'=>'Borne de début','date_to'=>'Borne de fin','grouping'=>'Regroupement','page'=>'Page','cursor'=>'Curseur','direction'=>'Ordre');
	if ($path==='') return 'Événement';
	$parts=explode('.',$path); $out=array();
	foreach ($parts as $part) {
		preg_match('/^([^\[]+)(.*)$/',$part,$match);
		$out[]=($labels[$match[1]]??$match[1]).$match[2];
	}
	return implode(' · ',$out);
}

/** Redact quoted values first: the legacy unquoted pattern stops at whitespace. */
function mjl_audit_report_redact($text)
{
	$pattern= <<<'REGEX'
~((?<![a-z0-9_])["']?(?:password|passwd|token|secret|api[_-]?key|authorization|cookie|session|private[_-]?key|verifier)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')~iu
REGEX;
	$redacted=preg_replace($pattern,'$1[REDACTED]',(string)$text);
	if ($redacted===null) throw new RuntimeException('UNSUPPORTED_RECORD');
	return mjl_audit_sanitize_value($redacted);
}


function mjl_audit_projection_cause_label($source)
{
	$labels=array('FINAL_VALIDATION'=>'État d’exécution actualisé après validation définitive','OPERATION'=>'État d’exécution actualisé après saisie d’une Opération','ACTIVITY_CANCELLATION'=>'État d’exécution actualisé après annulation de l’Activité','OPERATION_CANCELLATION'=>'État d’exécution actualisé après annulation d’une Opération','REOPENING'=>'État d’exécution actualisé après réouverture','SCHEDULED'=>'État d’exécution actualisé automatiquement (contrôle planifié)','MUTATION_CATCH_UP'=>'État d’exécution actualisé automatiquement (rattrapage)');
	if (!is_string($source) || !isset($labels[$source])) throw new RuntimeException('UNSUPPORTED_RECORD');
	return $labels[$source];
}
