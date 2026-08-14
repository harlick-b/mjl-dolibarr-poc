<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';

function mjl_reference_route($kind)
{
	global $user;
	$config = mjl_reference_config($kind);
	$queryHasId = array_key_exists('id', $_GET);
	$postHasId = array_key_exists('id', $_POST);
	$queryId = $queryHasId && is_scalar($_GET['id']) && preg_match('/^[1-9][0-9]*$/', (string) $_GET['id']) ? (int) $_GET['id'] : 0;
	$postId = $postHasId && is_scalar($_POST['id']) && preg_match('/^[1-9][0-9]*$/', (string) $_POST['id']) ? (int) $_POST['id'] : 0;
	if (($queryHasId && $queryId <= 0) || ($postHasId && $postId <= 0) || ($queryHasId && $postHasId && $queryId !== $postId)) mjl_reference_forbidden();
	$id = $postHasId ? $postId : $queryId;
	$action = (string) GETPOST('action', 'alphanohtml');
	$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
	$allowedGet = array('', 'create', 'edit');
	$allowedPost = array('create', 'update', 'activate', 'deactivate');
	if (($method === 'GET' && !in_array($action, $allowedGet, true)) || ($method === 'POST' && !in_array($action, $allowedPost, true)) || !in_array($method, array('GET', 'POST'), true)) mjl_reference_forbidden();
	if ($method === 'POST' && (($action === 'create' && ($queryHasId || $postHasId)) || ($action !== 'create' && (!$queryHasId || !$postHasId || $id <= 0)))) mjl_reference_forbidden();
	if ($method === 'POST') mjl_reference_route_post($kind, $config, $id, $action);

	$row = $id > 0 ? mjl_reference_fetch($kind, $id) : array();
	if ($id > 0 && (empty($row) || (!mjl_reference_can_manage($user) && !mjl_reference_is_reader_visible($kind, $row)))) mjl_reference_forbidden();
	if ($action !== '' && !mjl_reference_can_manage($user)) mjl_reference_forbidden();
	if ($action === 'create' && $id > 0) mjl_reference_forbidden();
	if ($action === 'edit' && $id <= 0) mjl_reference_forbidden();

	$recovery = mjl_reference_route_recovery($config, $id, $action);
	llxHeader('', $config['title'].' MJL');
	mjl_navigation_shell_start($user);
	print '<div class="mjl-workspace">';
	if ($action === 'create' || $action === 'edit') mjl_reference_render_form($kind, $config, $row, $action, $recovery);
	elseif ($id > 0) mjl_reference_render_detail($kind, $config, $row);
	else mjl_reference_render_list($kind, $config);
	print '</div>';
	mjl_navigation_shell_end();
	llxFooter();
}

function mjl_reference_context($config, $action, $id)
{
	global $conf, $user;
	return array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => $config['route'], 'form' => 'reference', 'action' => $action, 'object_id' => (int) $id);
}

function mjl_reference_route_post($kind, $config, $id, $action)
{
	global $user;
	mjl_reference_require_manage($user);
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) mjl_reference_forbidden('Invalid security token');
	$expectedId = $action === 'create' ? 0 : (int) $id;
	if (($action !== 'create' && $expectedId <= 0) || !mjl_form_submission_consume(GETPOST('mjl_submission', 'alphanohtml'), mjl_reference_context($config, $action, $expectedId))) mjl_reference_forbidden();
	$label = mjl_reference_label_from_request();
	$error = '';
	$resultId = $expectedId;
	if ($action === 'create') {
		list($resultId, $error) = mjl_reference_create($kind, $label, GETPOSTINT('partner_id'));
	} elseif ($action === 'update') {
		$error = mjl_reference_update_label($kind, $expectedId, $label, GETPOST('fingerprint', 'alphanohtml'));
	} else {
		$error = mjl_reference_set_active($kind, $expectedId, $action === 'activate', GETPOST('fingerprint', 'alphanohtml'));
	}
	if ($error !== '') {
		$values = array('label' => $label);
		$partner = GETPOSTINT('partner_id');
		if ($kind === 'project' && $partner > 0 && !empty(mjl_reference_fetch('partner', $partner))) $values['partner_alias'] = (string) $partner;
		$reason = '';
		$handle = mjl_form_recovery_store(mjl_reference_context($config, $action, $expectedId), $values, array('label', 'partner_alias'), $reason, array('_form' => $error));
		mjl_feedback_add('reference:'.$config['route'].':'.$action.':'.$expectedId.':error', 'generic.validation');
		$viewAction = $action === 'create' ? 'create' : ($action === 'update' ? 'edit' : '');
		mjl_reference_redirect($config, $expectedId, $viewAction, $handle);
	}
	mjl_feedback_add('reference:'.$config['route'].':'.$action.':'.$resultId, 'generic.saved');
	mjl_reference_redirect($config, $resultId);
}

function mjl_reference_route_recovery($config, $id, $action)
{
	if (!in_array($action, array('create', 'edit'), true)) return array('values' => array(), 'errors' => array());
	$storedAction = $action === 'create' ? 'create' : 'update';
	$entry = mjl_form_recovery_consume(GETPOST('mjl_recovery', 'alphanohtml'), mjl_reference_context($config, $storedAction, (int) $id));
	return is_array($entry) ? array('values' => (array) ($entry['values'] ?? array()), 'errors' => (array) ($entry['errors'] ?? array())) : array('values' => array(), 'errors' => array());
}

function mjl_reference_redirect($config, $id = 0, $action = '', $handle = '')
{
	$query = array();
	if ((int) $id > 0) $query['id'] = (int) $id;
	if ($action !== '') $query['action'] = $action;
	if ($handle !== '') $query['mjl_recovery'] = $handle;
	header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php'.($query ? '?'.http_build_query($query) : ''));
	exit;
}

