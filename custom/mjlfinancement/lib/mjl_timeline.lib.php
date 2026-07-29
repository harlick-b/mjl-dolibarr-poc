<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexchangelog.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline_result.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';

function mjl_timeline_supported_object_types()
{
	return array(
		'mjlfinancement_project' => 'Projet',
		'mjlfinancement_activity' => 'Activite',
		'mjlfinancement_expense' => 'Depense',
		'mjlfinancement_convention' => 'Enveloppe de financement',
		'mjlfinancement_budget_line' => 'Ligne budgetaire',
		'mjlfinancement_fund_receipt' => 'Fonds recu',
	);
}

function mjl_timeline_is_supported_object_type($objectType)
{
	$types = mjl_timeline_supported_object_types();
	return isset($types[(string) $objectType]);
}

function mjl_timeline_object_type_label($objectType)
{
	$types = mjl_timeline_supported_object_types();
	return isset($types[(string) $objectType]) ? $types[(string) $objectType] : (string) $objectType;
}

function mjl_timeline_channel_labels()
{
	return array(
		'commentaire' => 'Commentaire',
		'email' => 'Email',
		'telephone' => 'Telephone',
		'reunion' => 'Reunion',
		'courrier' => 'Courrier',
		'autre' => 'Autre',
	);
}

function mjl_timeline_channel_label($channel)
{
	$labels = mjl_timeline_channel_labels();
	return isset($labels[(string) $channel]) ? $labels[(string) $channel] : (string) $channel;
}

function mjl_timeline_actor_role(User $targetUser)
{
	if (mjl_scope_is_platform_admin($targetUser)) return 'ADMIN_PLATEFORME';
	if (mjl_scope_is_final_validator($targetUser)) return 'VALIDATEUR_DEFINITIF';
	if (mjl_scope_is_verifier($targetUser)) return 'AGENT_VERIFICATEUR';
	if (mjl_scope_is_input_agent($targetUser)) return 'AGENT_SAISIE';
	return 'PROFIL_NON_RESOLU';
}

function mjl_timeline_actor_role_label($roleCode)
{
	return mjl_scope_role_label($roleCode);
}

function mjl_timeline_can_comment(User $targetUser)
{
	return mjl_workspace_user_has_production_access($targetUser)
		&& $targetUser->hasRight('mjlfinancement', 'exchangelog', 'write');
}

