<?php

require_once __DIR__.'/../class/mjlexport.class.php';
require_once __DIR__.'/mjl_navigation.lib.php';
require_once __DIR__.'/mjl_page_header.lib.php';
require_once __DIR__.'/mjl_ui.lib.php';

function mjl_report_http_error($status,$message)
{
	while (ob_get_level()>0) { if (!ob_end_clean()) break; }
	http_response_code($status);
	header('Content-Type: text/plain; charset=UTF-8');
	header('Cache-Control: private, no-store');
	header('X-Content-Type-Options: nosniff');
	print $message;
	exit;
}

function mjl_report_require_actor($type)
{
	global $user,$conf;
	$roles=$type==='audit'?array('VALIDATEUR_DEFINITIF','ADMIN_PLATEFORME'):array('AGENT_SAISIE','AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF');
	if (!in_array(mjl_scope_effective_role_code($user,(int)$conf->entity),$roles,true)) mjl_report_http_error(403,'Accès au rapport non autorisé.');
}

/** Only implemented reports may select a builder; callbacks never come from requests. */
function mjl_report_route_type(array &$source)
{
	$type=array_key_exists('report',$source)?$source['report']:'activities';
	if (!is_string($type) || !in_array($type,array('activities','operations','activity_detail','portfolio','audit'),true)) throw new InvalidArgumentException('INVALID_REPORT');
	unset($source['report']);
	return $type;
}