function mjl_reference_render_list($kind, $config)
{
	global $user;
	$options = array('description' => 'Gérer les références métier de l’espace MJL.');
	if (mjl_reference_can_manage($user)) $options['primary_action'] = array('label' => 'Créer un '.$config['singular'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php?action=create');
	print mjl_page_header_render($config['title'], $options);
	$rows = mjl_reference_list($kind);
	print '<section class="mjl-workspace-section">';
	if (!$rows) print mjl_ui_system_state('initial-empty', 'Aucune référence', 'Aucun élément n’est encore enregistré.');
	else {
		print '<div class="div-table-responsive-no-min"><table class="noborder centpercent" aria-label="'.$config['title'].'"><thead><tr class="liste_titre"><th>'.$config['singular'].'</th>'.($kind === 'project' ? '<th>Partenaire</th>' : '').'<th>Statut</th></tr></thead><tbody>';
		foreach ($rows as $row) {
			$url = DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php?id='.((int) $row['rowid']);
			print '<tr class="oddeven mjl-row-interactive"><td data-label="'.$config['singular'].'"><a class="mjl-table-link" href="'.$url.'">'.dol_escape_htmltag($row['label']).'</a></td>';
			if ($kind === 'project') print '<td data-label="Partenaire">'.dol_escape_htmltag($row['parent_label']).'</td>';
			print '<td data-label="Statut">'.((int) $row['active'] === 1 ? 'Actif' : 'Inactif').'</td></tr>';
		}
		print '</tbody></table></div>';
	}
	print '</section>';
}

function mjl_reference_render_detail($kind, $config, $row)
{
	global $user;
	$field = $config['field'];
	$options = array('breadcrumb' => array(array('label' => $config['title'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php'), array('label' => $row[$field])), 'description' => mjl_reference_is_active($kind, $row) ? 'Référence active' : 'Référence inactive');
	if (mjl_reference_can_manage($user)) $options['primary_action'] = array('label' => 'Modifier', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php?id='.((int) $row['rowid']).'&action=edit');
	print mjl_page_header_render($config['singular'].' '.$row[$field], $options);
	print '<section class="mjl-workspace-section"><dl class="mjl-activity-meta"><div><dt>Libellé</dt><dd>'.dol_escape_htmltag($row[$field]).'</dd></div>';
	if ($kind === 'project') print '<div><dt>Partenaire</dt><dd>'.dol_escape_htmltag($row['partner_name']).'</dd></div>';
	print '<div><dt>Statut</dt><dd>'.(mjl_reference_is_active($kind, $row) ? 'Actif' : 'Inactif').'</dd></div></dl>';
	if (mjl_reference_can_manage($user)) {
		$action = mjl_reference_is_active($kind, $row) ? 'deactivate' : 'activate';
		$label = $action === 'activate' ? 'Activer' : 'Désactiver';
		print '<form method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php?id='.((int) $row['rowid']).'">'.mjl_reference_hidden_fields($config, $action, (int) $row['rowid'], mjl_reference_fingerprint($kind, $row)).'<button class="button" type="submit">'.$label.'</button></form>';
	}
	print '</section>';
}

function mjl_reference_render_form($kind, $config, $row, $action, $recovery)
{
	$isCreate = $action === 'create';
	$storedAction = $isCreate ? 'create' : 'update';
	$id = $isCreate ? 0 : (int) $row['rowid'];
	$field = $config['field'];
	$label = $recovery['values']['label'] ?? ($isCreate ? '' : $row[$field]);
	print mjl_page_header_render(($isCreate ? 'Créer un ' : 'Modifier le ').$config['singular'], array('description' => 'Les champs obligatoires sont indiqués.'));
	print '<section class="mjl-workspace-section mjl-activity-panel">'.mjl_form_error_summary($recovery['errors'], 'Corrigez les champs indiqués', 'mjl-reference-', !empty($recovery['errors']));
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php'.($id ? '?id='.$id : '').'">'.mjl_reference_hidden_fields($config, $storedAction, $id, $isCreate ? '' : mjl_reference_fingerprint($kind, $row));
	print mjl_form_field('label', 'Libellé', '<input required maxlength="255" name="label" value="'.dol_escape_htmltag($label).'">', true, '', '', 'mjl-reference-');
	if ($kind === 'project' && $isCreate) {
		$selected = (int) ($recovery['values']['partner_alias'] ?? 0);
		$select = '<select required name="partner_id"><option value="">Sélectionner</option>';
		foreach (mjl_reference_active_partners() as $partner) $select .= '<option value="'.((int) $partner['rowid']).'"'.($selected === (int) $partner['rowid'] ? ' selected' : '').'>'.dol_escape_htmltag($partner['nom']).'</option>';
		$select .= '</select>';
		print mjl_form_field('partner_id', 'Partenaire', $select, true, '', '', 'mjl-reference-');
	}
	print '<div class="mjl-activity-form-actions"><button class="button" type="submit">Enregistrer</button><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php'.($id ? '?id='.$id : '').'">Annuler</a></div></form></section>';
}

function mjl_reference_hidden_fields($config, $action, $id, $fingerprint)
{
	$html = '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="mjl_submission" value="'.dol_escape_htmltag(mjl_form_submission_issue(mjl_reference_context($config, $action, $id))).'"><input type="hidden" name="action" value="'.$action.'">';
	if ($id > 0) $html .= '<input type="hidden" name="id" value="'.$id.'">';
	if ($fingerprint !== '') $html .= '<input type="hidden" name="fingerprint" value="'.$fingerprint.'">';
	return $html;
}
