<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline_result.lib.php';

/** One bounded page; caller renders 50 items and uses the 51st only as a sentinel. */
function mjl_activity_timeline($activityId, $cursor = '')
{
	global $db, $conf, $user;
	if (!mjl_activity_access_can_read_activity($user,$activityId)) return false;
	$table=$db->prefix().'mjlfinancement_audit_event';
	$where=" entity=".(int)$conf->entity." AND activity_id=".(int)$activityId." AND result='SUCCESS'";
	// The producer leaves multi-Activity/audit exports unlinked. Check captured scope too.
	$context="CASE WHEN JSON_VALID(context_json) THEN context_json ELSE '{}' END";
	$new="CASE WHEN JSON_VALID(new_values_json) THEN new_values_json ELSE '{}' END";
	$where.=" AND (action<>'EXPORT_GENERATED' OR (object_type='report' AND JSON_LENGTH(JSON_EXTRACT($context,'$.activity_ids'))=1 AND JSON_UNQUOTE(JSON_EXTRACT($context,'$.activity_ids[0]'))='".(int)$activityId."' AND JSON_UNQUOTE(JSON_EXTRACT($new,'$.report_type')) IN ('activities','operations','activity_detail','portfolio')))";
	if (mjl_scope_is_input_agent($user,(int)$conf->entity)) $where.=' AND EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity_assignment aa WHERE aa.entity='.(int)$conf->entity.' AND aa.fk_activity='.(int)$activityId.' AND aa.fk_user='.(int)$user->id.' AND aa.date_end IS NULL)';
	if ($cursor!=='') {
		if (!is_string($cursor) || !preg_match('/^[1-9][0-9]{0,18}$/D',$cursor) || (strlen($cursor)===19 && strcmp($cursor,'9223372036854775807')>0)) return false;
		$res=$db->query('SET STATEMENT max_statement_time=5 FOR SELECT event_date,rowid FROM '.$table.' WHERE '.$where.' AND rowid='.$cursor.' LIMIT 1');
		$anchor=$res?$db->fetch_object($res):null;
		if (!$anchor) return false;
		$date="'".$db->escape($anchor->event_date)."'";
		$where.=' AND (event_date>'.$date.' OR (event_date='.$date.' AND rowid>'.$cursor.'))';
	}
	$size='(COALESCE(OCTET_LENGTH(previous_values_json),0)+COALESCE(OCTET_LENGTH(new_values_json),0)+COALESCE(OCTET_LENGTH(context_json),0)+COALESCE(OCTET_LENGTH(reason),0))';
	$sql='SET STATEMENT max_statement_time=5 FOR SELECT rowid,event_date,action,operation_id,actor_name_snapshot,actor_role_snapshot,state_before,state_after,('.$size.'>65536) AS details_unavailable';
	foreach (array('reason','previous_values_json','new_values_json','context_json') as $column) $sql.=',IF('.$size.'<=65536,'.$column.',NULL) AS '.$column;
	$sql.=' FROM '.$table.' WHERE '.$where.' ORDER BY event_date,rowid LIMIT 51';
	$res=$db->query($sql);
	if (!$res) return false;
	$events=array();
	while ($row=$db->fetch_object($res)) { $event=mjl_timeline_present_event((array)$row); $event['rowid']=(int)$row->rowid; $event['sort_date']=(string)$row->event_date; $events[]=$event; }
	$aggregate=mjl_timeline_aggregate_sources(array(array('source'=>'activity_audit','order'=>0,'items'=>$events)),true);
	return $aggregate['items'];
}

function mjl_activity_render_timeline($activityId)
{
	$cursor=$_GET['chronology_cursor']??'';
	$events=mjl_activity_timeline($activityId,$cursor);
	$escape=function($text){return htmlspecialchars((string)$text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');};
	print '<section class="mjl-workspace-section" aria-labelledby="mjl-activity-chronology"><h2 id="mjl-activity-chronology">Chronologie</h2>';
	if ($events===false) print '<p>La chronologie est temporairement indisponible.</p>';
	elseif (!$events) print '<p>Aucun événement enregistré.</p>';
	else {
		print '<ol class="mjl-review-timeline">';
		foreach (array_slice($events,0,50) as $event) print '<li data-event-id="'.$event['rowid'].'"><strong>'.$escape($event['title']).'</strong><br><span>'.$escape($event['actor'].' · '.$event['role'].' · '.$event['date']).'</span>'.($event['detail']!==''?'<br>'.nl2br($escape($event['detail']),false):'').'</li>';
		print '</ol>';
	}
	$query=array('id'=>(int)$activityId);
	if (($_GET['action']??'')==='review') $query['action']='review';
	$url=DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?';
	if ($cursor!=='' || (is_array($events) && count($events)>50)) {
		print '<nav aria-label="Pagination de la chronologie">';
		if ($cursor!=='') print '<a href="'.$escape($url.http_build_query($query)).'#mjl-activity-chronology">Première page</a> ';
		if (is_array($events) && count($events)>50) print '<a href="'.$escape($url.http_build_query($query+array('chronology_cursor'=>$events[49]['rowid']))).'#mjl-activity-chronology">Suivant</a>';
		print '</nav>';
	}
	print '</section>';
}
