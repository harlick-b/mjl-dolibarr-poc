<?php
/** SQL predicate for the Activity alias a; immutable cancellation evidence only. */
function mjl_spending_cancellation_scope_sql(DoliDB $db, $entity, $actorId)
{
 $p=$db->prefix();
 return "(a.is_cancelled=1 AND EXISTS (SELECT 1 FROM {$p}mjlfinancement_audit_event e INNER JOIN {$p}mjlfinancement_cancellation_request c ON c.entity=e.entity AND c.fk_activity=e.activity_id AND c.target_type='ACTIVITY' AND c.status='APPROVED' AND c.rowid=JSON_UNQUOTE(JSON_EXTRACT(e.context_json,'$.request_id')) WHERE e.entity=".(int)$entity." AND e.activity_id=a.rowid AND e.action='ASSIGNMENT_REMOVED' AND e.result='SUCCESS' AND JSON_UNQUOTE(JSON_EXTRACT(e.context_json,'$.target_agent_id'))=".(int)$actorId.'))';
}

/** This grants correction-only access, never ordinary assignment. */
function mjl_spending_was_cancellation_agent(DoliDB $db, $entity, $activityId, $actorId)
{
 $sql='SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity a WHERE a.entity='.(int)$entity.' AND a.rowid='.(int)$activityId.' AND '.mjl_spending_cancellation_scope_sql($db,$entity,$actorId);
 $res=$db->query($sql);if(!$res)throw new RuntimeException('Cancellation assignment evidence unavailable.');$row=$db->fetch_object($res);return $row&&(int)$row->nb===1;
}
