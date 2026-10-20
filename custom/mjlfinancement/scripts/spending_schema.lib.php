<?php

const MJL_SPENDING_TABLE_SHA256 = '4a5172c09d694e89d3630e354ad296ac29e452d9c0e5ecceaaa73109a2d4db96';

/** Exact successor contract for DEC-077. No runtime schema mutation. */
function mjl_spending_present(DoliDB $db)
{
 return mjl_rst002b_table_exists($db, $db->prefix().'mjlfinancement_expense');
}

function mjl_spending_shape_check()
{
 return "status<>'COMPLETED' OR spent_amount IS NOT NULL";
}

function mjl_spending_table_digest(DoliDB $db)
{
 $result=$db->query('SHOW CREATE TABLE '.$db->prefix().'mjlfinancement_expense');
 if (!$result || !($row=$db->fetch_array($result))) throw new RuntimeException('Expense schema unavailable.');
 $definition=str_replace($db->prefix(), 'llx_', $row['Create Table']);
 $definition=preg_replace('/ AUTO_INCREMENT=[0-9]+/i', '', $definition);
 return hash('sha256', mjl_rst005_normalize_definition($definition));
}

function mjl_spending_operation_guard(DoliDB $db, $legacy)
{
 $p=$db->prefix();
 $body=substr($legacy, strpos($legacy, ' FOR EACH ROW ')+14);
 $same=array('rowid','entity','fk_activity','fk_operation_type','name','authorized_amount','status','observation','date_removed','fk_user_removed','date_creation','fk_user_creat');
 $unchanged=implode(' AND ', array_map(function($field){return '(NEW.'.$field.'<=>OLD.'.$field.')';}, $same));
 return 'CREATE OR REPLACE TRIGGER '.$p."mjl_operation_rst006b_bu BEFORE UPDATE ON {$p}mjlfinancement_operation FOR EACH ROW BEGIN
 DECLARE approved_total DECIMAL(65,0) DEFAULT NULL;
 DECLARE pending_count INTEGER DEFAULT 0;
 DECLARE validator_ok INTEGER DEFAULT 0;
 SELECT SUM(CASE WHEN status='APPROVED' THEN amount ELSE NULL END),COALESCE(SUM(status IN ('DRAFT','SUBMITTED')),0) INTO approved_total,pending_count FROM {$p}mjlfinancement_expense WHERE entity=OLD.entity AND fk_operation=OLD.rowid;
 IF NOT(NEW.spent_amount<=>approved_total) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Spending must equal approved entries'; END IF;
 SELECT COUNT(*) INTO validator_ok FROM {$p}user u INNER JOIN {$p}mjlfinancement_user_role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code='VALIDATEUR_DEFINITIF' WHERE u.rowid=NEW.fk_user_modif AND u.entity=OLD.entity AND u.statut=1 AND u.admin=0;
 IF $unchanged AND NEW.version=OLD.version+1 AND OLD.date_removed IS NULL AND validator_ok=1 THEN
   BEGIN END;
 ELSE
   IF NOT(NEW.spent_amount<=>OLD.spent_amount) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Spending requires approval'; END IF;
   IF NEW.status='COMPLETED' AND OLD.status<>'COMPLETED' AND (pending_count>0 OR approved_total IS NULL OR (approved_total<>NEW.authorized_amount AND NEW.observation IS NULL)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Completion requires approved expenses and variance explanation'; END IF;
   $body;
 END IF;
 END";
}

function mjl_spending_guard_statements(DoliDB $db)
{
 $p=$db->prefix();$table=$p.'mjlfinancement_expense';
 $immutable=array('rowid','entity','fk_operation','kind','fk_original','fk_author','date_creation');
 $different=implode(' OR ',array_map(function($field){return 'NOT(NEW.'.$field.'<=>OLD.'.$field.')';},$immutable));
 $snapshot=array('label','expense_date','amount','reason','contributors','date_submitted');
 $snapshotChanged=implode(' OR ',array_map(function($field){return 'NOT(NEW.'.$field.'<=>OLD.'.$field.')';},$snapshot));
 return array(
  "CREATE OR REPLACE TRIGGER {$p}mjl_expense_bi BEFORE INSERT ON $table FOR EACH ROW BEGIN
   DECLARE original_amount BIGINT DEFAULT NULL;
   IF NEW.kind='EXPENSE' AND (NEW.status<>'DRAFT' OR NEW.version<>1 OR NOT JSON_CONTAINS(NEW.contributors,CAST(NEW.fk_author AS CHAR))) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expense must start as an authored draft'; END IF;
   IF NEW.kind='REVERSAL' THEN
    SELECT amount INTO original_amount FROM $table WHERE entity=NEW.entity AND rowid=NEW.fk_original AND fk_operation=NEW.fk_operation AND status='APPROVED' AND kind='EXPENSE';
    IF original_amount IS NULL OR NEW.amount<>-original_amount THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Reversal must offset the original approved entry'; END IF;
   END IF;
  END",
  "CREATE OR REPLACE TRIGGER {$p}mjl_expense_bu BEFORE UPDATE ON $table FOR EACH ROW BEGIN
   IF $different OR NEW.version<>OLD.version+1 OR OLD.status IN ('APPROVED','REJECTED','WITHDRAWN') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expense evidence is immutable'; END IF;
   IF OLD.status='DRAFT' AND NEW.status NOT IN ('DRAFT','SUBMITTED','WITHDRAWN') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid expense submission'; END IF;
   IF OLD.status='SUBMITTED' AND (NEW.status NOT IN ('APPROVED','REJECTED','WITHDRAWN') OR $snapshotChanged) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Submitted expense snapshot is immutable'; END IF;
  END",
  "CREATE OR REPLACE TRIGGER {$p}mjl_expense_bd BEFORE DELETE ON $table FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expense evidence cannot be deleted'",
 );
}

function mjl_spending_require_target(DoliDB $db)
{
 $actual=mjl_spending_table_digest($db);
 if ($actual!==MJL_SPENDING_TABLE_SHA256) throw new RuntimeException('Expense table contract mismatch: '.$actual);
 $expectedTriggers=mjl_rst002b_expected_trigger_map(mjl_spending_guard_statements($db));
 if (!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db,$db->prefix().'mjlfinancement_expense'),$expectedTriggers)) throw new RuntimeException('Expense guard contract mismatch.');
 mjl_rst006b_require_target($db);
}

