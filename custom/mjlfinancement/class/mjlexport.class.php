<?php

require_once __DIR__.'/mjlmonitoring.class.php';
require_once __DIR__.'/mjlexportspool.class.php';
require_once __DIR__.'/../lib/mjl_report_data.lib.php';
require_once __DIR__.'/../lib/mjl_report_render.lib.php';
require_once __DIR__.'/../lib/mjl_audit.lib.php';
require_once __DIR__.'/../scripts/rst012_schema.lib.php';

/** Owns snapshot, private generation, fresh authorization and immutable export evidence. */
class MjlExport
{
	private $db;
	private $actor;
	private $entity;
	private $spoolRoot;

	public function __construct($db, $actor, $entity, $spoolRoot)
	{
		$this->db=$db; $this->actor=$actor; $this->entity=(int)$entity; $this->spoolRoot=$spoolRoot;
		if ($this->entity<1 || $this->entity!==(int)($GLOBALS['conf']->entity??0) || empty($actor->id) || $db!==($GLOBALS['db']??null)) throw new RuntimeException('INVALID_EXPORT_CONTEXT');
	}

	private function rows($sql)
	{
		$res=$this->db->query($sql);
		if (!$res) throw new RuntimeException('EXPORT_DATABASE_FAILED');
		$rows=array(); while ($row=$this->db->fetch_object($res)) $rows[]=(array)$row;
		$this->db->free($res); return $rows;
	}
	private function query($sql) { if (!$this->db->query($sql)) throw new RuntimeException('EXPORT_DATABASE_FAILED'); }
	private function literal($value) { return "'".$this->db->escape((string)$value)."'"; }

