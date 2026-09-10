<?php

require_once __DIR__.'/mjl_monitoring.lib.php';
require_once __DIR__.'/mjl_report_format.lib.php';

function mjl_report_titles()
{
	return array('activities'=>'Suivi des Activités','operations'=>'Suivi des Opérations','activity_detail'=>'Fiche Activité','portfolio'=>'Synthèse du portefeuille','audit'=>'Journal d’audit');
}

/** A fixed report shape prevents contradictory filters from silently changing scope. */
function mjl_report_validate_request($type, $format, array $source, $preview=false)
{
	if (!isset(mjl_report_titles()[$type]) || !in_array($format,array('pdf','xlsx','csv'),true)) throw new InvalidArgumentException('INVALID_REPORT');
	$filters=mjl_monitoring_filters($source,$type==='audit');
	foreach ($source as $key=>$value) if (!array_key_exists($key,$filters)) throw new InvalidArgumentException('INVALID_REPORT_FILTER');
	if ($type!=='audit' && $type!=='operations' && ($filters['type_id']!=='' || $filters['operation_status']!=='')) throw new InvalidArgumentException('INVALID_REPORT_FILTER');
	if ($type==='portfolio' && !in_array($filters['grouping'],array('project','partner'),true)) throw new InvalidArgumentException('INVALID_REPORT_FILTER');
	if ($type==='activity_detail' && $filters['activity_id']==='') throw new InvalidArgumentException('INVALID_REPORT_FILTER');
	if ($type!=='portfolio' && isset($source['grouping']) && $source['grouping']!=='project') throw new InvalidArgumentException('INVALID_REPORT_FILTER');
	if ($type==='audit' && ((!$preview && $filters['cursor']!=='') || $filters['page']!=='1' || !in_array($filters['direction'],array('asc','desc'),true))) throw new InvalidArgumentException('INVALID_REPORT_FILTER');
	return $filters;
}

