<?php

require_once __DIR__.'/mjl_execution.lib.php';
require_once __DIR__.'/mjl_presentation.lib.php';

/** One business date throughout a request; explicit fixture dates remain caller-owned. */
function mjl_monitoring_date()
{
	static $date = null;
	if ($date === null) $date = mjl_execution_porto_novo_date(new DateTimeImmutable('now'));
	return $date;
}

/** Exact financial projection shared by detail, monitoring and operational reports. */
function mjl_monitoring_activity_projection(array $activity, array $operations, $localDate)
{
	$operations = array_values(array_filter($operations, function ($operation) { return empty($operation['date_removed']); }));
	$summary = mjl_execution_summarize($operations);
	$validated = isset($activity['latest_validated_amount']);
	$pending = !$validated && !in_array($activity['validation_status'], array('CANCELLED', 'ABANDONED'), true);
	$result = array_merge($activity, $summary, array(
		'initial_amount' => $activity['first_submitted_amount'] ?? null,
		'pending_amount' => $pending ? $activity['draft_authorized_amount'] : null,
		'validated_amount' => $activity['latest_validated_amount'] ?? null,
		'execution_status' => mjl_execution_project_status($activity, $operations, $localDate),
		'operation_count' => count($operations),
	));
	if (!$validated) {
		foreach (array('active_authorized_amount','cancelled_authorized_amount','active_spent_amount','cancelled_spent_amount','total_spent_amount') as $key) $result[$key] = null;
		$result['missing_spent_count'] = $result['cancelled_incomplete_count'] = 0;
	}
	return $result;
}

function mjl_monitoring_money_fields()
{
	return array('initial_amount','pending_amount','validated_amount','active_authorized_amount','cancelled_authorized_amount','active_spent_amount','cancelled_spent_amount','total_spent_amount');
}

function mjl_monitoring_totals(array $activities)
{
	$result = array_fill_keys(mjl_monitoring_money_fields(), null);
	$result += array('activity_count'=>count($activities), 'operation_count'=>0, 'missing_spent_count'=>0, 'cancelled_incomplete_count'=>0);
	foreach ($activities as $activity) {
		foreach (mjl_monitoring_money_fields() as $key) if (isset($activity[$key])) $result[$key] = mjl_execution_decimal_add($result[$key] ?? '0', $activity[$key]);
		foreach (array('operation_count','missing_spent_count','cancelled_incomplete_count') as $key) $result[$key] += (int) ($activity[$key] ?? 0);
	}
	return $result;
}

function mjl_monitoring_labels()
{
	return array('initial_amount'=>'Propositions initiales soumises','pending_amount'=>'Propositions courantes non validées','validated_amount'=>'Montants validés, annulations incluses','active_authorized_amount'=>'Autorisations validées des Opérations non annulées','cancelled_authorized_amount'=>'Autorisations validées des Opérations annulées','active_spent_amount'=>'Dépenses renseignées des Opérations non annulées','cancelled_spent_amount'=>'Dépenses renseignées des Opérations annulées','total_spent_amount'=>'Dépenses renseignées','missing_spent_count'=>'Montants dépensés non renseignés','cancelled_incomplete_count'=>'Opérations annulées non renseignées','activity_count'=>'Activités','operation_count'=>'Opérations');
}

/** Canonical decimals, not human presentation strings. */
function mjl_monitoring_variance($spent, $authorized)
{
	if ($authorized === null) return array('difference'=>null,'percent'=>null,'ratio'=>null,'display'=>'Non renseigné');
	foreach (array($spent,$authorized) as $value) if ($value!==null && ((!is_string($value) && !is_int($value)) || !preg_match('/^(?:0|[1-9][0-9]*)$/',(string)$value))) throw new InvalidArgumentException('INVALID_AMOUNT');
	$authorized=(string)$authorized;
	if ($spent!==null) $spent=(string)$spent;
	if ($spent === null) return array('difference'=>null,'percent'=>null,'ratio'=>null,'display'=>'Non renseigné');
	$comparison = mjl_execution_decimal_compare($spent, $authorized);
	$absolute = $comparison < 0 ? mjl_execution_decimal_subtract($authorized, $spent) : mjl_execution_decimal_subtract($spent, $authorized);
	$sign = $comparison < 0 ? '-' : '';
	if ($authorized === '0') return array('difference'=>$sign.$absolute,'percent'=>null,'ratio'=>null,'display'=>'Non renseigné');
	list($hundredths,$remainder) = mjl_execution_decimal_divmod($absolute.'0000',$authorized);
	if (mjl_execution_decimal_compare(mjl_execution_decimal_add($remainder,$remainder),$authorized) >= 0) $hundredths = mjl_execution_decimal_add($hundredths,'1');
	$digits = str_pad($hundredths,3,'0',STR_PAD_LEFT);
	$percent = $sign.substr($digits,0,-2).'.'.substr($digits,-2);
	$ratio = (float) $absolute / (float) $authorized * ($comparison < 0 ? -1 : 1);
	return array('difference'=>$sign.$absolute,'percent'=>$percent,'ratio'=>$ratio,'display'=>mjl_execution_variance_percent($spent,$authorized));
}

