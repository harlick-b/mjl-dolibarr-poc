<?php

/**
 * Render prepared Partner or Project list data without request, policy, session,
 * or persistence access.
 *
 * @param array<string, mixed> $view Prepared list values.
 * @return string
 */
function mjl_reference_list_present($view)
{
	return require dirname(__DIR__, 2).'/tpl/reference/list.php';
}
