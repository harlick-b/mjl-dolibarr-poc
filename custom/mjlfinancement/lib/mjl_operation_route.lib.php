<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_presentation.lib.php';

function mjl_operation_route()
{
	global $db, $conf, $user;
	if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET' || empty($user->id) || !mjl_activity_access_can_enter_list($user)) {
		http_response_code(403); header('Content-Type: text/plain; charset=UTF-8'); print 'Forbidden'; return;
	}
	foreach (array_keys($_GET) as $key) if ($key !== 'page') { http_response_code(403); print 'Forbidden'; return; }
	$page = 1;
	if (isset($_GET['page'])) {
		$value = is_scalar($_GET['page']) ? (string) $_GET['page'] : '';
		if (preg_match('/^[1-9][0-9]*$/', $value) !== 1 || strlen($value) > 18 || (int) $value > intdiv(PHP_INT_MAX, 50)) { http_response_code(400); print 'Requête non valide'; return; }
		$page = (int) $value;
	}
	$entity = (int) $conf->entity;
	$offset = ($page - 1) * 50;
	$sql = 'SELECT o.rowid,o.name,o.authorized_amount,o.status,a.rowid AS activity_id,a.ref AS activity_ref,a.name AS activity_name,t.label AS type_label,p.ref AS project_ref,p.title AS project_title,s.nom AS partner_name';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_operation o INNER JOIN '.$db->prefix().'mjlfinancement_activity a ON a.entity=o.entity AND a.rowid=o.fk_activity';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_operation_type t ON t.entity=o.entity AND t.rowid=o.fk_operation_type';
	$sql .= ' INNER JOIN '.$db->prefix().'projet p ON p.entity=a.entity AND p.rowid=a.fk_project';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.entity=a.entity AND s.rowid=a.fk_partner AND s.rowid=p.fk_soc';
	if (mjl_scope_is_input_agent($user, $entity)) $sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_activity_assignment aa ON aa.entity=a.entity AND aa.fk_activity=a.rowid AND aa.fk_user='.(int) $user->id.' AND aa.date_end IS NULL';
	$sql .= ' WHERE o.entity='.$entity.' AND o.date_removed IS NULL ORDER BY o.rowid DESC LIMIT 51 OFFSET '.$offset;
	$res = $db->query($sql); $rows = array(); if ($res) while ($row=$db->fetch_object($res)) $rows[]=$row;
	$hasNext = count($rows) > 50; $rows = array_slice($rows, 0, 50);
	llxHeader('', 'Opérations'); mjl_navigation_shell_start($user); print '<div class="mjl-workspace">'.mjl_page_header_render('Opérations',array('description'=>'Consulter les Opérations planifiées de l’entité active.')).'<section class="mjl-workspace-section">';
	if (!$res) print mjl_ui_system_state('unavailable','Opérations indisponibles','Réessayez dans quelques instants.');
	elseif (!$rows) print mjl_ui_system_state('initial-empty','Aucune Opération','Aucune Opération active n’est enregistrée.');
	else { print '<div class="div-table-responsive-no-min"><table class="noborder centpercent mjl-responsive-table"><thead><tr class="liste_titre"><th>Opération</th><th>Activité</th><th>Partenaire</th><th>Projet</th><th>Type</th><th>Montant autorisé</th><th>Statut</th></tr></thead><tbody>'; foreach ($rows as $row) { $url=DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row->activity_id; print '<tr class="oddeven"><td data-label="Opération">'.dol_escape_htmltag($row->name).'</td><td data-label="Activité"><a href="'.$url.'">'.dol_escape_htmltag($row->activity_ref.' - '.$row->activity_name).'</a></td><td data-label="Partenaire">'.dol_escape_htmltag($row->partner_name).'</td><td data-label="Projet">'.dol_escape_htmltag($row->project_ref.' - '.$row->project_title).'</td><td data-label="Type">'.dol_escape_htmltag($row->type_label).'</td><td data-label="Montant autorisé">'.dol_escape_htmltag(mjl_format_money($row->authorized_amount)).'</td><td data-label="Statut">À faire</td></tr>'; } print '</tbody></table></div>'; }
	if ($page > 1 || $hasNext) { print '<nav class="mjl-pagination" aria-label="Pagination des Opérations">'; if ($page > 1) print '<a class="mjl-action mjl-action-secondary" rel="prev" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php'.($page > 2 ? '?page='.($page - 1) : '').'">Précédent</a>'; if ($hasNext) print '<a class="mjl-action mjl-action-secondary" rel="next" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php?page='.($page + 1).'">Suivant</a>'; print '</nav>'; }
	print '</section></div>'; mjl_navigation_shell_end(); llxFooter();
}
