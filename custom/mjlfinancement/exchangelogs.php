<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexchangelog.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

mjl_workspace_require_advanced_traceability_access($user, 'exchangelog');

$langs->load('mjlfinancement@mjlfinancement');
$action = GETPOST('action', 'alpha');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		accessforbidden('Invalid security token');
	}
	if ($action === 'create' && !$user->hasRight('mjlfinancement', 'exchangelog', 'write')) {
		accessforbidden();
	}
	mjl_exchangelogs_handle_post($action);
}

$mjl_exchangelogs_page_token = function_exists('newToken') ? newToken() : '';
$filters = array(
	'object_type' => GETPOST('object_type', 'alphanohtml'),
	'object_id' => GETPOSTINT('object_id'),
	'channel' => GETPOST('channel', 'alphanohtml'),
);

llxHeader('', 'Echanges MJL');
mjl_navigation_shell_start($user, 'exchanges');
print '<div class="mjl-workspace">';
print load_fiche_titre('Echanges MJL', '', 'comments');

if ($user->hasRight('mjlfinancement', 'exchangelog', 'write')) {
	mjl_exchangelogs_create_form();
}

mjl_exchangelogs_filter_form($filters);
mjl_exchangelogs_list($filters);

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_exchangelogs_handle_post($action)
{
	global $db, $user, $conf;

	if ($action !== 'create') {
		return;
	}

	$objectType = GETPOST('object_type', 'alphanohtml') ?: 'mjlfinancement_activity';
	$objectId = GETPOSTINT('object_id');
	if (!mjl_exchangelogs_object_exists($objectType, $objectId) || !mjl_scope_can_access_object($user, $objectType, $objectId)) {
		setEventMessages('Objet lie introuvable dans l\'entite active', null, 'errors');
		return;
	}

	$log = new MjlExchangeLog($db);
	$log->entity = (int) $conf->entity;
	$log->ref = mjl_exchangelogs_next_ref($objectId);
	$log->object_type = $objectType;
	$log->object_id = $objectId;
	$log->exchange_date = dol_now();
	$log->actor = (int) $user->id;
	$log->actor_role = mjl_exchangelogs_actor_role();
	$log->channel = GETPOST('channel', 'alphanohtml');
	$log->subject = GETPOST('subject', 'restricthtml');
	$log->message = GETPOST('message', 'restricthtml');
	$log->fk_user_creat = (int) $user->id;

	if (trim((string) $log->message) === '') {
		setEventMessages('Message obligatoire', null, 'errors');
		return;
	}

	if ($log->create($user) <= 0) {
		setEventMessages($log->error ?: $db->lasterror(), null, 'errors');
		return;
	}
	setEventMessages('Echange enregistre', null, 'mesgs');
}

function mjl_exchangelogs_create_form()
{
	print '<form method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<input type="hidden" name="action" value="create">';
	print mjl_exchangelogs_token_input();
	print '<table class="border centpercent">';
	print '<tr class="liste_titre"><th colspan="6">Nouvel echange</th></tr>';
	print '<tr><td>Objet</td><td>'.mjl_exchangelogs_object_type_select('object_type', 'mjlfinancement_activity').'</td><td>Activite</td><td>'.mjl_exchangelogs_select('object_id', mjl_exchangelogs_activity_options(), 0, 'Choisir').'</td><td>Canal</td><td>'.mjl_exchangelogs_select('channel', mjl_exchangelogs_channels(), '', 'Choisir').'</td></tr>';
	print '<tr><td>Role acteur</td><td>'.mjl_exchangelogs_select('actor_role', mjl_exchangelogs_roles(), mjl_exchangelogs_actor_role(), '').'</td><td>Sujet</td><td colspan="3"><input class="flat minwidth500" name="subject"></td></tr>';
	print '<tr><td>Message</td><td colspan="5"><textarea required class="flat centpercent" name="message" rows="3"></textarea></td></tr>';
	print '<tr><td colspan="6" class="right"><input class="button" type="submit" value="Enregistrer"></td></tr>';
	print '</table></form><br>';
}

function mjl_exchangelogs_filter_form($filters)
{
	print '<form method="GET" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Objet</th><th>ID objet</th><th>Canal</th><th></th></tr><tr class="oddeven">';
	print '<td>'.mjl_exchangelogs_object_type_select('object_type', $filters['object_type'], 'Tous').'</td>';
	print '<td><input type="number" name="object_id" value="'.dol_escape_htmltag($filters['object_id']).'"></td>';
	print '<td>'.mjl_exchangelogs_select('channel', mjl_exchangelogs_distinct_options('channel'), $filters['channel'], 'Tous').'</td>';
	print '<td><input class="button" type="submit" value="Afficher"></td>';
	print '</tr></table></div></form><br>';
}