function mjl_monitoring_filters(array $source, $audit = false)
{
	$defaults = array('q'=>'','partner_id'=>'','project_id'=>'','activity_id'=>'','validation_status'=>'','execution_status'=>'','completeness'=>'','type_id'=>'','operation_status'=>'','date_from'=>'','date_to'=>'','grouping'=>'project','page'=>'1');
	if ($audit) $defaults = array('q'=>'','object_type'=>'','object_id'=>'','activity_id'=>'','operation_id'=>'','revision_id'=>'','actor_id'=>'','event_id'=>'','target_version'=>'','audit_action'=>'','result'=>'','date_from'=>'','date_to'=>'','cursor'=>'','direction'=>'desc','page'=>'1');
	foreach ($defaults as $key => $default) {
		if (!isset($source[$key])) continue;
		if (!is_scalar($source[$key])) throw new InvalidArgumentException('INVALID_FILTER');
		$raw = (string) $source[$key];
		if (!preg_match('//u',$raw) || preg_match('/[\x00-\x1F\x7F]/u',$raw) || mb_strlen($raw)>100) throw new InvalidArgumentException('INVALID_FILTER');
		$value = trim($raw);
		if (substr($key,-3)==='_id' || in_array($key,array('page','cursor','target_version'),true)) {
			if ($value!=='' && (!preg_match('/^[1-9][0-9]{0,17}$/',$value))) throw new InvalidArgumentException('INVALID_FILTER');
		}
		if (in_array($key,array('date_from','date_to'),true) && $value!=='') {
			$date=DateTimeImmutable::createFromFormat('!Y-m-d',$value,new DateTimeZone('Africa/Porto-Novo'));
			if (!$date || $date->format('Y-m-d')!==$value) throw new InvalidArgumentException('INVALID_FILTER');
		}
		$enums=array('validation_status'=>array('DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED','ABANDONED'),'execution_status'=>array('NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED'),'completeness'=>array('NOT_STARTED','PARTIAL','COMPLETE'),'operation_status'=>array('TODO','IN_PROGRESS','COMPLETED','CANCELLED'),'result'=>array('SUCCESS','DENIED','FAILED'),'grouping'=>array('project','partner'),'direction'=>array('asc','desc'));
		if ($value!=='' && isset($enums[$key]) && !in_array($value,$enums[$key],true)) throw new InvalidArgumentException('INVALID_FILTER');
		$defaults[$key]=$value;
	}
	if ($defaults['date_from']!=='' && $defaults['date_to']!=='' && $defaults['date_from']>$defaults['date_to']) throw new InvalidArgumentException('INVALID_FILTER');
	if ($defaults['page']==='') $defaults['page']='1';
	if (strlen($defaults['page'])>6 || (int)$defaults['page']>200000) throw new InvalidArgumentException('INVALID_FILTER');
	return $defaults;
}

/** Calendar warnings are computed at read time; editability is supplied by current access policy. */
function mjl_monitoring_deadline_alerts(array $activity, array $operations, $localDate, $canEditExecution)
{
	$operations = array_values(array_filter($operations, function ($operation) { return empty($operation['date_removed']); }));
	$status = mjl_execution_project_status($activity, $operations, $localDate);
	$validated = isset($activity['latest_validated_amount']);
	$terminal = !empty($activity['is_cancelled']) || in_array($activity['validation_status'], array('CANCELLED', 'ABANDONED'), true);
	$alerts = array();
	$zone = new DateTimeZone('Africa/Porto-Novo');
	$start = new DateTimeImmutable($activity['date_start'], $zone);
	$end = new DateTimeImmutable($activity['date_end'], $zone);
	if (!$validated && !$terminal && $localDate >= $start->modify('-7 days')->format('Y-m-d')) {
		$alerts[] = array('code'=>$localDate >= $activity['date_start'] ? 'VALIDATION_LATE' : 'VALIDATION_DUE', 'activity_id'=>$activity['rowid'], 'operation_id'=>null, 'actionable'=>false);
	}
	if ($validated && !$terminal && !in_array($status, array('COMPLETED', 'CANCELLED'), true) && $localDate >= $end->modify('-7 days')->format('Y-m-d')) {
		$alerts[] = array('code'=>$localDate > $activity['date_end'] ? 'COMPLETION_OVERDUE' : 'COMPLETION_DUE', 'activity_id'=>$activity['rowid'], 'operation_id'=>null, 'actionable'=>false);
	}
	if ($validated) foreach ($operations as $operation) {
		if (isset($operation['spent_amount'])) continue;
		$editable = $canEditExecution && !$terminal && $localDate >= $activity['date_start'] && in_array($operation['status'], array('TODO','IN_PROGRESS'), true);
		$informational = $terminal || in_array($operation['status'], array('COMPLETED','CANCELLED'), true);
		if ($editable || $informational) $alerts[] = array('code'=>$editable ? 'SPENDING_MISSING' : 'SPENDING_INFORMATION', 'activity_id'=>$activity['rowid'], 'operation_id'=>$operation['rowid'], 'actionable'=>$editable);
	}
	return $alerts;
}