function mjl_report_portfolio(array $activities, $grouping)
{
	if (!in_array($grouping,array('project','partner'),true)) throw new InvalidArgumentException('INVALID_REPORT_FILTER');
	mjl_report_memory_headroom(count($activities)*2048+8388608);
	$groups=array();
	foreach ($activities as $activity) $groups[$activity['fk_'.$grouping]][]=$activity;
	ksort($groups,SORT_NUMERIC);
	$rows=array();
	foreach ($groups as $id=>$members) {
		$row=array_merge(array('group_id'=>(string)$id,'group_name'=>$members[0][$grouping.'_name']),mjl_monitoring_totals($members));
		$row['draft_pending_amount']=$row['submitted_pending_amount']=null;
		foreach ($members as $activity) if (isset($activity['pending_amount'])) {
			if (in_array($activity['validation_status'],array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'),true)) $key='draft_pending_amount';
			elseif (in_array($activity['validation_status'],array('SUBMITTED','PREVALIDATED'),true)) $key='submitted_pending_amount';
			else throw new RuntimeException('UNSUPPORTED_RECORD');
			$row[$key]=mjl_execution_decimal_add($row[$key]??'0',$activity['pending_amount']);
		}
		$rows[]=$row;
	}
	return $rows;
}

/** Typed cells keep untrusted text separate from exact financial values. */
function mjl_report_cell($value, $type='text')
{
	if (!in_array($type,array('text','integer','ratio'),true)) throw new InvalidArgumentException('INVALID_CELL_TYPE');
	if ($value!==null && !is_scalar($value) && !($type==='ratio' && is_array($value) && array_key_exists('ratio',$value) && isset($value['display']))) throw new InvalidArgumentException('INVALID_CELL');
	return array('type'=>$type,'value'=>$value);
}

function mjl_report_table(array $columns, array $records)
{
	// Include typed-cell arrays, row indexes and a margin before any expansion.
	mjl_report_memory_headroom(count($records)*(count($columns)*512+512)+8388608);
	$rows=array();
	foreach ($records as $record) {
		$row=array();
		foreach ($columns as $key=>$column) {
			$cell=mjl_report_cell($record[$key]??null,$column[1]);
			if (isset($column[2])) $cell['currency']=$column[2];
			$row[]=$cell;
		}
		$rows[]=$row;
	}
	return array('headers'=>array_map(function($column){return $column[0];},array_values($columns)),'rows'=>$rows);
}

function mjl_report_activity_columns()
{
	$columns=array('ref'=>array('Référence Activité','text'),'name'=>array('Activité','text'),'partner_name'=>array('Partenaire','text'),'project_name'=>array('Projet','text'),'date_start'=>array('Début','text'),'date_end'=>array('Fin','text'),'assignment_names'=>array('Agents affectés','text'),'revision_number'=>array('Révision courante','integer'),'validation_label'=>array('État de validation','text'),'execution_label'=>array('État d’exécution','text'),'completeness_label'=>array('Complétude des dépenses','text'));
	$labels=mjl_monitoring_labels();
	foreach(mjl_monitoring_money_fields() as $key) $columns[$key]=array($labels[$key].' (FCFA)','integer','XOF');
	$columns['missing_spent_count']=array($labels['missing_spent_count'],'integer');
	$columns['cancelled_incomplete_count']=array($labels['cancelled_incomplete_count'],'integer');
	return $columns;
}

function mjl_report_status_labels()
{
	return array('DRAFT'=>'Brouillon','SUBMITTED'=>'Soumise','PREVALIDATED'=>'Prévalidée','RETURNED_SUPERVISOR'=>'Retournée par le superviseur','RETURNED_VALIDATOR'=>'Retournée par le validateur','FINAL_VALIDATED'=>'Validée définitivement','CANCELLED'=>'Annulée','ABANDONED'=>'Abandonnée','NOT_STARTED'=>'Non commencée','UPCOMING'=>'À venir','IN_PROGRESS'=>'En cours','OVERDUE'=>'En retard','COMPLETED'=>'Terminée','PARTIAL'=>'Partielle','COMPLETE'=>'Complète','TODO'=>'À faire');
}

function mjl_report_activity_records(array $activities)
{
	$labels=mjl_report_status_labels();
	foreach($activities as &$activity) {
		$names=array();
		foreach($activity['assignments']??array() as $assignment) {
			$name=trim(($assignment['firstname']??'').' '.($assignment['lastname']??''));
			$names[]=($name!==''?$name:$assignment['login']).(!empty($assignment['is_primary'])?' (principal)':'');
		}
		$activity['assignment_names']=implode(', ',$names);
		$activity['validation_label']=$labels[$activity['validation_status']]??'État indisponible';
		$activity['execution_label']=$labels[$activity['execution_status']]??'État indisponible';
		$activity['completeness_label']=$activity['completeness']==='NOT_STARTED'?'Non renseignée':($labels[$activity['completeness']]??'Indisponible');
	}
	unset($activity);
	return $activities;
}

function mjl_report_activities_document(array $activities)
{
	$table=mjl_report_table(mjl_report_activity_columns(),mjl_report_activity_records($activities));
	return array(
		'activity_ids'=>array_map(function($activity){return (int)$activity['rowid'];},$activities),
		'document'=>array('metadata'=>array(
			'Lecture de la période'=>'Chevauchement inclusif des dates courantes des Activités ; montants cumulés courants, sans reconstitution historique.',
			'Lecture des propositions'=>'Les états distinguent les brouillons des propositions soumises. Les montants validés incluent les Activités annulées.',
		),'sections'=>array(array_merge(array('title'=>'Suivi des Activités'),$table))),
	);
}

function mjl_report_build_activities($reader,array $filters)
{
	return mjl_report_activities_document($reader->activities($filters));
}

function mjl_report_operation_columns()
{
	return array(
		'activity_ref'=>array('Référence Activité','text'), 'activity_name'=>array('Activité','text'),
		'partner_name'=>array('Partenaire','text'), 'project_name'=>array('Projet','text'),
		'name'=>array('Opération','text'), 'type_label'=>array('Type d’opération','text'),
		'status_label'=>array('État de l’Opération','text'), 'authorization_kind'=>array('Nature du montant autorisé','text'),
		'authorized_amount'=>array('Montant autorisé (FCFA)','integer','XOF'), 'spent_amount'=>array('Montant dépensé (FCFA)','integer','XOF'),
		'observation'=>array('Observation','text'), 'difference'=>array('Écart (FCFA)','integer','XOF'),
		'variance'=>array('Variation (%)','ratio'),
	);
}

function mjl_report_operation_records(array $operations)
{
	mjl_report_memory_headroom(count($operations)*2048+8388608);
	$labels=mjl_report_status_labels();
	foreach ($operations as &$operation) {
		$variance=mjl_monitoring_variance($operation['spent_amount'],$operation['authorized_amount']);
		$operation['difference']=$variance['difference'];
		$operation['variance']=$variance['ratio']===null?null:array('ratio'=>$variance['ratio'],'display'=>$variance['display']);
		$operation['status_label']=$labels[$operation['status']]??'État indisponible';
	}
	unset($operation);
	return $operations;
}

function mjl_report_operations_document(array $operations)
{
	// Reject before allocating the typed output table.
	if (count($operations)>10000) throw new RuntimeException('REPORT_LIMIT');
	$table=mjl_report_table(mjl_report_operation_columns(),mjl_report_operation_records($operations));
	return array(
		'activity_ids'=>array_values(array_unique(array_map(function($operation){return (int)$operation['activity_id'];},$operations))),
		'document'=>array('metadata'=>array(
			'Lecture de la sélection'=>'La recherche et la période portent sur l’Activité parente. Les filtres de type et d’état portent sur l’Opération, après calcul de la complétude de son Activité entière.',
			'Lecture des montants'=>'Les montants proposés restent distincts des montants validés. Une annulation conserve la validation antérieure ; chaque Opération garde son propre état.',
			'Lecture des écarts'=>'Écart = dépensé − autorisé. Variation = écart / autorisé ; non renseignée si le montant dépensé manque ou si le montant autorisé vaut zéro.',
		),'sections'=>array(array_merge(array('title'=>'Suivi des Opérations'),$table))),
	);
}

function mjl_report_build_operations($reader,array $filters)
{
	$activities=$reader->activities($filters);
	return mjl_report_operations_document($reader->operations($activities,$filters));
}

/** One full parent: never publish an empty or partial Activity sheet. */
function mjl_report_activity_detail_document(array $activities,array $operations)
{
	if (count($activities)!==1) throw new RuntimeException('FORBIDDEN');
	if (count($operations)>9998) throw new RuntimeException('REPORT_LIMIT');
	$records=mjl_report_activity_records($activities);
	$all=mjl_report_activity_columns(); $general=array(); $financial=array();
	foreach ($all as $key=>$column) {
		if (in_array($key,mjl_monitoring_money_fields(),true) || in_array($key,array('missing_spent_count','cancelled_incomplete_count'),true)) $financial[$key]=$column;
		else $general[$key]=$column;
	}
	$general['description']=array('Description','text');
	$general['fk_current_revision']=array('Identifiant de la révision courante','integer');
	return array('activity_ids'=>array((int)$activities[0]['rowid']),'document'=>array(
		'metadata'=>array('Lecture de la fiche'=>'Situation courante de l’Activité et de toutes ses Opérations non retirées. Les révisions référencées sont les révisions soumises ; cette fiche ne reconstitue pas leur contenu historique.','Lecture des montants'=>'Les propositions restent distinctes des montants validés. Les montants validés sont conservés après annulation. Écart = dépensé − autorisé ; variation non renseignée si le dépensé manque ou si l’autorisé vaut zéro.'),
		'sections'=>array(
			array_merge(array('title'=>'Informations générales et affectations'),mjl_report_table($general,$records)),
			array_merge(array('title'=>'Synthèse financière'),mjl_report_table($financial,$records)),
			array_merge(array('title'=>'Opérations courantes complètes'),mjl_report_table(mjl_report_operation_columns(),mjl_report_operation_records($operations))),
		),
	));
}

function mjl_report_build_activity_detail($reader,array $filters)
{
	$activities=$reader->activities($filters);
	return mjl_report_activity_detail_document($activities,$reader->operations($activities,$filters));
}


function mjl_report_portfolio_columns($grouping)
{
	if (!in_array($grouping,array('project','partner'),true)) throw new InvalidArgumentException('INVALID_REPORT_FILTER');
	$columns=array('group_id'=>array($grouping==='project'?'Identifiant Projet':'Identifiant Partenaire','integer'),'group_name'=>array($grouping==='project'?'Projet':'Partenaire','text'));
	$labels=mjl_monitoring_labels();
	foreach (array('activity_count','operation_count') as $key) $columns[$key]=array($labels[$key],'integer');
	foreach (mjl_monitoring_money_fields() as $key) $columns[$key]=array($labels[$key].' (FCFA)','integer','XOF');
	$columns['draft_pending_amount']=array('Propositions en brouillon ou retournées (FCFA)','integer','XOF');
	$columns['submitted_pending_amount']=array('Propositions soumises ou prévalidées (FCFA)','integer','XOF');
	foreach (array('missing_spent_count','cancelled_incomplete_count') as $key) $columns[$key]=array($labels[$key],'integer');
	return $columns;
}

function mjl_report_portfolio_document(array $activities,$grouping)
{
	$table=mjl_report_table(mjl_report_portfolio_columns($grouping),mjl_report_portfolio($activities,$grouping));
	return array('activity_ids'=>array_map(function($activity){return (int)$activity['rowid'];},$activities),'document'=>array(
		'metadata'=>array('Regroupement'=>$grouping==='project'?'Par Projet':'Par Partenaire','Lecture de la synthèse'=>'Chaque Activité accessible correspondant aux filtres contribue une seule fois à son groupe. La période porte sur le chevauchement inclusif des dates courantes des Activités ; les montants sont cumulés courants.','Lecture des montants'=>'Les propositions et les montants validés restent séparés. Les propositions courantes non validées sont ventilées entre brouillons/retours et soumissions/prévalidations. Les dépenses renseignées sont additionnées ; les montants manquants ne sont jamais remplacés par zéro et les compteurs indiquent les informations incomplètes. Les validations antérieures restent incluses après annulation.'),
		'sections'=>array(array_merge(array('title'=>'Synthèse du portefeuille'),$table)),
	));
}

function mjl_report_build_portfolio($reader,array $filters)
{
	return mjl_report_portfolio_document($reader->activities($filters),$filters['grouping']);
}

require_once __DIR__.'/mjl_audit_projection.lib.php';

function mjl_report_build_audit($reader,array $filters)
{
	$events=$reader->audit($filters,true); $records=array();
	foreach ($events as $event) {
		$changes=mjl_audit_project_event($event,10000-count($records));
		foreach ($changes as $change) $records[]=$change;
		unset($changes);
	}
	$table=mjl_report_table(array_merge(mjl_audit_report_metadata_columns(),mjl_audit_report_change_columns()),$records);
	return array('activity_ids'=>array(),'document'=>array('metadata'=>array(
		'Lecture du journal'=>'Événements de l’entité active avec leurs noms, références et valeurs historiques enregistrés. Aucune reconstitution depuis les données courantes.',
		'Lecture des valeurs'=>'Les valeurs avant et après sont celles enregistrées. « Non enregistré » ne prouve pas un effacement. Les positions des tableaux indiquent l’ordre historique, pas une identité d’Opération.',
		'Lecture des parties'=>'Les valeurs longues sont expurgées avant découpage, puis réparties en parties numérotées. Une cellule vide dans une partie finale signifie que cette valeur est déjà terminée. Les contextes et motifs sont identifiés séparément.',
		'Capture'=>'L’événement de génération de cet export est postérieur à la capture et n’en fait pas partie.',
	),'sections'=>array(array_merge(array('title'=>'Journal d’audit'),$table))));
}