function mjl_report_export_http()
{
	global $db,$user,$conf;
	try { $probe=$_POST; $requestedType=mjl_report_route_type($probe); } catch (InvalidArgumentException $e) { mjl_report_http_error(400,'Format ou filtres invalides.'); }
	mjl_report_require_actor($requestedType);
	if (($_SERVER['REQUEST_METHOD']??'')!=='POST') { header('Allow: POST'); mjl_report_http_error(405,'Utilisez le formulaire de téléchargement.'); }
	if (!isset($_POST['token']) || !is_string($_POST['token']) || (string)currentToken()==='' || !hash_equals((string)currentToken(),$_POST['token'])) mjl_report_http_error(403,'Formulaire expiré. Revenez au rapport et réessayez.');
	if ($_FILES || !isset($_POST['format']) || !is_string($_POST['format'])) mjl_report_http_error(400,'Format ou filtres invalides.');
	$format=$_POST['format']; $source=$_POST; unset($source['token'],$source['format']);
	try { $type=mjl_report_route_type($source); mjl_report_validate_request($type,$format,$source); }
	catch (InvalidArgumentException $e) { mjl_report_http_error(400,'Format ou filtres invalides.'); }
	if (headers_sent()) mjl_report_http_error(503,'Le téléchargement est indisponible.');
	if (session_status()===PHP_SESSION_ACTIVE && !session_write_close()) mjl_report_http_error(503,'Le téléchargement est indisponible.');
	try {
		$owner=new MjlExport($db,$user,(int)$conf->entity,'/tmp/mjlfinancement-exports');
		$builder=array('activities'=>'mjl_report_build_activities','operations'=>'mjl_report_build_operations','activity_detail'=>'mjl_report_build_activity_detail','portfolio'=>'mjl_report_build_portfolio','audit'=>'mjl_report_build_audit')[$type];
		$artifact=$owner->generate($type,$format,$source,$builder);
	} catch (Throwable $e) {
		$code=$e->getMessage();
		if (in_array($code,array('FORBIDDEN','SCOPE_CHANGED'),true)) mjl_report_http_error(403,'Vos accès ont changé. Actualisez le rapport avant de télécharger.');
		if ($code==='EXPORT_BUSY') mjl_report_http_error(409,'Un rapport est en cours de génération. Réessayez dans quelques instants.');
		if ($code==='UNSUPPORTED_RECORD') mjl_report_http_error(422,'Une donnée de la sélection ne peut pas être représentée dans ce rapport. Contactez un responsable pour la vérifier.');
		if (in_array($code,array('SOURCE_LIMIT','REPORT_LIMIT','ARTIFACT_LIMIT','EXPORT_MEMORY_LIMIT'),true)) mjl_report_http_error(422,'La sélection dépasse les limites du format. Réduisez les filtres ou choisissez un autre format.');
		if ($code==='EXPORT_COMMIT_UNCERTAIN') mjl_report_http_error(503,'La génération n’a pas pu être confirmée. Aucun fichier n’est transmis. Contactez un responsable avant de relancer.');
		mjl_report_http_error(503,'Le rapport est indisponible. Aucun fichier n’est transmis.');
	}
	try {
		$db->close();
		while (ob_get_level()>0) { if (!ob_end_clean()) throw new RuntimeException('OUTPUT_BUFFER_FAILED'); }
		if (headers_sent()) throw new RuntimeException('OUTPUT_ALREADY_SENT');
		$types=array('csv'=>'text/csv; charset=UTF-8','xlsx'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','pdf'=>'application/pdf');
		header('Content-Type: '.$types[$format]);
		header('Content-Disposition: attachment; filename="'.$artifact['filename'].'"');
		header('Content-Length: '.$artifact['bytes']);
		header('Cache-Control: private, no-store');
		header('X-Content-Type-Options: nosniff');
		while (!feof($artifact['stream'])) {
			$chunk=fread($artifact['stream'],65536);
			if ($chunk===false) break;
			print $chunk;
		}
	} catch (Throwable $e) {
		if (is_resource($artifact['stream'])) fclose($artifact['stream']);
		if (!headers_sent()) { header_remove('Content-Disposition'); header_remove('Content-Length'); mjl_report_http_error(503,'Le téléchargement est indisponible. Aucun fichier complet n’est transmis.'); }
		exit;
	} finally { if (is_resource($artifact['stream'])) fclose($artifact['stream']); }
	exit;
}

function mjl_report_reference_choices($reader,$includeTypes=false)
{
	global $db;
	$where=$reader->activityWhere(mjl_monitoring_filters(array()));
	$from=' FROM '.$db->prefix().'mjlfinancement_activity a';
	$choices=array();
	foreach (array('partner_id'=>array('fk_partner','societe','s','nom'),'project_id'=>array('fk_project','projet','p','title')) as $key=>$ref) {
		list($fk,$table,$alias,$label)=$ref;
		$selection='SELECT DISTINCT a.'.$fk.' AS id,'.$alias.'.'.$label.' AS label'.$from.' JOIN '.$db->prefix().$table.' '.$alias.' ON '.$alias.'.entity=a.entity AND '.$alias.'.rowid=a.'.$fk.' WHERE '.$where;
		$stats=$reader->rows('SELECT COUNT(*) AS n,COALESCE(SUM(OCTET_LENGTH(label)+64),0) AS bytes FROM ('.$selection.') selected')[0];
		if ((int)$stats['n']>10000 || (int)$stats['bytes']>MjlMonitoring::SOURCE_LIMIT) throw new RuntimeException('SOURCE_LIMIT');
		$choices[$key]=$reader->rows($selection.' ORDER BY label');
	}
	if ($includeTypes) {
		$selection='SELECT DISTINCT t.rowid AS id,t.label'.$from.' JOIN '.$db->prefix().'mjlfinancement_operation o ON o.entity=a.entity AND o.fk_activity=a.rowid AND o.date_removed IS NULL JOIN '.$db->prefix().'mjlfinancement_operation_type t ON t.entity=o.entity AND t.rowid=o.fk_operation_type WHERE '.$where;
		$stats=$reader->rows('SELECT COUNT(*) AS n,COALESCE(SUM(OCTET_LENGTH(label)+64),0) AS bytes FROM ('.$selection.') selected')[0];
		if ((int)$stats['n']>10000 || (int)$stats['bytes']>MjlMonitoring::SOURCE_LIMIT) throw new RuntimeException('SOURCE_LIMIT');
		$choices['type_id']=$reader->rows($selection.' ORDER BY label');
	}
	return $choices;
}

function mjl_report_page()
{
	global $db,$user,$conf;
	try { $probe=$_GET; $requestedType=mjl_report_route_type($probe); } catch (InvalidArgumentException $e) { mjl_report_http_error(400,'Filtres invalides.'); }
	mjl_report_require_actor($requestedType);
	if ($requestedType==='audit') { require_once __DIR__.'/mjl_audit_report_route.lib.php'; mjl_audit_report_page(); return; }
	if (($_SERVER['REQUEST_METHOD']??'GET')!=='GET') { header('Allow: GET'); mjl_report_http_error(405,'Consultez le rapport avec une requête GET.'); }
	try { $source=$_GET; $type=mjl_report_route_type($source); $filters=mjl_report_validate_request($type,'csv',$source); }
	catch (InvalidArgumentException $e) { mjl_report_http_error(400,'Filtres invalides.'); }
	$isPortfolio=$type==='portfolio'; $isDetail=$type==='activity_detail'; $isOperations=$type==='operations'; $title=mjl_report_titles()[$type];
	$plural=$isOperations?'Opérations':'Activités'; $singular=$isOperations?'Opération':'Activité';
	$resetUrl=DOL_URL_ROOT.'/custom/mjlfinancement/reports.php'.($type!=='activities'?'?report='.$type:'');
	$available=true; $rows=array(); $choices=array(); $captured=gmdate('Y-m-d H:i:s'); $budgets=null; $deadline=hrtime(true)+30000000000;
	try {
		$reader=new MjlMonitoring($db,$user,(int)$conf->entity);
		$budgets=$reader->rows('SELECT @@session.max_statement_time AS statement_time,@@session.innodb_lock_wait_timeout AS row_wait,@@session.lock_wait_timeout AS metadata_wait')[0];
		if (!$db->query('SET SESSION max_statement_time=5,innodb_lock_wait_timeout=2,lock_wait_timeout=2')) throw new RuntimeException('READ_FAILED');
		mjl_rst012_require_target($db);
		mjl_report_checkpoint($deadline);
		if (!$db->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ') || !$db->begin('mjl report preview')) throw new RuntimeException('READ_FAILED');
		$reader=new MjlMonitoring($db,$user,(int)$conf->entity);
		$activities=$reader->activities($filters);
		if ($isDetail) $detail=mjl_report_activity_detail_document($activities,$reader->operations($activities,$filters));
		elseif ($isOperations) {
			$selected=$reader->operations($activities,$filters);
			if (count($selected)>10000) throw new RuntimeException('SOURCE_LIMIT');
			$rows=mjl_report_operation_records($selected); unset($selected);
		} elseif ($isPortfolio) $rows=mjl_report_portfolio($activities,$filters['grouping']);
		else $rows=mjl_report_activity_records($activities);
		unset($activities);
		$choices=$isDetail?array():mjl_report_reference_choices($reader,$isOperations);
		foreach ($choices as $list) if (count($list)>10000) throw new RuntimeException('SOURCE_LIMIT');
		mjl_report_checkpoint($deadline);
		if (!$db->commit('mjl report preview')) throw new RuntimeException('READ_FAILED');
	} catch (Throwable $e) { if ($db->transaction_opened>0) $db->rollback(); $available=false; http_response_code($e->getMessage()==='FORBIDDEN'?403:503); }
	finally { if ($budgets!==null && !$db->query('SET SESSION max_statement_time='.(float)$budgets['statement_time'].',innodb_lock_wait_timeout='.(int)$budgets['row_wait'].',lock_wait_timeout='.(int)$budgets['metadata_wait'])) { $available=false; http_response_code(503); } }
	llxHeader('',$title); mjl_navigation_shell_start($user); print '<div class="mjl-workspace">';
	print mjl_page_header_render($title,array('description'=>'Montants cumulés courants, dans votre périmètre d’accès.','breadcrumb'=>array(array('label'=>$plural,'href'=>DOL_URL_ROOT.'/custom/mjlfinancement/'.($isOperations?'operations.php':'activities.php')),array('label'=>'Rapport'))));
	print '<nav class="mjl-tabs" aria-label="Type de rapport">';
	foreach (array('activities'=>'Activités','operations'=>'Opérations','portfolio'=>'Portefeuille') as $key=>$label) print '<a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report='.$key.'"'.($type===$key?' class="mjl-tab-active" aria-current="page"':'').'>'.$label.'</a>';
	if (in_array(mjl_scope_effective_role_code($user,(int)$conf->entity),array('VALIDATEUR_DEFINITIF','ADMIN_PLATEFORME'),true)) print '<a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report=audit">Journal d’audit</a>';
	print '</nav>';
	if (!$available) print mjl_ui_system_state('unavailable','Rapport indisponible','Les données ne peuvent pas être chargées. Aucun total ni téléchargement n’est disponible.');
	elseif ($isDetail) mjl_report_detail_preview($detail['document'],$filters,$captured);
	else {
		print '<section class="mjl-workspace-section"><h2>Sélection</h2><form class="mjl-activity-form" method="GET"><input type="hidden" name="report" value="'.$type.'"><div class="mjl-form-grid">';
		foreach (array('q'=>($isOperations||$isPortfolio)?'Recherche d’Activité':'Recherche','date_from'=>'Période à partir du','date_to'=>'Période jusqu’au') as $key=>$label) print '<label for="report-'.$key.'">'.$label.'</label><input id="report-'.$key.'" name="'.$key.'" type="'.($key==='q'?'search':'date').'" maxlength="100" value="'.dol_escape_htmltag($filters[$key]).'">';
		foreach (array_merge(array('partner_id'=>'Partenaire','project_id'=>'Projet'),$isOperations?array('type_id'=>'Type d’opération'):array()) as $key=>$label) {
			print '<label for="report-'.$key.'">'.$label.'</label><select id="report-'.$key.'" name="'.$key.'"><option value="">Tous</option>';
			if ($filters[$key]!=='' && !in_array($filters[$key],array_map('strval',array_column($choices[$key],'id')),true)) print '<option selected value="'.dol_escape_htmltag($filters[$key]).'">Référence hors sélection</option>';
			foreach ($choices[$key] as $choice) print '<option value="'.(int)$choice['id'].'"'.((string)$choice['id']===$filters[$key]?' selected':'').'>'.dol_escape_htmltag($choice['label']).'</option>';
			print '</select>';
		}
		$labels=mjl_report_status_labels();
		foreach (array_merge(array('validation_status'=>array(($isOperations||$isPortfolio)?'État de validation de l’Activité':'État de validation',array('DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED','ABANDONED')),'execution_status'=>array(($isOperations||$isPortfolio)?'État d’exécution de l’Activité':'État d’exécution',array('NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED')),'completeness'=>array(($isOperations||$isPortfolio)?'Complétude des dépenses de l’Activité':'Complétude des dépenses',array('NOT_STARTED','PARTIAL','COMPLETE'))),$isOperations?array('operation_status'=>array('État de l’Opération',array('TODO','IN_PROGRESS','COMPLETED','CANCELLED'))):array()) as $key=>$definition) {
			print '<label for="report-'.$key.'">'.$definition[0].'</label><select id="report-'.$key.'" name="'.$key.'"><option value="">Tous</option>';
			foreach ($definition[1] as $value) print '<option value="'.$value.'"'.($value===$filters[$key]?' selected':'').'>'.dol_escape_htmltag($key==='completeness' && $value==='NOT_STARTED'?'Non renseignée':$labels[$value]).'</option>';
			print '</select>';
		}
		if ($isPortfolio) {
			print '<label for="report-grouping">Regrouper par</label><select id="report-grouping" name="grouping">';
			foreach (array('project'=>'Projet','partner'=>'Partenaire') as $key=>$label) print '<option value="'.$key.'"'.($filters['grouping']===$key?' selected':'').'>'.$label.'</option>';
			print '</select>';
		}
		print '</div>';
		if ($filters['activity_id']!=='') print '<input type="hidden" name="activity_id" value="'.dol_escape_htmltag($filters['activity_id']).'">';
		print '<button class="butAction" type="submit">Appliquer les filtres</button> <a href="'.dol_escape_htmltag($resetUrl).'">Réinitialiser</a></form><p>La période inclut les Activités dont les dates courantes chevauchent l’intervalle choisi. Les références inactives déjà utilisées restent sélectionnables.</p></section>';
		if ($isOperations) print '<p>Les filtres de type et d’état d’Opération réduisent les lignes affichées, sans recalculer la complétude de l’Activité parente. Écart = dépensé − autorisé ; variation = écart / autorisé, non renseignée si le montant dépensé manque ou si le montant autorisé vaut zéro.</p>';
		if ($isPortfolio) print '<p>Chaque Activité sélectionnée contribue une seule fois à son groupe. Les dépenses renseignées sont additionnées ; les compteurs signalent les montants manquants. Une annulation conserve les montants validés antérieurs.</p>';
		print '<section class="mjl-workspace-section"><h2>Téléchargement</h2><p>'.count($rows).' '.($isPortfolio?'groupe(s)':$singular.'(s)').' dans la sélection. L’export inclut toutes les pages.</p>';
		mjl_report_download_form($type,$filters,$captured);
		print '</section><section class="mjl-workspace-section"><h2>'.($isPortfolio?'Groupes sélectionnés':$plural.' sélectionnées').'</h2>';
		if (!$rows) print mjl_ui_system_state('filtered-empty',$isPortfolio?'Aucun groupe':'Aucune '.$singular,'Aucune Activité ne correspond à vos filtres et à vos accès.');
		$page=(int)$filters['page'];
		foreach (array_slice($rows,($page-1)*50,50) as $row) {
			if ($isPortfolio) { print mjl_report_portfolio_preview_row($row,$filters['grouping']); continue; }
			if ($isOperations) { print mjl_report_operation_preview_row($row); continue; }
			print '<article class="mjl-activity-panel"><h3><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row['rowid'].'">'.dol_escape_htmltag($row['name']).'</a></h3><p>'.dol_escape_htmltag($row['ref'].' · '.$row['partner_name'].' · '.$row['project_name']).'</p><p>'.dol_escape_htmltag($row['validation_label'].' · '.$row['execution_label'].' · Dépenses : '.$row['completeness_label']).'</p><dl class="mjl-activity-meta">';
			foreach (array('initial_amount','pending_amount','validated_amount','total_spent_amount') as $key) print '<div><dt>'.dol_escape_htmltag(mjl_monitoring_labels()[$key]).'</dt><dd>'.dol_escape_htmltag(mjl_format_money($row[$key])).'</dd></div>';
			print '</dl></article>';
		}
		if ($page>1 || count($rows)>$page*50) {
			print '<nav aria-label="Pagination du rapport">';
			foreach (array(-1=>'Précédent',1=>'Suivant') as $offset=>$label) if (($offset<0 && $page>1)||($offset>0 && count($rows)>$page*50)) print '<a href="?'.dol_escape_htmltag(http_build_query(array_merge($filters,array('report'=>$type,'page'=>$page+$offset)))).'">'.$label.'</a> ';
			print '</nav>';
		}
		print '</section>';
	}
	print '</div>'; mjl_navigation_shell_end(); llxFooter(); $db->close();
}


function mjl_report_operation_preview_row(array $row)
{
	$html='<article class="mjl-activity-panel"><h3>'.dol_escape_htmltag($row['name']).'</h3><p><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row['activity_id'].'">'.dol_escape_htmltag($row['activity_ref'].' · '.$row['activity_name']).'</a></p><p>'.dol_escape_htmltag($row['partner_name'].' · '.$row['project_name'].' · '.$row['type_label']).'</p><p>'.dol_escape_htmltag($row['status_label'].' · Autorisation : '.$row['authorization_kind']).'</p><dl class="mjl-activity-meta">';
	foreach (array('authorized_amount'=>'Montant autorisé','spent_amount'=>'Montant dépensé','difference'=>'Écart') as $key=>$label) $html.='<div><dt>'.$label.'</dt><dd>'.dol_escape_htmltag(mjl_format_money($row[$key])).'</dd></div>';
	$html.='<div><dt>Variation</dt><dd>'.dol_escape_htmltag($row['variance']['display']??'Non renseigné').'</dd></div></dl><p><strong>Observation</strong><br>'.nl2br(htmlspecialchars($row['observation']??'Non renseignée',ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')).'</p></article>';
	return $html;
}


function mjl_report_download_form($type,array $filters,$captured)
{
	print '<p>Aperçu capturé le '.dol_escape_htmltag($captured).' UTC ; un téléchargement utilise une nouvelle capture.</p><p>'.dol_escape_htmltag(mjl_report_format_notice()).'</p><form method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/reportexport.php"><input type="hidden" name="report" value="'.$type.'"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	foreach ($filters as $key=>$value) if ($key!=='page') print '<input type="hidden" name="'.$key.'" value="'.dol_escape_htmltag($value).'">';
	foreach (array('pdf'=>'PDF','xlsx'=>'XLSX','csv'=>'CSV') as $format=>$label) print '<button class="butAction" name="format" value="'.$format.'" type="submit">Télécharger '.$label.'</button> ';
	print '</form>';
}

function mjl_report_detail_preview(array $document,array $filters,$captured)
{
	print '<p><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$filters['activity_id'].'">Retour à l’Activité</a></p>';
	foreach ($document['metadata'] as $text) print '<p>'.dol_escape_htmltag($text).'</p>';
	print '<section class="mjl-workspace-section"><h2>Téléchargement</h2><p>Une Activité avec toutes ses Opérations courantes.</p>';
	mjl_report_download_form('activity_detail',$filters,$captured); print '</section>';
	foreach ($document['sections'] as $section) {
		print '<section class="mjl-workspace-section"><h2>'.dol_escape_htmltag($section['title']).'</h2>';
		if (!$section['rows']) print '<p>Aucune Opération courante.</p>';
		foreach ($section['rows'] as $row) {
			print '<article class="mjl-activity-panel"><dl class="mjl-activity-meta">';
			foreach ($row as $i=>$cell) {
				$value=$cell['value'];
				if (isset($cell['currency'])) $text=mjl_format_money($value);
				elseif ($cell['type']==='ratio') $text=$value['display']??'Non renseigné';
				else $text=$value===null || $value===''?'Non renseigné':(string)$value;
				print '<div><dt>'.dol_escape_htmltag($section['headers'][$i]).'</dt><dd>'.nl2br(htmlspecialchars($text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')).'</dd></div>';
			}
			print '</dl></article>';
		}
		print '</section>';
	}
}


function mjl_report_portfolio_preview_row(array $row,$grouping)
{
	$html='<article class="mjl-activity-panel"><h3>'.htmlspecialchars($row['group_name'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').'</h3><dl class="mjl-activity-meta">';
	foreach (mjl_report_portfolio_columns($grouping) as $key=>$column) {
		if ($key==='group_name') continue;
		$value=isset($column[2])?mjl_format_money($row[$key]):(string)$row[$key];
		$html.='<div><dt>'.dol_escape_htmltag($column[0]).'</dt><dd>'.dol_escape_htmltag($value).'</dd></div>';
	}
	return $html.'</dl></article>';
}