function mjl_timeline_object_exists($objectType, $objectId, $entity = null)
{
	global $db, $conf;

	$objectType = (string) $objectType;
	$objectId = (int) $objectId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if (!mjl_timeline_is_supported_object_type($objectType) || $objectId <= 0 || $entity <= 0) {
		return false;
	}
	$table = mjl_timeline_object_table($objectType);
	if ($table === '') {
		return false;
	}
	$sql = 'SELECT rowid FROM '.$db->prefix().$table.' WHERE entity = '.$entity.' AND rowid = '.$objectId;
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_timeline_create_comment(User $actor, $objectType, $objectId, $message, $subject = '')
{
	global $db, $conf;

	$objectType = (string) $objectType;
	$objectId = (int) $objectId;
	$message = trim((string) $message);
	$subject = trim((string) $subject);
	if (!mjl_timeline_can_comment($actor)) {
		return array(-1, 'Permission commentaire refusee');
	}
	if (!mjl_timeline_object_exists($objectType, $objectId, (int) $conf->entity)) {
		return array(-1, 'Objet lie introuvable dans l entite active');
	}
	if ($message === '') {
		return array(-1, 'Le commentaire est obligatoire.');
	}
	if ($subject === '') {
		$subject = 'Commentaire';
	}

	$log = new MjlExchangeLog($db);
	$log->entity = (int) $conf->entity;
	$log->ref = mjl_timeline_next_exchange_ref($objectType, $objectId);
	$log->object_type = $objectType;
	$log->object_id = $objectId;
	$log->exchange_date = dol_now();
	$log->actor = (int) $actor->id;
	$log->actor_role = mjl_timeline_actor_role($actor);
	$log->channel = 'commentaire';
	$log->subject = $subject;
	$log->message = $message;
	$log->fk_user_creat = (int) $actor->id;
	$result = $log->create($actor);
	if ($result <= 0) {
		mjl_ui_log_error('database', array('route' => 'timeline', 'action' => 'create_comment', 'entity' => (int) $conf->entity, 'user_id' => (int) $actor->id, 'object_type' => $objectType, 'object_id' => $objectId), $log->error ?: $db->lasterror());
		return array(-1, 'Le commentaire n’a pas pu être ajouté. Veuillez réessayer.');
	}
	return array((int) $result, 'Commentaire ajoute.');
}

function mjl_timeline_exchange_items($objectType, $objectId, $ascending = true)
{
	$result = mjl_timeline_exchange_result($objectType, $objectId, $ascending);
	return $result['items'];
}

function mjl_timeline_exchange_result($objectType, $objectId, $ascending = true)
{
	global $db, $conf;

	if (!mjl_timeline_is_supported_object_type($objectType) || (int) $objectId <= 0) {
		return array('source' => 'comments', 'order' => 30, 'items' => array(), 'errors' => array());
	}
	$order = $ascending ? 'ASC' : 'DESC';
	$sql = 'SELECT x.rowid, x.exchange_date, x.subject, x.message, x.actor_role, x.channel, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = x.actor';
	$sql .= ' WHERE x.entity = '.((int) $conf->entity);
	$sql .= " AND x.object_type = '".$db->escape((string) $objectType)."'";
	$sql .= ' AND x.object_id = '.((int) $objectId);
	$sql .= ' ORDER BY x.exchange_date '.$order.', x.rowid '.$order;
	$resql = $db->query($sql);
	if (!$resql) {
		mjl_ui_log_error('database', array('route' => 'timeline', 'action' => 'load_comments', 'entity' => (int) $conf->entity, 'object_type' => $objectType, 'object_id' => (int) $objectId), $db->lasterror());
		return array('source' => 'comments', 'order' => 30, 'items' => array(), 'errors' => array('database'));
	}
	$items = array();
	while ($obj = $db->fetch_object($resql)) {
		$items[] = array(
			'rowid' => (int) $obj->rowid,
			'label' => mjl_timeline_channel_label($obj->channel),
			'title' => trim((string) $obj->subject) !== '' ? (string) $obj->subject : 'Commentaire',
			'meta' => mjl_timeline_format_datetime($obj->exchange_date).' par '.($obj->login ?: 'systeme').' ('.mjl_timeline_actor_role_label($obj->actor_role).')',
			'comment' => (string) $obj->message,
			'changes' => array(),
			'sort_date' => (string) $obj->exchange_date,
		);
	}
	return array('source' => 'comments', 'order' => 30, 'items' => $items, 'errors' => array());
}

function mjl_timeline_render($result, $emptyMessage = 'Aucun événement enregistré.')
{
	if (!empty($result['errors'])) {
		print mjl_ui_system_state('partial-error', 'Historique partiellement disponible', mjl_ui_safe_error_message('timeline'));
	}
	if (empty($result['items'])) {
		print mjl_ui_system_state('initial-empty', 'Historique vide', $emptyMessage);
		return;
	}
	print '<ol class="mjl-activity-timeline">';
	foreach ($result['items'] as $item) {
		print '<li><span class="mjl-status-pill">'.dol_escape_htmltag($item['label'] ?? 'Événement').'</span>';
		print '<strong>'.dol_escape_htmltag($item['title'] ?? 'Événement').'</strong>';
		if (!empty($item['meta'])) print '<p>'.dol_escape_htmltag($item['meta']).'</p>';
		if (!empty($item['comment'])) print '<p class="mjl-timeline-comment">'.dol_escape_htmltag($item['comment']).'</p>';
		if (!empty($item['changes'])) {
			print '<dl class="mjl-timeline-changes">';
			foreach ($item['changes'] as $label => $value) {
				print '<div><dt>'.dol_escape_htmltag($label).'</dt><dd>'.dol_escape_htmltag($value).'</dd></div>';
			}
			print '</dl>';
		}
		print '</li>';
	}
	print '</ol>';
}

function mjl_timeline_render_comment_form($objectType, $objectId, $actionUrl, $recovery = array())
{
	global $user;

	if (!mjl_timeline_can_comment($user)) {
		return;
	}
	print '<form class="mjl-activity-action-form" method="POST" action="'.dol_escape_htmltag($actionUrl).'">';
	print '<input type="hidden" name="token" value="'.dol_escape_htmltag(function_exists('newToken') ? newToken() : '').'">';
	print '<input type="hidden" name="action" value="add_exchange">';
	print '<input type="hidden" name="object_type" value="'.dol_escape_htmltag($objectType).'">';
	print '<input type="hidden" name="id" value="'.((int) $objectId).'">';
	if (!empty($recovery['errors']) && function_exists('mjl_form_error_summary')) print mjl_form_error_summary($recovery['errors']);
	print '<label>Commentaire<textarea required name="message">'.dol_escape_htmltag($recovery['values']['message'] ?? '').'</textarea></label>';
	print '<div><button class="button" type="submit">Ajouter le commentaire</button></div>';
	print '</form>';
}

function mjl_timeline_render_contextual_exchange_section($objectType, $objectId, $actionUrl)
{
	$result = mjl_timeline_exchange_result($objectType, $objectId, false);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Commentaires contextuels</h2><p>Echanges rattaches directement a cet objet.</p></div>';
	mjl_timeline_render_comment_form($objectType, $objectId, $actionUrl);
	mjl_timeline_render(array('items' => $result['items'], 'errors' => $result['errors']), 'Aucun commentaire contextuel.');
	print '</section>';
}

function mjl_timeline_next_exchange_ref($objectType, $objectId)
{
	$abbr = array(
		'mjlfinancement_project' => 'PRJ',
		'mjlfinancement_activity' => 'ACT',
		'mjlfinancement_expense' => 'EXP',
		'mjlfinancement_convention' => 'CNV',
		'mjlfinancement_budget_line' => 'BUD',
		'mjlfinancement_fund_receipt' => 'FR',
	);
	$prefix = isset($abbr[(string) $objectType]) ? $abbr[(string) $objectType] : 'OBJ';
	return 'EXC-'.$prefix.'-'.((int) $objectId).'-'.date('YmdHis').'-'.substr(str_replace('.', '', (string) microtime(true)), -6);
}

function mjl_timeline_object_table($objectType)
{
	$map = array(
		'mjlfinancement_project' => 'projet',
		'mjlfinancement_activity' => 'mjlfinancement_activity',
		'mjlfinancement_expense' => 'mjlfinancement_expense',
		'mjlfinancement_convention' => 'mjlfinancement_convention',
		'mjlfinancement_budget_line' => 'mjlfinancement_budget_line',
		'mjlfinancement_fund_receipt' => 'mjlfinancement_fund_receipt',
	);
	return isset($map[(string) $objectType]) ? $map[(string) $objectType] : '';
}

function mjl_timeline_exchange_scope_filter_sql($alias, User $targetUser)
{
	global $db, $conf;

	$a = preg_replace('/[^A-Za-z0-9_]/', '', (string) $alias);
	if ($a === '') {
		return ' AND 1=0';
	}
	$scopeIds = mjl_scope_user_soc_ids($targetUser);
	if ($scopeIds === null) {
		return '';
	}
	if (empty($scopeIds)) {
		return ' AND 1=0';
	}
	$ids = implode(',', array_map('intval', $scopeIds));
	$entity = (int) $conf->entity;
	return ' AND ('
		.' EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE '.$a.'.object_type = \'mjlfinancement_activity\' AND '.$a.'.object_id = a.rowid AND a.entity = '.$entity.' AND c.fk_soc IN ('.$ids.'))'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE '.$a.'.object_type = \'mjlfinancement_expense\' AND '.$a.'.object_id = e.rowid AND e.entity = '.$entity.' AND c.fk_soc IN ('.$ids.'))'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_convention c WHERE '.$a.'.object_type = \'mjlfinancement_convention\' AND '.$a.'.object_id = c.rowid AND c.entity = '.$entity.' AND c.fk_soc IN ('.$ids.'))'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE '.$a.'.object_type = \'mjlfinancement_budget_line\' AND '.$a.'.object_id = bl.rowid AND bl.entity = '.$entity.' AND c.fk_soc IN ('.$ids.'))'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE '.$a.'.object_type = \'mjlfinancement_fund_receipt\' AND '.$a.'.object_id = fr.rowid AND fr.entity = '.$entity.' AND fr.fk_soc IN ('.$ids.'))'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'projet p WHERE '.$a.'.object_type = \'mjlfinancement_project\' AND '.$a.'.object_id = p.rowid AND p.entity = '.$entity.' AND p.fk_soc IN ('.$ids.'))'
		.')';
}

function mjl_timeline_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'dayhour') : (string) $value;
}
