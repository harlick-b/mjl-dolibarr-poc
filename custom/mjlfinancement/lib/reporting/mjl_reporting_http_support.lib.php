<?php

require_once dirname(__DIR__).'/mjl_http.lib.php';

function mjl_reporting_require_actor($type, $user, $entity)
{
	$roles = $type === 'audit'
		? array('VALIDATEUR_DEFINITIF', 'ADMIN_PLATEFORME')
		: array('AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF');
	if (!in_array(mjl_scope_effective_role_code($user, (int) $entity), $roles, true)) mjl_http_error(403, 'Accès au rapport non autorisé.');
}

/** Only implemented reports may select a type; callbacks never come from requests. */
function mjl_reporting_route_type(array &$source)
{
	$type = array_key_exists('report', $source) ? $source['report'] : 'activities';
	if (!is_string($type) || !in_array($type, array('activities', 'operations', 'activity_detail', 'portfolio', 'audit'), true)) throw new InvalidArgumentException('INVALID_REPORT');
	unset($source['report']);
	return $type;
}