function mjl_exchangelogs_list($filters)
{
	global $db, $conf, $user;

	$where = array('x.entity = '.((int) $conf->entity));
	if ($filters['object_type'] !== '') {
		$where[] = "x.object_type = '".$db->escape($filters['object_type'])."'";
	}
	if ((int) $filters['object_id'] > 0) {
		$where[] = 'x.object_id = '.((int) $filters['object_id']);
	}
	if ($filters['channel'] !== '') {
		$where[] = "x.channel = '".$db->escape($filters['channel'])."'";
	}

	$sql = 'SELECT x.ref, x.object_type, x.object_id, a.ref AS activity_ref, x.exchange_date, u.login, x.actor_role, x.channel, x.subject, x.message';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND x.object_type = \'mjlfinancement_activity\' AND a.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = x.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_scope_partner_sql_filter('c.fk_soc', $user);
	$sql .= ' ORDER BY x.exchange_date DESC, x.rowid DESC LIMIT 200';
	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return;
	}

	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Ref</th><th>Objet</th><th>ID</th><th>Ref activite</th><th>Date</th><th>Acteur</th><th>Role</th><th>Canal</th><th>Sujet</th><th>Message</th></tr>';
	while ($obj = $db->fetch_object($resql)) {
		print '<tr class="oddeven">';
		print '<td>'.dol_escape_htmltag($obj->ref).'</td>';
		print '<td>'.dol_escape_htmltag($obj->object_type).'</td>';
		print '<td>'.((int) $obj->object_id).'</td>';
		print '<td>'.dol_escape_htmltag($obj->activity_ref).'</td>';
		print '<td>'.dol_escape_htmltag($obj->exchange_date).'</td>';
		print '<td>'.dol_escape_htmltag($obj->login).'</td>';
		print '<td>'.dol_escape_htmltag($obj->actor_role).'</td>';
		print '<td>'.dol_escape_htmltag($obj->channel).'</td>';
		print '<td>'.dol_escape_htmltag($obj->subject).'</td>';
		print '<td>'.dol_escape_htmltag($obj->message).'</td>';
		print '</tr>';
	}
	print '</table></div>';
}

function mjl_exchangelogs_activity_options()
{
	global $db, $conf, $user;

	$sql = 'SELECT a.rowid, a.ref, a.label FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('c.fk_soc', $user).' ORDER BY a.ref';
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$options = array();
	while ($obj = $db->fetch_object($resql)) {
		$options[(int) $obj->rowid] = $obj->ref.' - '.$obj->label;
	}
	return $options;
}

function mjl_exchangelogs_object_exists($objectType, $objectId)
{
	global $db, $conf;

	if ($objectType !== 'mjlfinancement_activity' || (int) $objectId <= 0) {
		return false;
	}
	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_activity WHERE rowid = '.((int) $objectId).' AND entity = '.((int) $conf->entity);
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_exchangelogs_next_ref($objectId)
{
	return 'EXC-ACT-'.((int) $objectId).'-'.date('YmdHis').'-'.substr(str_replace('.', '', (string) microtime(true)), -6);
}

function mjl_exchangelogs_distinct_options($column)
{
	global $db, $conf, $user;

	if ($column !== 'channel') {
		return array();
	}
	$sql = 'SELECT DISTINCT x.channel AS value FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND x.object_type = \'mjlfinancement_activity\' AND a.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE x.entity = '.((int) $conf->entity)." AND x.channel IS NOT NULL AND x.channel <> ''".mjl_scope_partner_sql_filter('c.fk_soc', $user).' ORDER BY x.channel';
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$options = array();
	while ($obj = $db->fetch_object($resql)) {
		$options[(string) $obj->value] = (string) $obj->value;
	}
	return $options;
}

function mjl_exchangelogs_object_type_select($name, $selected, $emptyLabel = '')
{
	return mjl_exchangelogs_select($name, array('mjlfinancement_activity' => 'Activite'), $selected, $emptyLabel);
}

function mjl_exchangelogs_channels()
{
	return array('email' => 'Email', 'telephone' => 'Telephone', 'reunion' => 'Reunion', 'courrier' => 'Courrier', 'autre' => 'Autre');
}

function mjl_exchangelogs_roles()
{
	return array('AGENT_SAISIE' => 'Agent de saisie', 'AGENT_VERIFICATEUR' => 'Agent verificateur', 'VALIDATEUR_DEFINITIF' => 'Validateur definitif', 'ADMIN_PLATEFORME' => 'Admin plateforme');
}

function mjl_exchangelogs_select($name, $options, $selected, $emptyLabel)
{
	$html = '<select name="'.dol_escape_htmltag($name).'">';
	if ($emptyLabel !== '') {
		$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	}
	foreach ($options as $value => $label) {
		$html .= '<option value="'.dol_escape_htmltag($value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	$html .= '</select>';
	return $html;
}

function mjl_exchangelogs_token_input()
{
	global $mjl_exchangelogs_page_token;

	return '<input type="hidden" name="token" value="'.dol_escape_htmltag($mjl_exchangelogs_page_token).'">';
}

function mjl_exchangelogs_actor_role()
{
	global $user;
	if (mjl_scope_is_platform_admin($user)) return 'ADMIN_PLATEFORME';
	if (mjl_scope_is_final_validator($user)) return 'VALIDATEUR_DEFINITIF';
	if (mjl_scope_is_verifier($user)) return 'AGENT_VERIFICATEUR';
	if (mjl_scope_is_input_agent($user)) return 'AGENT_SAISIE';
	return 'PROFIL_NON_RESOLU';
}