	private function identity($lock)
	{
		$suffix=$lock?' FOR UPDATE':''; $p=$this->db->prefix();
		$users=$this->rows('SELECT rowid,entity,login,firstname,lastname,statut,admin FROM '.$p.'user WHERE rowid='.(int)$this->actor->id.$suffix);
		if (count($users)!==1 || (int)$users[0]['statut']!==1) throw new RuntimeException('FORBIDDEN');
		$user=$users[0];
		$roles=$this->rows('SELECT role_code FROM '.$p.'mjlfinancement_user_role WHERE entity='.$this->entity.' AND fk_user='.(int)$user['rowid'].' AND is_active=1 ORDER BY rowid'.$suffix);
		if ((int)$user['admin']===1) {
			if ($roles) throw new RuntimeException('FORBIDDEN');
			$role='ADMIN_PLATEFORME';
		} else {
			if ((int)$user['entity']!==$this->entity || count($roles)!==1 || !in_array($roles[0]['role_code'],array('AGENT_SAISIE','AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true)) throw new RuntimeException('FORBIDDEN');
			$role=$roles[0]['role_code'];
		}
		$name=trim(($user['firstname']??'').' '.($user['lastname']??''));
		return array('id'=>(int)$user['rowid'],'native_entity'=>(int)$user['entity'],'role'=>$role,'name'=>$name!==''?$name:$user['login']);
	}

	private function requireReportRole($type,$role)
	{
		if ($type==='audit' ? !in_array($role,array('VALIDATEUR_DEFINITIF','ADMIN_PLATEFORME'),true) : $role==='ADMIN_PLATEFORME') throw new RuntimeException('FORBIDDEN');
	}

	private function requireCurrentScope(array $ids,$role,$deadline)
	{
		$p=$this->db->prefix();
		foreach ($ids as $id) {
			mjl_report_checkpoint($deadline);
			$rows=$this->rows('SELECT rowid FROM '.$p.'mjlfinancement_activity WHERE entity='.$this->entity.' AND rowid='.$id.' FOR UPDATE');
			if (count($rows)!==1) throw new RuntimeException('SCOPE_CHANGED');
		}
		foreach ($ids as $id) {
			mjl_report_checkpoint($deadline);
			$rows=$this->rows('SELECT fk_user FROM '.$p.'mjlfinancement_activity_assignment WHERE entity='.$this->entity.' AND fk_activity='.$id.' AND date_end IS NULL ORDER BY rowid FOR UPDATE');
			if ($role==='AGENT_SAISIE' && !in_array((int)$this->actor->id,array_map(function($row){return (int)$row['fk_user'];},$rows),true)) throw new RuntimeException('SCOPE_CHANGED');
		}
	}

	/** Keep private file ownership replaceable in disposable failure tests. */
	protected function createSpool($root) { return new MjlExportSpool($root); }

	/** Builder is an internal fixed-report adapter, never request-supplied code. */
	public function generate($type,$format,array $source,callable $builder)
	{
		$filters=mjl_report_validate_request($type,$format,$source);
		if ($this->db->transaction_opened>0) throw new RuntimeException('INVALID_EXPORT_TRANSACTION');
		$deadline=hrtime(true)+30000000000; $spool=null; $artifact=null; $budgets=null; $committed=false; $shutdownArmed=true; $failure=null;
		try {
			$spool=$this->createSpool($this->spoolRoot);
			register_shutdown_function(function()use(&$shutdownArmed,$spool,&$artifact,&$budgets){
				if (!$shutdownArmed) return;
				try { if ($this->db->transaction_opened>0) $this->db->rollback('mjl export shutdown'); } catch (Throwable $ignored) {}
				try { if ($budgets!==null) $this->query('SET SESSION max_statement_time='.(float)$budgets['statement_time'].',innodb_lock_wait_timeout='.(int)$budgets['row_wait'].',lock_wait_timeout='.(int)$budgets['metadata_wait']); } catch (Throwable $ignored) {}
				try { if ($artifact!==null && is_resource($artifact['stream'])) fclose($artifact['stream']); $spool->close(); } catch (Throwable $ignored) {}
			});
			$budgets=$this->rows('SELECT @@session.max_statement_time AS statement_time,@@session.innodb_lock_wait_timeout AS row_wait,@@session.lock_wait_timeout AS metadata_wait')[0];
			$this->query('SET SESSION max_statement_time=5,innodb_lock_wait_timeout=2,lock_wait_timeout=2');
			mjl_rst012_require_target($this->db);
			mjl_report_checkpoint($deadline);
			$this->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
			if (!$this->db->begin('mjl export snapshot')) throw new RuntimeException('EXPORT_DATABASE_FAILED');
			$identity=$this->identity(false); $this->requireReportRole($type,$identity['role']);
			$snapshotTime=$this->rows('SELECT UTC_TIMESTAMP() AS snapshot_time')[0]['snapshot_time'];
			$reader=new MjlMonitoring($this->db,$this->actor,$this->entity,mjl_execution_porto_novo_date($snapshotTime.' UTC'));
			$data=$builder($reader,$filters);
			if (!isset($data['document'],$data['activity_ids']) || !is_array($data['activity_ids'])) throw new RuntimeException('INVALID_REPORT_DATA');
			$ids=array(); foreach ($data['activity_ids'] as $id) {
				if (!preg_match('/^[1-9][0-9]{0,17}$/',(string)$id)) throw new RuntimeException('INVALID_REPORT_SCOPE');
				$ids[]=(int)$id;
			}
			$ids=array_values(array_unique($ids)); sort($ids,SORT_NUMERIC);
			if (count($ids)>10000 || ($type==='audit' && $ids)) throw new RuntimeException('INVALID_REPORT_SCOPE');
			$calculationDate=$reader->date(); unset($reader);
			if (!$this->db->commit('mjl export snapshot read complete')) throw new RuntimeException('EXPORT_DATABASE_FAILED');
			$ref='MJL-EXPORT-'.bin2hex(random_bytes(16)); $generationTime=gmdate('Y-m-d H:i:s');
			$filtersJson=json_encode($filters,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
			$scopeJson=json_encode($ids,JSON_THROW_ON_ERROR);
			$data['document']['metadata']=array_merge($data['document']['metadata'],array('Identifiant export'=>$ref,'Rapport'=>mjl_report_titles()[$type],'Générateur'=>$identity['name'],'Date de génération (UTC)'=>$generationTime,'Données capturées (UTC)'=>$snapshotTime,'Date de calcul (Porto-Novo)'=>$calculationDate,'Filtres'=>$filtersJson,'Périmètre'=>'Entité '.$this->entity.($type==='audit'?' ; historique d’audit':' ; '.count($ids).' Activité(s)')));
			$rowCount=mjl_report_preflight($data['document'],$format);
			$path=$spool->create($format); mjl_report_render($path,$format,$data['document'],$deadline);
			unset($data);
			$artifact=$spool->detach($path); unset($path);
			mjl_report_checkpoint($deadline);
			$this->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
			if (!$this->db->begin('mjl export final authorization')) throw new RuntimeException('EXPORT_DATABASE_FAILED');
			$fresh=$this->identity(true);
			if ($fresh['role']!==$identity['role'] || $fresh['native_entity']!==$identity['native_entity']) throw new RuntimeException('SCOPE_CHANGED');
			$this->requireReportRole($type,$fresh['role']); $this->requireCurrentScope($ids,$fresh['role'],$deadline);
			$audit=mjl_audit_append_in_transaction($this->db,array('entity'=>$this->entity,'object_type'=>'report','object_ref'=>$ref,'activity_id'=>count($ids)===1?$ids[0]:null,'actor'=>$this->actor,'actor_name_snapshot'=>$identity['name'],'actor_role_snapshot'=>$identity['role'],'action'=>'EXPORT_GENERATED','result'=>'SUCCESS','new_values'=>array('report_type'=>$type,'projection_version'=>1,'format'=>$format,'body_row_count'=>$rowCount,'byte_count'=>$artifact['bytes'],'content_sha256'=>$artifact['sha256']),'context'=>array('filters'=>$filters,'activity_ids'=>$ids,'snapshot_time'=>$snapshotTime)));
			if ($audit<1) throw new RuntimeException('EXPORT_AUDIT_FAILED');
			$record=array('entity'=>$this->entity,'ref'=>$ref,'report_type'=>$type,'projection_version'=>1,'format'=>$format,'status'=>'GENERATED','fk_generator'=>$identity['id'],'generator_name_snapshot'=>$identity['name'],'generator_role_snapshot'=>$identity['role'],'date_snapshot'=>$snapshotTime,'date_generation'=>$generationTime,'filters_json'=>$filtersJson,'scope_json'=>$scopeJson,'body_row_count'=>$rowCount,'byte_count'=>$artifact['bytes'],'content_sha256'=>$artifact['sha256'],'fk_audit_event'=>$audit);
			$values=array(); foreach ($record as $value) $values[]=$this->literal($value);
			$this->query('INSERT INTO '.$this->db->prefix().'mjlfinancement_export_record ('.implode(',',array_keys($record)).') VALUES ('.implode(',',$values).')');
			mjl_report_checkpoint($deadline);
			try {
				if (!$this->db->commit('mjl export authorized and generated')) throw new RuntimeException('EXPORT_COMMIT_UNCERTAIN');
			} catch (Throwable $commitError) { throw new RuntimeException('EXPORT_COMMIT_UNCERTAIN',0,$commitError); }
			mjl_report_checkpoint($deadline);
			$committed=true;
			unset($record,$values,$ids,$filtersJson,$scopeJson);
		} catch (Throwable $error) { $failure=$error; } finally {
			unset($data,$reader,$ids,$record,$values,$filtersJson,$scopeJson);
			try {
				if ($this->db->transaction_opened>0) $this->db->rollback('mjl export cleanup');
				if ($budgets!==null) $this->query('SET SESSION max_statement_time='.(float)$budgets['statement_time'].',innodb_lock_wait_timeout='.(int)$budgets['row_wait'].',lock_wait_timeout='.(int)$budgets['metadata_wait']);
			} catch (Throwable $e) { $committed=false; if ($failure===null) $failure=$e; }
			finally {
				try { if ($spool!==null) $spool->close(); }
				catch (Throwable $e) { $committed=false; if ($failure===null) $failure=$e; }
				finally { $shutdownArmed=false; if (!$committed && $artifact!==null && is_resource($artifact['stream'])) fclose($artifact['stream']); }
			}
		}
		if ($failure!==null) throw $failure;
		try { mjl_report_checkpoint($deadline); } catch (Throwable $e) { if (is_resource($artifact['stream'])) fclose($artifact['stream']); throw $e; }
		$slugs=array('activities'=>'activites','operations'=>'operations','activity_detail'=>'fiche-activite','portfolio'=>'synthese-portefeuille','audit'=>'journal-audit');
		return array_merge($artifact,array('ref'=>$ref,'filename'=>'mjl-'.$slugs[$type].'-'.str_replace(' ','-',str_replace(':','',$generationTime)).'.'.$format,'format'=>$format));
	}
}
