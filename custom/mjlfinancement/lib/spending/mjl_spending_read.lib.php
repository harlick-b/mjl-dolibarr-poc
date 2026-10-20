<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006b_schema.lib.php';
require_once __DIR__.'/mjl_spending_policy.lib.php';

function mjl_spending_read(DoliDB $db, User $actor, $entity, $operationId, $page)
{
 mjl_spending_require_target($db);
 $sql='SELECT o.*,a.ref AS activity_ref,a.name AS activity_name,a.validation_status,a.is_cancelled FROM '.$db->prefix().'mjlfinancement_operation o INNER JOIN '.$db->prefix().'mjlfinancement_activity a ON a.entity=o.entity AND a.rowid=o.fk_activity WHERE o.entity='.(int)$entity.' AND o.rowid='.(int)$operationId.' AND o.date_removed IS NULL';
 $res=$db->query($sql);if(!$res)throw new RuntimeException('Expense read failed.');$operation=$db->fetch_object($res);
 if(!$operation)return null;
 $correctionOnly=false;
 if(!mjl_activity_access_can_read_activity($actor,(string)$operation->fk_activity)){
  if(!$operation->is_cancelled||!mjl_scope_is_input_agent($actor,(int)$entity)||!mjl_spending_was_cancellation_agent($db,$entity,$operation->fk_activity,$actor->id))return null;
  $correctionOnly=true;
 }
 $res=$db->query('SELECT e.*,EXISTS(SELECT 1 FROM '.$db->prefix()."mjlfinancement_expense r WHERE r.entity=e.entity AND r.fk_original=e.rowid AND r.kind='REVERSAL') AS reversed FROM ".$db->prefix().'mjlfinancement_expense e WHERE e.entity='.(int)$entity.' AND e.fk_operation='.(int)$operationId.' ORDER BY e.rowid DESC LIMIT 6 OFFSET '.(((int)$page-1)*5));
 if(!$res)throw new RuntimeException('Expense read failed.');$entries=array();while($row=$db->fetch_object($res))$entries[]=(array)$row;
 $hasNext=count($entries)>5;$entries=array_slice($entries,0,5);
 $role=mjl_scope_effective_role_code($actor,(int)$entity);
 return array('correction_only'=>$correctionOnly,'operation'=>(array)$operation,'entries'=>$entries,'has_next'=>$hasNext,'page'=>(int)$page,'role'=>$role,'actor_id'=>(int)$actor->id,'can_create'=>$role==='AGENT_SAISIE'&&$operation->validation_status==='FINAL_VALIDATED'&&!$operation->is_cancelled&&!in_array($operation->status,array('COMPLETED','CANCELLED'),true));
}

function mjl_spending_list(DoliDB $db, User $actor, $entity, $page)
{
 mjl_spending_require_target($db);
 $p=$db->prefix();
 $sql="SELECT o.rowid,o.name,o.spent_amount,a.ref,a.is_cancelled FROM {$p}mjlfinancement_operation o INNER JOIN {$p}mjlfinancement_activity a ON a.entity=o.entity AND a.rowid=o.fk_activity WHERE o.entity=".(int)$entity.' AND o.date_removed IS NULL AND a.latest_validated_amount IS NOT NULL';
 if(mjl_scope_is_input_agent($actor,(int)$entity))$sql.=" AND (EXISTS(SELECT 1 FROM {$p}mjlfinancement_activity_assignment aa WHERE aa.entity=a.entity AND aa.fk_activity=a.rowid AND aa.fk_user=".(int)$actor->id.' AND aa.date_end IS NULL) OR '.mjl_spending_cancellation_scope_sql($db,$entity,$actor->id).')';
 $sql.=' ORDER BY o.rowid DESC LIMIT 51 OFFSET '.(((int)$page-1)*50);
 $res=$db->query($sql);if(!$res)throw new RuntimeException('Expense list unavailable.');$rows=array();while($row=$db->fetch_object($res))$rows[]=(array)$row;
 return array('rows'=>array_slice($rows,0,50),'has_next'=>count($rows)>50,'page'=>(int)$page);
}