function mjl_spending_install(DoliDB $db)
{
 $present=mjl_spending_present($db);
 if ($present) {
  try {mjl_spending_require_target($db);return;} catch(RuntimeException $exception) {}
  // Resume only an exact, empty successor table with known predecessor/successor
  // Operation guards. Unknown definitions and financial data are never repaired.
  if(mjl_spending_table_digest($db)!==MJL_SPENDING_TABLE_SHA256)throw new RuntimeException('Expense table contract mismatch: '.mjl_spending_table_digest($db));
  if((int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense')!==0)throw new RuntimeException('Nonempty partial expense migration requires investigation.');
  $oldTables=mjl_rst006b_table_contracts($db,false);$newTables=mjl_rst006b_table_contracts($db,true);
  foreach($oldTables as $suffix=>$contract){
   if(!mjl_rst006b_contract_matches($db,$suffix,$contract)&&!($suffix==='operation'&&mjl_rst006b_contract_matches($db,$suffix,$newTables[$suffix])))throw new RuntimeException('Unknown predecessor table: '.$suffix);
  }
  $oldTriggers=mjl_rst006b_trigger_contract_maps($db,false)['target'];$newTriggers=mjl_rst006b_trigger_contract_maps($db,true)['target'];
  foreach($oldTriggers as $table=>$expected){$actual=mjl_rst002b_actual_trigger_map($db,$table);if(!mjl_rst005_map_equal($actual,$expected)&&!mjl_rst005_map_equal($actual,$newTriggers[$table]))throw new RuntimeException('Unknown predecessor guards.');}
  $expected=mjl_rst002b_expected_trigger_map(mjl_spending_guard_statements($db));
  foreach(mjl_rst002b_actual_trigger_map($db,$db->prefix().'mjlfinancement_expense') as $name=>$definition)if(!isset($expected[$name])||$definition!==$expected[$name])throw new RuntimeException('Unknown expense guard.');
 } else mjl_rst006b_require_target($db);
 if ((int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_operation WHERE spent_amount IS NOT NULL')!==0) throw new RuntimeException('Existing spending requires an explicit migration decision; approval cannot be invented.');
 if(!$present)mjl_rst006a_load_sql_file($db,__DIR__.'/schema/spending.sql');
 foreach(mjl_spending_guard_statements($db) as $sql) if(!$db->query($sql))throw new RuntimeException($db->lasterror());
 $sql='ALTER TABLE '.$db->prefix().'mjlfinancement_operation DROP CONSTRAINT chk_mjl_operation_execution_shape, ADD CONSTRAINT chk_mjl_operation_execution_shape CHECK ('.mjl_spending_shape_check().')';
 if(!$db->query($sql))throw new RuntimeException($db->lasterror());
 foreach(mjl_rst006b_guard_statements($db) as $sql) if(strpos($sql,'mjl_operation_rst006b_bu ')!==false && !$db->query(mjl_spending_operation_guard($db,$sql)))throw new RuntimeException($db->lasterror());
 mjl_spending_require_target($db);
}
