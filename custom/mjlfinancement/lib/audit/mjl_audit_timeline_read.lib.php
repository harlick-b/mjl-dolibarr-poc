<?php

require_once dirname(__DIR__).'/mjl_timeline_presentation.lib.php';
require_once dirname(__DIR__).'/mjl_timeline_result.lib.php';

/** One bounded page; caller renders 50 items and uses the 51st as a sentinel. */
function mjl_audit_timeline_read($db, $user, $entity, $activityId, $cursor = '', &$failure = null)
{
	$failure = 'unavailable';
	if (!mjl_activity_access_can_read_activity($user, $activityId)) return false;
	$table = $db->prefix().'mjlfinancement_audit_event';
	$where = ' entity='.(int) $entity.' AND activity_id='.(int) $activityId." AND result='SUCCESS'";
	$context = "CASE WHEN JSON_VALID(context_json) THEN context_json ELSE '{}' END";
	$new = "CASE WHEN JSON_VALID(new_values_json) THEN new_values_json ELSE '{}' END";
	$where .= " AND (action<>'EXPORT_GENERATED' OR (object_type='report' AND JSON_LENGTH(JSON_EXTRACT(".$context.",'$.activity_ids'))=1 AND JSON_UNQUOTE(JSON_EXTRACT(".$context.",'$.activity_ids[0]'))='".(int) $activityId."' AND JSON_UNQUOTE(JSON_EXTRACT(".$new.",'$.report_type')) IN ('activities','operations','activity_detail','portfolio')))";
	if (mjl_scope_is_input_agent($user, (int) $entity)) $where .= ' AND EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity_assignment aa WHERE aa.entity='.(int) $entity.' AND aa.fk_activity='.(int) $activityId.' AND aa.fk_user='.(int) $user->id.' AND aa.date_end IS NULL)';
	if ($cursor !== '') {
		if (!is_string($cursor) || preg_match('/^[1-9][0-9]{0,18}$/D', $cursor) !== 1 || (strlen($cursor) === 19 && strcmp($cursor, '9223372036854775807') > 0)) return false;
		$res = $db->query('SET STATEMENT max_statement_time=5 FOR SELECT event_date,rowid FROM '.$table.' WHERE '.$where.' AND rowid='.$cursor.' LIMIT 1');
		$anchor = $res ? $db->fetch_object($res) : null;
		if (!$anchor) { if ($res) $failure = 'invalid_cursor'; return false; }
		$date = "'".$db->escape($anchor->event_date)."'";
		$where .= ' AND (event_date>'.$date.' OR (event_date='.$date.' AND rowid>'.$cursor.'))';
	}
	$size = '(COALESCE(OCTET_LENGTH(previous_values_json),0)+COALESCE(OCTET_LENGTH(new_values_json),0)+COALESCE(OCTET_LENGTH(context_json),0)+COALESCE(OCTET_LENGTH(reason),0))';
	$sql = 'SET STATEMENT max_statement_time=5 FOR SELECT rowid,event_date,action,operation_id,actor_name_snapshot,actor_role_snapshot,state_before,state_after,('.$size.'>65536) AS details_unavailable';
	foreach (array('reason', 'previous_values_json', 'new_values_json', 'context_json') as $column) $sql .= ',IF('.$size.'<=65536,'.$column.',NULL) AS '.$column;
	$sql .= ' FROM '.$table.' WHERE '.$where.' ORDER BY event_date,rowid LIMIT 51';
	$res = $db->query($sql);
	if (!$res) return false;
	$events = array();
	while ($row = $db->fetch_object($res)) {
		$event = mjl_timeline_present_event((array) $row);
		$event['detail_status'] = !empty($row->details_unavailable) ? 'oversized' : ($event['detail'] === 'Détails indisponibles.' ? 'unavailable' : 'available');
		$event['rowid'] = (int) $row->rowid;
		$event['sort_date'] = (string) $row->event_date;
		$events[] = $event;
	}
	return mjl_timeline_aggregate_sources(array(array('source' => 'activity_audit', 'order' => 0, 'items' => $events)), true)['items'];
}
