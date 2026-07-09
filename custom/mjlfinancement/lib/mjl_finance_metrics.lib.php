<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

function mjl_finance_submitted_amount_sql($alias = 'e')
{
	$alias = mjl_finance_sql_alias($alias);
	return '(CASE WHEN '.$alias.'.status = 1 THEN '.$alias.'.amount ELSE 0 END)';
}

function mjl_finance_prevalidated_amount_sql($alias = 'e')
{
	$alias = mjl_finance_sql_alias($alias);
	return '(CASE WHEN '.$alias.'.status = 4 THEN COALESCE('.$alias.'.prevalidated_amount, '.$alias.'.amount) ELSE 0 END)';
}

function mjl_finance_final_validated_amount_sql($alias = 'e')
{
	$alias = mjl_finance_sql_alias($alias);
	return '(CASE WHEN '.$alias.'.status IN (2, 6, 7) THEN '.mjl_expense_budget_amount_sql($alias).' ELSE 0 END)';
}

function mjl_finance_disbursed_amount_sql($alias = 'e')
{
	$alias = mjl_finance_sql_alias($alias);
	return '(CASE WHEN '.$alias.'.status = 7 THEN '.mjl_expense_disbursed_amount_sql($alias).' ELSE 0 END)';
}

function mjl_finance_metrics_for_budget_line($budgetLineId, $entity = null)
{
	global $db;

	$budgetLineId = (int) $budgetLineId;
	$entity = $entity === null ? mjl_active_entity() : (int) $entity;
	if ($budgetLineId <= 0 || $entity <= 0) {
		return mjl_finance_empty_metrics();
	}

	$sql = 'SELECT bl.initial_budget AS allocated_budget, bl.revised_budget AS revised_budget,';
	$sql .= ' COALESCE(SUM('.mjl_finance_submitted_amount_sql('e').'), 0) AS submitted_amount,';
	$sql .= ' COALESCE(SUM('.mjl_finance_prevalidated_amount_sql('e').'), 0) AS prevalidated_amount,';
	$sql .= ' COALESCE(SUM('.mjl_finance_final_validated_amount_sql('e').'), 0) AS final_validated_amount,';
	$sql .= ' COALESCE(SUM('.mjl_finance_disbursed_amount_sql('e').'), 0) AS disbursed_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.fk_budget_line = bl.rowid AND e.entity = bl.entity';
	$sql .= ' WHERE bl.rowid = '.$budgetLineId.' AND bl.entity = '.$entity;
	$sql .= ' GROUP BY bl.rowid, bl.initial_budget, bl.revised_budget';
	$resql = $db->query($sql);
	if (!$resql) {
		mjl_integrity_set_error($db->lasterror());
		return mjl_finance_empty_metrics();
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		mjl_integrity_set_error('Budget line not found for finance metrics');
		return mjl_finance_empty_metrics();
	}
	return mjl_finance_finalize_metrics((array) $obj);
}

function mjl_finance_empty_metrics()
{
	return array(
		'allocated_budget' => 0.0,
		'revised_budget' => 0.0,
		'submitted_amount' => 0.0,
		'prevalidated_amount' => 0.0,
		'final_validated_amount' => 0.0,
		'disbursed_amount' => 0.0,
		'remaining_amount' => 0.0,
		'validation_rate' => 0.0,
		'execution_rate' => 0.0,
	);
}

function mjl_finance_finalize_metrics($row)
{
	$metrics = mjl_finance_empty_metrics();
	foreach ($metrics as $key => $value) {
		if (array_key_exists($key, $row)) {
			$metrics[$key] = (float) $row[$key];
		}
	}
	$metrics['remaining_amount'] = $metrics['revised_budget'] - $metrics['final_validated_amount'];
	if ($metrics['revised_budget'] > 0) {
		$metrics['validation_rate'] = round(($metrics['final_validated_amount'] / $metrics['revised_budget']) * 100, 2);
		$metrics['execution_rate'] = round(($metrics['disbursed_amount'] / $metrics['revised_budget']) * 100, 2);
	}
	return $metrics;
}

function mjl_finance_sql_alias($alias)
{
	$alias = preg_replace('/[^A-Za-z0-9_]/', '', (string) $alias);
	return $alias === '' ? 'e' : $alias;
}
