<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexchangelog.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';

mjl_workspace_require_advanced_traceability_access($user, 'exchangelog');

$langs->load('mjlfinancement@mjlfinancement');
$action = GETPOST('action', 'alpha');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	accessforbidden('Les echanges se creent depuis les pages contextuelles.');
}

$filters = array(
	'object_type' => GETPOST('object_type', 'alphanohtml'),
	'object_id' => GETPOSTINT('object_id'),
	'channel' => GETPOST('channel', 'alphanohtml'),
);

llxHeader('', 'Echanges MJL');
mjl_navigation_shell_start($user, 'exchanges');
print '<div class="mjl-workspace">';
print load_fiche_titre('Echanges MJL - recherche avancee', '', 'comments');

mjl_exchangelogs_filter_form($filters);
mjl_exchangelogs_list($filters);

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

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
	if ($filters['object_type'] !== '' && mjl_timeline_is_supported_object_type($filters['object_type'])) {
		$where[] = "x.object_type = '".$db->escape($filters['object_type'])."'";
	} elseif ($filters['object_type'] !== '') {
		$where[] = '1=0';
	}
	if ((int) $filters['object_id'] > 0) {
		$where[] = 'x.object_id = '.((int) $filters['object_id']);
	}
	if ($filters['channel'] !== '') {
		$where[] = "x.channel = '".$db->escape($filters['channel'])."'";
	}

	$sql = 'SELECT x.ref, x.object_type, x.object_id, COALESCE(a.ref, e.ref, c.ref, bl.ref, fr.ref, p.ref) AS object_ref, x.exchange_date, u.login, x.actor_role, x.channel, x.subject, x.message';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND x.object_type = \'mjlfinancement_activity\' AND a.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = x.object_id AND x.object_type = \'mjlfinancement_expense\' AND e.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = x.object_id AND x.object_type = \'mjlfinancement_convention\' AND c.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = x.object_id AND x.object_type = \'mjlfinancement_budget_line\' AND bl.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = x.object_id AND x.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = x.object_id AND x.object_type = \'mjlfinancement_project\' AND p.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = x.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_timeline_exchange_scope_filter_sql('x', $user);
	$sql .= ' ORDER BY x.exchange_date DESC, x.rowid DESC LIMIT 200';
	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return;
	}

	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Ref</th><th>Objet</th><th>ID</th><th>Reference objet</th><th>Date</th><th>Acteur</th><th>Role</th><th>Canal</th><th>Sujet</th><th>Message</th></tr>';
	while ($obj = $db->fetch_object($resql)) {
		print '<tr class="oddeven">';
		print '<td>'.dol_escape_htmltag($obj->ref).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_timeline_object_type_label($obj->object_type)).'</td>';
		print '<td>'.((int) $obj->object_id).'</td>';
		print '<td>'.dol_escape_htmltag($obj->object_ref).'</td>';
		print '<td>'.dol_escape_htmltag($obj->exchange_date).'</td>';
		print '<td>'.dol_escape_htmltag($obj->login).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_timeline_actor_role_label($obj->actor_role)).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_timeline_channel_label($obj->channel)).'</td>';
		print '<td>'.dol_escape_htmltag($obj->subject).'</td>';
		print '<td>'.dol_escape_htmltag($obj->message).'</td>';
		print '</tr>';
	}
	print '</table></div>';
}

function mjl_exchangelogs_distinct_options($column)
{
	global $db, $conf, $user;

	if ($column !== 'channel') {
		return array();
	}
	$sql = 'SELECT DISTINCT x.channel AS value FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' WHERE x.entity = '.((int) $conf->entity)." AND x.channel IS NOT NULL AND x.channel <> ''".mjl_timeline_exchange_scope_filter_sql('x', $user).' ORDER BY x.channel';
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
	return mjl_exchangelogs_select($name, mjl_timeline_supported_object_types(), $selected, $emptyLabel);
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
