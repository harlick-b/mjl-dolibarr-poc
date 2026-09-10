<?php

require_once __DIR__.'/../lib/mjl_monitoring.lib.php';
require_once __DIR__.'/../lib/mjl_monitoring_work.lib.php';
require_once __DIR__.'/../lib/mjl_scope.lib.php';

/** Bounded entity/assignment-scoped read model. No business mutations. */
class MjlMonitoring
{
	const SOURCE_LIMIT = 5242880;
	private $db;
	private $entity;
	private $actor;
	private $role;
	private $date;

	public function __construct($db, $actor, $entity, $date = null)
	{
		$this->db=$db; $this->actor=$actor; $this->entity=(int)$entity;
		$this->role=mjl_scope_effective_role_code($actor,$this->entity);
		$this->date=$date ?? mjl_monitoring_date();
		if ($this->entity<1 || !in_array($this->role,array('AGENT_SAISIE','AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF','ADMIN_PLATEFORME'),true)) throw new RuntimeException('FORBIDDEN');
	}

	public function role() { return $this->role; }
	public function date() { return $this->date; }
	public function rows($sql)
	{
		$res=$this->db->query($sql);
		if (!$res) throw new RuntimeException('READ_FAILED');
		$rows=array(); while ($row=$this->db->fetch_object($res)) $rows[]=(array)$row;
		$this->db->free($res);
		return $rows;
	}
	private function literal($v) { return "'".$this->db->escape((string)$v)."'"; }
	private function table($suffix) { return $this->db->prefix().'mjlfinancement_'.$suffix; }

	public function activityWhere(array $filters)
	{
		if ($this->role==='ADMIN_PLATEFORME') throw new RuntimeException('FORBIDDEN');
		$where=array('a.entity='.$this->entity);
		if ($this->role==='AGENT_SAISIE') $where[]='EXISTS (SELECT 1 FROM '.$this->table('activity_assignment').' aa WHERE aa.entity=a.entity AND aa.fk_activity=a.rowid AND aa.fk_user='.(int)$this->actor->id.' AND aa.date_end IS NULL)';
		foreach (array('activity_id'=>'a.rowid','partner_id'=>'a.fk_partner','project_id'=>'a.fk_project') as $key=>$column) if ($filters[$key]!=='') $where[]=$column.'='.(int)$filters[$key];
		if ($filters['validation_status']!=='') $where[]='a.validation_status='.$this->literal($filters['validation_status']);
		if ($filters['date_from']!=='') $where[]='a.date_end>='.$this->literal($filters['date_from']);
		if ($filters['date_to']!=='') $where[]='a.date_start<='.$this->literal($filters['date_to']);
		if ($filters['q']!=='') $where[]='(LOCATE('.$this->literal($filters['q']).',a.ref)>0 OR LOCATE('.$this->literal($filters['q']).',a.name)>0)';
		return implode(' AND ',$where);
	}

