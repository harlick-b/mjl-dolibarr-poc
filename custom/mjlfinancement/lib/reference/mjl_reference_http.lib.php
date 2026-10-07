<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference_route.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference_ui.lib.php';
require_once __DIR__.'/mjl_reference_list_presentation.lib.php';

/**
 * Own the Partner/Project HTTP handoff and render the GET list selected by W1.
 *
 * Other methods, actions, and identifier-bearing requests remain under the
 * existing reference route. The retained read module still consumes the
 * characterized Dolibarr globals while this handler receives its actor
 * explicitly.
 *
 * @param string $kind
 * @param User $targetUser
 * @param array<string, mixed> $request Normalized adapter-captured request facts.
 * @return void
 */
function mjl_reference_http_handle($kind, User $targetUser, $request)
{
	if (!in_array($kind, array('partner', 'project'), true)) mjl_reference_forbidden();
	mjl_reference_require_read($targetUser);
	$isListGet = ($request['method'] ?? '') === 'GET'
		&& ($request['action'] ?? '') === ''
		&& ($request['query_has_id'] ?? true) === false
		&& ($request['post_has_id'] ?? true) === false;
	if (!$isListGet) {
		mjl_reference_route($kind);
		return;
	}

	$config = mjl_reference_config($kind);
	$canManage = mjl_reference_can_manage($targetUser);
	$options = array('description' => 'Gérer les références métier de l’espace MJL.');
	if ($canManage) {
		$options['primary_action'] = array(
			'label' => 'Créer un '.$config['singular'],
			'href' => DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php?action=create',
		);
	}
	$view = array(
		'kind' => $kind,
		'config' => $config,
		'rows' => mjl_reference_list($kind),
		'can_manage' => $canManage,
		'header_options' => $options,
	);

	llxHeader('', $config['title'].' MJL');
	mjl_navigation_shell_start($targetUser);
	print '<div class="mjl-workspace">'.mjl_reference_list_present($view).'</div>';
	mjl_navigation_shell_end();
	llxFooter();
}
