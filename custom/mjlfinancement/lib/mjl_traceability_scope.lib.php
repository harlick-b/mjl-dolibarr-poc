<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

/**
 * RST-002A Admin diagnostic predicate.
 *
 * Business roles cannot read the legacy traceability stores. An Admin can read
 * an active-entity row only when its resolved target has a complete,
 * entity-consistent parent chain. A missing target remains visible as an
 * unresolved diagnostic; an ID resolving in another entity is not missing.
 */
function mjl_traceability_scope_sql($auditAlias, $userObj, $entity = null)
{
	global $db, $conf;

	$a = preg_replace('/[^A-Za-z0-9_]/', '', (string) $auditAlias);
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if ($a === '' || $entity <= 0 || !mjl_scope_is_platform_admin($userObj, $entity)) {
		return ' AND 1=0';
	}

	$p = $db->prefix();
	$known = array(
		'mjlfinancement_project' => "{$p}projet",
		'mjlfinancement_activity' => "{$p}mjlfinancement_activity",
		'mjlfinancement_expense' => "{$p}mjlfinancement_expense",
		'mjlfinancement_convention' => "{$p}mjlfinancement_convention",
		'mjlfinancement_budget_line' => "{$p}mjlfinancement_budget_line",
		'mjlfinancement_fund_receipt' => "{$p}mjlfinancement_fund_receipt",
		'mjlfinancement_report' => "{$p}mjlfinancement_report",
	);
	$knownTypes = array_map(function ($type) use ($db) { return "'".$db->escape($type)."'"; }, array_keys($known));
	$clauses = array("{$a}.object_type NOT IN (".implode(',', $knownTypes).')');

	$valid = array();
	$valid['mjlfinancement_project'] = "EXISTS (SELECT 1 FROM {$p}projet o INNER JOIN {$p}societe s ON s.rowid=o.fk_soc AND s.entity=o.entity WHERE o.rowid={$a}.object_id AND o.entity={$a}.entity)";
	$valid['mjlfinancement_convention'] = "EXISTS (SELECT 1 FROM {$p}mjlfinancement_convention o INNER JOIN {$p}societe s ON s.rowid=o.fk_soc AND s.entity=o.entity LEFT JOIN {$p}projet pr ON pr.rowid=o.fk_project AND pr.entity=o.entity AND pr.fk_soc=o.fk_soc WHERE o.rowid={$a}.object_id AND o.entity={$a}.entity AND (o.fk_project IS NULL OR o.fk_project=0 OR pr.rowid IS NOT NULL))";
	$valid['mjlfinancement_activity'] = "EXISTS (SELECT 1 FROM {$p}mjlfinancement_activity o INNER JOIN {$p}projet pr ON pr.rowid=o.fk_project AND pr.entity=o.entity INNER JOIN {$p}societe s ON s.rowid=pr.fk_soc AND s.entity=pr.entity INNER JOIN {$p}mjlfinancement_convention c ON c.rowid=o.fk_convention AND c.entity=o.entity AND c.fk_project=o.fk_project AND c.fk_soc=pr.fk_soc LEFT JOIN {$p}projet_task t ON t.rowid=o.fk_task AND t.entity=o.entity AND t.fk_projet=o.fk_project WHERE o.rowid={$a}.object_id AND o.entity={$a}.entity AND (o.fk_task IS NULL OR o.fk_task=0 OR t.rowid IS NOT NULL))";
	$valid['mjlfinancement_budget_line'] = "EXISTS (SELECT 1 FROM {$p}mjlfinancement_budget_line o INNER JOIN {$p}mjlfinancement_convention c ON c.rowid=o.fk_convention AND c.entity=o.entity INNER JOIN {$p}projet pr ON pr.rowid=c.fk_project AND pr.entity=o.entity AND pr.fk_soc=c.fk_soc INNER JOIN {$p}societe s ON s.rowid=c.fk_soc AND s.entity=o.entity LEFT JOIN {$p}mjlfinancement_activity ac ON ac.rowid=o.fk_mjl_activity AND ac.entity=o.entity AND ac.fk_project=c.fk_project AND ac.fk_convention=c.rowid LEFT JOIN {$p}projet_task t ON t.rowid=o.fk_activity AND t.entity=o.entity AND t.fk_projet=c.fk_project WHERE o.rowid={$a}.object_id AND o.entity={$a}.entity AND (o.fk_project IS NULL OR o.fk_project=0 OR o.fk_project=c.fk_project) AND (o.fk_mjl_activity IS NULL OR o.fk_mjl_activity=0 OR ac.rowid IS NOT NULL) AND (o.fk_activity IS NULL OR o.fk_activity=0 OR t.rowid IS NOT NULL))";
	$valid['mjlfinancement_expense'] = "EXISTS (SELECT 1 FROM {$p}mjlfinancement_expense o INNER JOIN {$p}mjlfinancement_convention c ON c.rowid=o.fk_convention AND c.entity=o.entity AND c.fk_project=o.fk_project INNER JOIN {$p}projet pr ON pr.rowid=o.fk_project AND pr.entity=o.entity AND pr.fk_soc=c.fk_soc INNER JOIN {$p}societe s ON s.rowid=c.fk_soc AND s.entity=o.entity INNER JOIN {$p}mjlfinancement_budget_line bl ON bl.rowid=o.fk_budget_line AND bl.entity=o.entity AND bl.fk_convention=c.rowid AND (bl.fk_project IS NULL OR bl.fk_project=0 OR bl.fk_project=o.fk_project) LEFT JOIN {$p}mjlfinancement_activity ac ON ac.rowid=o.fk_mjl_activity AND ac.entity=o.entity AND ac.fk_project=o.fk_project AND ac.fk_convention=c.rowid WHERE o.rowid={$a}.object_id AND o.entity={$a}.entity AND (o.fk_mjl_activity IS NULL OR o.fk_mjl_activity=0 OR ac.rowid IS NOT NULL))";
	$valid['mjlfinancement_fund_receipt'] = "EXISTS (SELECT 1 FROM {$p}mjlfinancement_fund_receipt o INNER JOIN {$p}mjlfinancement_convention c ON c.rowid=o.fk_convention AND c.entity=o.entity AND c.fk_project=o.fk_project AND c.fk_soc=o.fk_soc INNER JOIN {$p}projet pr ON pr.rowid=o.fk_project AND pr.entity=o.entity AND pr.fk_soc=o.fk_soc INNER JOIN {$p}societe s ON s.rowid=o.fk_soc AND s.entity=o.entity WHERE o.rowid={$a}.object_id AND o.entity={$a}.entity)";
	$valid['mjlfinancement_report'] = "EXISTS (SELECT 1 FROM {$p}mjlfinancement_report o WHERE o.rowid={$a}.object_id AND o.entity={$a}.entity)";

	foreach ($known as $type => $table) {
		$escaped = $db->escape($type);
		$clauses[] = "({$a}.object_type='{$escaped}' AND (NOT EXISTS (SELECT 1 FROM {$table} any_entity WHERE any_entity.rowid={$a}.object_id) OR {$valid[$type]}))";
	}
	return ' AND ('.implode(' OR ', $clauses).')';
}