	/** Preflight runs before any large text enters a buffered result. */
	public function activities(array $filters)
	{
		$where=$this->activityWhere($filters);
		$from=' FROM '.$this->table('activity').' a';
		$referenceFrom=$from.' JOIN '.$this->db->prefix().'societe s ON s.entity=a.entity AND s.rowid=a.fk_partner JOIN '.$this->db->prefix().'projet p ON p.entity=a.entity AND p.rowid=a.fk_project';
		$operationFrom=' FROM '.$this->table('operation').' o JOIN '.$this->table('activity').' a ON a.entity=o.entity AND a.rowid=o.fk_activity';
		$a=$this->rows('SELECT COUNT(*) AS n,COALESCE(SUM(OCTET_LENGTH(a.name)+OCTET_LENGTH(a.description)+OCTET_LENGTH(s.nom)+OCTET_LENGTH(p.title)+512),0) AS bytes'.$referenceFrom.' WHERE '.$where)[0];
		$o=$this->rows('SELECT COUNT(*) AS n,COALESCE(SUM(OCTET_LENGTH(o.name)+COALESCE(OCTET_LENGTH(o.observation),0)+OCTET_LENGTH(t.label)+256),0) AS bytes'.$operationFrom.' JOIN '.$this->table('operation_type').' t ON t.entity=o.entity AND t.rowid=o.fk_operation_type WHERE '.$where.' AND o.date_removed IS NULL')[0];
		$assignmentFrom=' FROM '.$this->table('activity_assignment').' aa JOIN '.$this->table('activity').' a ON a.entity=aa.entity AND a.rowid=aa.fk_activity JOIN '.$this->db->prefix().'user u ON u.rowid=aa.fk_user AND u.entity=aa.entity WHERE '.$where.' AND aa.date_end IS NULL';
		$assignedStats=$this->rows('SELECT COUNT(*) AS n,COALESCE(SUM(COALESCE(OCTET_LENGTH(u.firstname),0)+COALESCE(OCTET_LENGTH(u.lastname),0)+COALESCE(OCTET_LENGTH(u.login),0)+128),0) AS bytes'.$assignmentFrom)[0];
		if ((int)$assignedStats['n']>100000 || (int)$a['n']>10000 || (int)$o['n']>100000 || (int)$a['bytes']+(int)$o['bytes']+(int)$assignedStats['bytes']>self::SOURCE_LIMIT) throw new RuntimeException('SOURCE_LIMIT');
		$activities=$this->rows('SELECT a.*,s.nom AS partner_name,p.title AS project_name,r.revision_number'.$from.' JOIN '.$this->db->prefix().'societe s ON s.entity=a.entity AND s.rowid=a.fk_partner JOIN '.$this->db->prefix().'projet p ON p.entity=a.entity AND p.rowid=a.fk_project LEFT JOIN '.$this->table('activity_revision').' r ON r.entity=a.entity AND r.rowid=a.fk_current_revision AND r.fk_activity=a.rowid WHERE '.$where.' ORDER BY a.rowid DESC');
		$operations=$this->rows('SELECT o.*,t.label AS type_label'.$operationFrom.' JOIN '.$this->table('operation_type').' t ON t.entity=o.entity AND t.rowid=o.fk_operation_type WHERE '.$where.' AND o.date_removed IS NULL ORDER BY o.rowid');
		$byActivity=array();foreach($operations as $row) $byActivity[$row['fk_activity']][]=$row;
		$assignments=$this->rows('SELECT aa.fk_activity,aa.fk_user,aa.is_primary,u.firstname,u.lastname,u.login FROM '.$this->table('activity_assignment').' aa JOIN '.$this->table('activity').' a ON a.entity=aa.entity AND a.rowid=aa.fk_activity JOIN '.$this->db->prefix().'user u ON u.rowid=aa.fk_user AND u.entity=aa.entity WHERE '.$where.' AND aa.date_end IS NULL ORDER BY aa.fk_activity,aa.is_primary DESC,aa.rowid');
		$assigned=array();foreach($assignments as $row) $assigned[$row['fk_activity']][]=$row;
		$result=array();foreach($activities as $activity) {
			$children=$byActivity[$activity['rowid']] ?? array();
			$row=mjl_monitoring_activity_projection($activity,$children,$this->date);
			if ($filters['execution_status']!=='' && $row['execution_status']!==$filters['execution_status']) continue;
			if ($filters['completeness']!=='' && $row['completeness']!==$filters['completeness']) continue;
			$row['operations']=$children;$row['assignments']=$assigned[$activity['rowid']] ?? array();$result[]=$row;
		}
		return $result;
	}

