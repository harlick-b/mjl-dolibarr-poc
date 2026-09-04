<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline_result.lib.php';

function mjl_activity_timeline($activityId)
{
	global $db, $conf;
	$sql = 'SELECT rowid,event_date,action,actor_name_snapshot,actor_role_snapshot,state_before,state_after,reason,previous_values_json,new_values_json,context_json FROM '.$db->prefix().'mjlfinancement_audit_event';
	$sql .= " WHERE entity=".(int) $conf->entity." AND activity_id=".(int) $activityId." AND result='SUCCESS' ORDER BY event_date,rowid";
	$res = $db->query($sql);
	if (!$res) return false;
	$events = array();
	while ($row = $db->fetch_object($res)) { $event=mjl_timeline_present_event((array)$row); $event['rowid']=(int)$row->rowid; $event['sort_date']=(string)$row->event_date; $events[]=$event; }
	$aggregate=mjl_timeline_aggregate_sources(array(array('source'=>'activity_audit','order'=>0,'items'=>$events)),true);
	return $aggregate['items'];
}

function mjl_activity_render_timeline($activityId)
{
	$events = mjl_activity_timeline($activityId);
	print '<section class="mjl-workspace-section" aria-labelledby="mjl-activity-chronology"><h2 id="mjl-activity-chronology">Chronologie</h2>';
	if ($events === false) print '<p>La chronologie est temporairement indisponible.</p>';
	elseif (!$events) print '<p>Aucun événement enregistré.</p>';
	else {
		print '<ol class="mjl-review-timeline">';
		foreach ($events as $event) print '<li><strong>'.dol_escape_htmltag($event['title']).'</strong><br><span>'.dol_escape_htmltag($event['actor'].' · '.$event['role'].' · '.$event['date']).'</span>'.($event['detail'] !== '' ? '<br>'.dol_escape_htmltag($event['detail']) : '').'</li>';
		print '</ol>';
	}
	print '</section>';
}
