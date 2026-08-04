<?php

/** Machine-only alert-condition boundary shared by producers and contracts. */
function mjl_alert_condition_keys()
{
	return array('semantic_key', 'domain', 'object_type', 'object_id', 'partner_id', 'reference', 'domain_label', 'status_code', 'sort_date', 'priority', 'dynamic_actor_role_key', 'facts');
}

function mjl_alert_condition(array $condition)
{
	$normalized = array();
	foreach (mjl_alert_condition_keys() as $key) $normalized[$key] = $condition[$key] ?? null;
	$normalized['semantic_key'] = (string) $normalized['semantic_key'];
	$normalized['domain'] = (string) $normalized['domain'];
	$normalized['object_type'] = (string) $normalized['object_type'];
	$normalized['object_id'] = (int) $normalized['object_id'];
	$normalized['partner_id'] = (int) $normalized['partner_id'];
	$normalized['reference'] = (string) $normalized['reference'];
	$normalized['domain_label'] = (string) $normalized['domain_label'];
	$normalized['sort_date'] = (string) $normalized['sort_date'];
	$normalized['priority'] = (int) $normalized['priority'];
	$normalized['dynamic_actor_role_key'] = (string) $normalized['dynamic_actor_role_key'];
	$normalized['facts'] = (array) $normalized['facts'];
	return $normalized;
}

function mjl_alert_condition_is_raw(array $condition)
{
	return array_keys($condition) === mjl_alert_condition_keys()
		&& is_int($condition['object_id'])
		&& is_int($condition['partner_id'])
		&& is_int($condition['priority'])
		&& is_array($condition['facts'])
		&& !array_intersect(array('severity', 'tone', 'audience', 'expected_action', 'href', 'meta'), array_keys($condition));
}