	public function operations(array $activities,array $filters)
	{
		$rows=array();foreach($activities as $activity) foreach($activity['operations'] as $operation) {
			if ($filters['type_id']!=='' && (string)$operation['fk_operation_type']!==$filters['type_id']) continue;
			if ($filters['operation_status']!=='' && $operation['status']!==$filters['operation_status']) continue;
			$actions=mjl_monitoring_activity_actions($activity,$this->role,$this->actor->id,$this->date);
			$rows[]=array_merge($operation,array('activity_ref'=>$activity['ref'],'activity_name'=>$activity['name'],'partner_name'=>$activity['partner_name'],'project_name'=>$activity['project_name'],'authorization_kind'=>$activity['validated_amount']===null?'Proposée':'Validée','activity_id'=>$activity['rowid'],'validation_status'=>$activity['validation_status'],'is_cancelled'=>$activity['is_cancelled'],'execution_allowed'=>$actions['execution']));
		}
		return $rows;
	}

	/** Only current revision facts are loaded, including historical contributors. */
	public function reviewFacts(array $activities)
	{
		if (!$activities) return array();
		$ids=implode(',',array_map('intval',array_column($activities,'rowid')));
		$from=' FROM '.$this->table('activity').' a WHERE '.$this->activityWhere(mjl_monitoring_filters(array())).' AND a.rowid IN ('.$ids.')';
		$revisions='SELECT a.fk_current_revision'.$from;
		$contributors=$this->rows('SELECT fk_revision,fk_user FROM '.$this->table('revision_contributor').' WHERE entity='.$this->entity.' AND fk_revision IN ('.$revisions.') ORDER BY fk_revision,fk_user LIMIT 100001');
		if (count($contributors)>100000) throw new RuntimeException('SOURCE_LIMIT');
		$decisions=$this->rows('SELECT fk_revision,fk_actor FROM '.$this->table('review_decision')." WHERE entity=".$this->entity." AND stage='SUPERVISOR' AND decision_type='PREVALIDATED' AND fk_revision IN (".$revisions.') ORDER BY rowid LIMIT 10001');
		if (count($decisions)>10000) throw new RuntimeException('SOURCE_LIMIT');
		$facts=array();
		foreach ($contributors as $row) $facts[$row['fk_revision']]['contributors'][]=$row['fk_user'];
		foreach ($decisions as $row) $facts[$row['fk_revision']]['prevalidator_id']=$row['fk_actor'];
		foreach ($activities as &$activity) $activity=array_merge($activity,array('contributors'=>array(),'prevalidator_id'=>null),$facts[$activity['fk_current_revision']] ?? array());
		unset($activity);
		return $activities;
	}

	/** Bounded, scoped request browsing; status is a stored state, never a stale flag. */
	public function requests(array $activities, $status='PENDING')
	{
		if (!in_array($status,array('','PENDING','APPROVED','REJECTED','WITHDRAWN'),true)) throw new InvalidArgumentException('INVALID_FILTER');
		if (!$activities) return array();
		$byId=array_column($activities,null,'rowid');
		$ids=implode(',',array_map('intval',array_keys($byId)));
		$where=$this->activityWhere(mjl_monitoring_filters(array())).' AND a.rowid IN ('.$ids.')'.($status!==''?' AND r.status='.$this->literal($status):'');
		$result=array(); $bytes=0;
		foreach (array('CANCELLATION'=>'cancellation_request','REOPENING'=>'reopening_request') as $type=>$suffix) {
			$from=' FROM '.$this->table($suffix).' r JOIN '.$this->table('activity').' a ON a.entity=r.entity AND a.rowid=r.fk_activity WHERE '.$where;
			$stats=$this->rows('SELECT COUNT(*) AS n,COALESCE(SUM(OCTET_LENGTH(r.reason)+OCTET_LENGTH(r.requester_name_snapshot)+512),0) AS bytes'.$from)[0];
			$bytes+=(int)$stats['bytes'];
			if (count($result)+(int)$stats['n']>10000 || $bytes>self::SOURCE_LIMIT) throw new RuntimeException('SOURCE_LIMIT');
			$columns='r.rowid,r.entity,r.fk_activity,r.fk_target_revision,r.target_version,r.fk_requester,r.requester_name_snapshot,r.reason,r.status,r.version,r.date_request,'.($type==='CANCELLATION'?'r.target_type,r.target_id,r.target_operation_set_hash':'r.fk_operation');
			foreach ($this->rows('SELECT '.$columns.$from.' ORDER BY r.date_request DESC,r.rowid DESC') as $request) {
				$request['request_type']=$type;
				$activity=$byId[$request['fk_activity']];
				$target=$activity; $label=$activity['ref'];
				if ($type==='REOPENING' || $request['target_type']==='OPERATION') {
					$target=null; $id=$type==='REOPENING'?$request['fk_operation']:$request['target_id'];
					foreach ($activity['operations'] as $operation) if ((string)$operation['rowid']===(string)$id) $target=$operation;
					$label.=' / '.($target['name'] ?? 'Opération indisponible');
				}
				$request['target_label']=$label;
				$request['current_target_version']=$target['version'] ?? 0;
				$request['eligibility']=mjl_monitoring_request_actions($request,$activity,$activity['operations'],$this->role,$this->actor->id);
				$result[]=$request;
			}
		}
		usort($result,function($a,$b){return strcmp($b['date_request'],$a['date_request']) ?: strcmp($a['request_type'],$b['request_type']) ?: ((int)$b['rowid']<=>(int)$a['rowid']);});
		return $result;
	}

