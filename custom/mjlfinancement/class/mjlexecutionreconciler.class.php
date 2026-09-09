<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';

/** Bounded, idempotent Dolibarr cron adapter for date-driven execution status events. */
class MjlExecutionReconciler
{
	public $error = '';
	public $output = '';
	private $db;

	public function __construct(DoliDB $db) { $this->db = $db; }

	public function run()
	{
		global $conf;
		$entity = isset($conf->entity) ? (int) $conf->entity : 0;
		if ($entity <= 0) { $this->error='Entité MJL invalide.'; return -1; }
		$cursor = 0; $processed = 0;
		try {
			do {
				$res = $this->db->query('SELECT rowid FROM '.$this->db->prefix().'mjlfinancement_activity WHERE entity='.$entity.' AND rowid>'.$cursor.' AND fk_current_revision IS NOT NULL ORDER BY rowid LIMIT 100');
				if (!$res) throw new RuntimeException('Lecture des Activités impossible.');
				$ids=array();while($row=$this->db->fetch_object($res))$ids[]=(int)$row->rowid;
				foreach($ids as$id){$cursor=$id;$command=new MjlActivityCommand($this->db,null,$entity);$outcome=$command->reconcileExecutionStatus((string)$id,null);if(($outcome['code']??'')!=='OK')throw new RuntimeException('Réconciliation impossible pour l’Activité '.$id.'.');$processed++;}
			} while(count($ids)===100);
			$this->output=$processed.' Activité(s) réconciliée(s).'; return 0;
		} catch(Throwable$exception){$this->error=$exception->getMessage();return-1;}
	}
}