	public function auditWhere(array $filters)
	{
		if (!in_array($this->role,array('VALIDATEUR_DEFINITIF','ADMIN_PLATEFORME'),true)) throw new RuntimeException('FORBIDDEN');
		$where=array('entity='.$this->entity);
		foreach(array('object_type','object_id','activity_id','operation_id','revision_id','actor_id','result') as $key) if($filters[$key]!=='') $where[]=$key.'='.$this->literal($filters[$key]);
		foreach (array('event_id'=>'rowid','target_version'=>'target_version') as $key=>$column) if ($filters[$key]!=='') $where[]=$column.'='.$this->literal($filters[$key]);
		if($filters['audit_action']!=='') $where[]='action='.$this->literal($filters['audit_action']);
		if($filters['q']!=='') $where[]='(LOCATE('.$this->literal($filters['q']).',object_ref)>0 OR LOCATE('.$this->literal($filters['q']).',actor_name_snapshot)>0)';
		if($filters['date_from']!=='') $where[]='event_date>='.$this->literal($filters['date_from'].' 00:00:00');
		if($filters['date_to']!=='') $where[]='event_date<='.$this->literal($filters['date_to'].' 23:59:59');
		return implode(' AND ',$where);
	}

	public function audit(array $filters, $export=false)
	{
		$where=$this->auditWhere($filters);
		$direction=$filters['direction']==='asc'?'ASC':'DESC';
		if(!$export && $filters['cursor']!=='') $where.=' AND rowid'.($direction==='ASC'?'>':'<').(int)$filters['cursor'];
		$from=' FROM '.$this->table('audit_event').' WHERE '.$where;
		$selection='SELECT *'.$from.' ORDER BY rowid '.$direction.($export?'':' LIMIT 51');
		$stats=$this->rows('SELECT COUNT(*) AS n,COALESCE(SUM(COALESCE(OCTET_LENGTH(previous_values_json),0)+COALESCE(OCTET_LENGTH(new_values_json),0)+COALESCE(OCTET_LENGTH(context_json),0)+COALESCE(OCTET_LENGTH(reason),0)+OCTET_LENGTH(object_type)+COALESCE(OCTET_LENGTH(object_ref),0)+OCTET_LENGTH(actor_name_snapshot)+OCTET_LENGTH(actor_role_snapshot)+OCTET_LENGTH(action)+COALESCE(OCTET_LENGTH(state_before),0)+COALESCE(OCTET_LENGTH(state_after),0)+OCTET_LENGTH(result)+256),0) AS bytes FROM ('.$selection.') selected')[0];
		if((int)$stats['n']>10000 || (int)$stats['bytes']>self::SOURCE_LIMIT) throw new RuntimeException('SOURCE_LIMIT');
		return $this->rows($selection);
	}
}
