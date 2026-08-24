<?php

include_once DOL_DOCUMENT_ROOT.'/core/modules/DolibarrModules.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/activity_schema_installer.lib.php';

class modMjlFinancement extends DolibarrModules
{
	public function __construct($db)
	{
		$this->db = $db;
		$this->numero = 520000;
		$this->rights_class = 'mjlfinancement';
		$this->family = 'financial';
		$this->module_position = '95';
		$this->name = preg_replace('/^mod/i', '', get_class($this));
		$this->description = 'Suivi des projets financés du MJL';
		$this->descriptionlong = 'Socle MJL réinitialisé : référentiels natifs, projection des activités, accès sur invitation et audit immuable.';
		$this->version = '0.17.0';
		$this->const_name = 'MAIN_MODULE_'.strtoupper($this->name);
		$this->picto = 'money-bill';
		$this->module_parts = array(
			'triggers' => 0,
			'login' => 0,
			'substitutions' => 0,
			'menus' => 0,
			'tpl' => 1,
			'barcode' => 0,
			'models' => 0,
			'printing' => 0,
			'theme' => 0,
			'css' => array('/mjlfinancement/css/mjl_auth.css.php', '/mjlfinancement/css/mjl_app.css.php'),
			'js' => array('/mjlfinancement/js/native_guard.js.php?v=nav-unification'),
			'hooks' => array('all', 'login', 'passwordforgottenpage'),
			'moduleforexternal' => 0,
			'websitetemplates' => 0,
			'captcha' => 0,
		);
		$this->dirs = array('/mjlfinancement/temp');
		$this->config_page_url = array();
		$this->hidden = false;
		$this->depends = array('modSociete', 'modProjet');
		$this->requiredby = array();
		$this->conflictwith = array();
		$this->langfiles = array('mjlfinancement@mjlfinancement');
		$this->phpmin = array(7, 4);
		$this->need_dolibarr_version = array(23, 0);
		$this->const = array();
		$this->tabs = array();
		$this->dictionaries = array();
		$this->boxes = array();
		$this->cronjobs = array();

		$this->rights = array();
		$r = 0;
		$this->addRight($r, 1, 'Lire les référentiels MJL', 'reference', 'read');
		$this->addRight($r, 2, 'Gérer les référentiels MJL', 'reference', 'write');
		$this->addRight($r, 6, 'Lire la projection des activités', 'activity', 'read');
		$this->addRight($r, 56, 'Lire l’audit MJL', 'audit', 'read');
		$this->addRight($r, 71, 'Administrer les accès MJL', 'access', 'admin');

		$this->menu = array();
		$r = 0;
		$this->menu[$r++] = array(
			'fk_menu' => '',
			'type' => 'top',
			'titre' => 'MJLFinancement',
			'prefix' => img_picto('', $this->picto, 'class="pictofixedwidth valignmiddle"'),
			'mainmenu' => 'mjlfinancement',
			'leftmenu' => '',
				'url' => '/custom/mjlfinancement/index.php',
			'langs' => 'mjlfinancement@mjlfinancement',
			'position' => 1000,
			'enabled' => "isModEnabled('mjlfinancement')",
			'perms' => '$user->admin || $user->hasRight("mjlfinancement", "reference", "read") || $user->hasRight("mjlfinancement", "activity", "read")',
			'target' => '',
			'user' => 2,
		);
	}

	private function addRight(&$r, $offset, $label, $perms, $subperms)
	{
		$this->rights[$r][0] = $this->numero + $offset;
		$this->rights[$r][1] = $label;
		$this->rights[$r][2] = in_array($subperms, array('read', 'validate'), true) ? 'r' : ($subperms === 'delete' ? 'd' : 'w');
		$this->rights[$r][3] = 0;
		$this->rights[$r][4] = $perms;
		$this->rights[$r][5] = $subperms;
		$r++;
	}

	public function init($options = '')
	{
		$prefix = mjl_rst005_prefix($this->db);
		$activity = $prefix.'mjlfinancement_activity';
		$lockName = mjl_rst005_lock_name($this->db);
		$migrationRequired = false;
		$cleanInstall = false;
		if ((int) mjl_rst005_scalar($this->db, "SELECT GET_LOCK('".$this->db->escape($lockName)."',0)") !== 1) return -1;
		try {
			$tableCount = (int) mjl_rst005_scalar($this->db, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$this->db->escape($activity)."'");
			if ($tableCount === 0) {
				$cleanInstall = true;
				$customCount = (int) mjl_rst005_scalar($this->db, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE '".$this->db->escape($prefix)."mjlfinancement\\_%'");
				if ($customCount !== 0) return -1;
				$result = $this->_load_tables('/mjlfinancement/sql/');
				if ($result < 0) return -1;
				mjl_rst005_install_insert_trigger($this->db, $activity);
				mjl_rst005_require_target_objects($this->db, $activity);
				mjl_rst005_require_retained_table_set($this->db);
			} else {
				mjl_rst005_require_retained_schema($this->db);
				$schema = mjl_rst005_detect_schema($this->db, $activity);
				if ($schema === RST005_SCHEMA_PHASE1) $migrationRequired = true;
				elseif ($schema === RST005_SCHEMA_TARGET) mjl_rst005_require_target_objects($this->db, $activity);
				else return -1;
			}
			if (getenv('MJL_DISPOSABLE_TEST_TENANT') === '1'
				&& getenv('MJL_RST_PHASE1_INJECT_ACTIVATION_FAILURE') === '1'
				&& $this->disposableActivationFailureIsArmed()) return -1;
			if (getenv('MJL_DISPOSABLE_TEST_TENANT') === '1'
				&& getenv('MJL_RST005_INJECT_ACTIVATION_FAILURE') === '1'
				&& $this->disposableRst005ActivationFailureIsArmed()) return -1;
			if ($this->ensureRoleInvariantTriggers() < 0) return -1;
			if ($this->ensureAuthStateConstraints() < 0 || $this->ensureAuthInvariantTriggers() < 0 || $this->ensureAuthFingerprintKey() < 0) return -1;
			if ($cleanInstall) mjl_rst005_require_retained_schema($this->db);
			$this->remove($options);
			$result = $this->_init(array(), $options);
			if ($result < 0) return $result;
			return $migrationRequired ? 'RST005_MIGRATION_REQUIRED' : $result;
		} catch (Throwable $exception) {
			dol_syslog('RST-005 module activation refused: '.$exception->getMessage(), LOG_ERR);
			if (PHP_SAPI === 'cli') fwrite(STDERR, 'RST-005 module activation refused: '.$exception->getMessage().PHP_EOL);
			return -1;
		} finally {
			$this->db->query("SELECT RELEASE_LOCK('".$this->db->escape($lockName)."')");
		}
	}

	private function disposableActivationFailureIsArmed()
	{
		$sql = "SELECT value FROM ".$this->db->prefix()."const WHERE name='MJL_RST_PHASE1_ACTIVATION_FAILURE_INJECTION'";
		$sql .= ' AND entity IN (0, 1) ORDER BY entity DESC, rowid DESC LIMIT 1';
		$resql = $this->db->query($sql);
		$row = $resql ? $this->db->fetch_object($resql) : null;
		return $row && (string) $row->value === '1';
	}

	private function disposableRst005ActivationFailureIsArmed()
	{
		$sql = "SELECT value FROM ".$this->db->prefix()."const WHERE name='MJL_RST005_ACTIVATION_FAILURE_INJECTION'";
		$sql .= ' AND entity=0 ORDER BY rowid DESC LIMIT 1';
		$resql = $this->db->query($sql);
		$row = $resql ? $this->db->fetch_object($resql) : null;
		return $row && (string) $row->value === '1';
	}

	private function ensureRoleInvariantTriggers()
	{
		$roleTable = $this->db->prefix().'mjlfinancement_user_role';
		$userTable = $this->db->prefix().'user';
		$businessRoles = "'AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'";
		$statements = array(
			'CREATE OR REPLACE TRIGGER '.$this->db->prefix().'mjlfinancement_user_role_bi BEFORE INSERT ON '.$roleTable.' FOR EACH ROW BEGIN DECLARE target_admin INTEGER DEFAULT 0; DECLARE target_entity INTEGER DEFAULT -1; IF NEW.role_code NOT IN ('.$businessRoles.') THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL business role\'; END IF; SELECT admin, entity INTO target_admin, target_entity FROM '.$userTable.' WHERE rowid = NEW.fk_user; IF target_entity <> NEW.entity OR (NEW.is_active = 1 AND target_admin = 1) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL role target\'; END IF; END',
			'CREATE OR REPLACE TRIGGER '.$this->db->prefix().'mjlfinancement_user_role_bu BEFORE UPDATE ON '.$roleTable.' FOR EACH ROW BEGIN DECLARE target_admin INTEGER DEFAULT 0; DECLARE target_entity INTEGER DEFAULT -1; IF NEW.role_code NOT IN ('.$businessRoles.') THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL business role\'; END IF; SELECT admin, entity INTO target_admin, target_entity FROM '.$userTable.' WHERE rowid = NEW.fk_user; IF target_entity <> NEW.entity OR (NEW.is_active = 1 AND target_admin = 1) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL role target\'; END IF; END',
			'CREATE OR REPLACE TRIGGER '.$this->db->prefix().'mjlfinancement_user_admin_bu BEFORE UPDATE ON '.$userTable.' FOR EACH ROW BEGIN IF NEW.admin = 1 AND OLD.admin <> 1 AND EXISTS (SELECT 1 FROM '.$roleTable.' WHERE fk_user = NEW.rowid AND is_active = 1 AND role_code IN ('.$businessRoles.')) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'MJL business-role user cannot become native admin\'; END IF; END',
		);
		foreach ($statements as $sql) {
			if (!$this->db->query($sql)) {
				return -1;
			}
		}
		return 1;
	}

	private function ensureAuthInvariantTriggers()
	{
		$userTable = $this->db->prefix().'user';
		$invitation = $this->db->prefix().'mjlfinancement_invitation';
		$reset = $this->db->prefix().'mjlfinancement_password_reset';
		$statements = array(
			'CREATE OR REPLACE TRIGGER '.$this->db->prefix().'mjlfinancement_invitation_bi BEFORE INSERT ON '.$invitation.' FOR EACH ROW BEGIN DECLARE target_admin INTEGER DEFAULT 1; DECLARE target_entity INTEGER DEFAULT -1; SELECT admin, entity INTO target_admin, target_entity FROM '.$userTable.' WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity OR target_admin=1 THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid invitation target\'; END IF; END',
			'CREATE OR REPLACE TRIGGER '.$this->db->prefix().'mjlfinancement_invitation_bu BEFORE UPDATE ON '.$invitation.' FOR EACH ROW BEGIN DECLARE target_admin INTEGER DEFAULT 1; DECLARE target_entity INTEGER DEFAULT -1; SELECT admin, entity INTO target_admin, target_entity FROM '.$userTable.' WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity OR target_admin=1 OR NEW.entity<>OLD.entity OR NEW.fk_user<>OLD.fk_user OR NEW.token_selector<>OLD.token_selector THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid invitation mutation\'; END IF; END',
			'CREATE OR REPLACE TRIGGER '.$this->db->prefix().'mjlfinancement_reset_bi BEFORE INSERT ON '.$reset.' FOR EACH ROW BEGIN DECLARE target_entity INTEGER DEFAULT -1; SELECT entity INTO target_entity FROM '.$userTable.' WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid reset target\'; END IF; END',
			'CREATE OR REPLACE TRIGGER '.$this->db->prefix().'mjlfinancement_reset_bu BEFORE UPDATE ON '.$reset.' FOR EACH ROW BEGIN DECLARE target_entity INTEGER DEFAULT -1; SELECT entity INTO target_entity FROM '.$userTable.' WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity OR NEW.entity<>OLD.entity OR NEW.fk_user<>OLD.fk_user OR NEW.token_selector<>OLD.token_selector THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid reset mutation\'; END IF; END',
		);
		foreach ($statements as $sql) if (!$this->db->query($sql)) return -1;
		return 1;
	}

	private function ensureAuthStateConstraints()
	{
		$definitions = array(
			'mjlfinancement_invitation' => array(
				'chk_mjl_invitation_credential_state' => "((status IN ('pending_send', 'sent') AND token_hash IS NOT NULL) OR (status IN ('accepted', 'revoked', 'send_failed') AND token_hash IS NULL))",
				'chk_mjl_invitation_terminal_date' => "((status IN ('pending_send', 'sent') AND date_accepted IS NULL AND date_revoked IS NULL) OR (status = 'accepted' AND date_accepted IS NOT NULL) OR (status IN ('revoked', 'send_failed') AND date_revoked IS NOT NULL))",
			),
			'mjlfinancement_password_reset' => array(
				'chk_mjl_reset_credential_state' => "((status IN ('pending_send', 'sent') AND token_hash IS NOT NULL AND date_consumed IS NULL) OR (status IN ('consumed', 'send_failed', 'revoked') AND token_hash IS NULL AND date_consumed IS NOT NULL))",
			),
		);
		foreach ($definitions as $table => $constraints) foreach ($constraints as $name => $expression) {
			$sql = "SELECT COUNT(*) AS nb FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$this->db->escape($this->db->prefix().$table)."' AND CONSTRAINT_NAME='".$this->db->escape($name)."'";
			$resql = $this->db->query($sql);
			$row = $resql ? $this->db->fetch_object($resql) : null;
			if (!$row) return -1;
			if ((int) $row->nb === 0 && !$this->db->query('ALTER TABLE '.$this->db->prefix().$table.' ADD CONSTRAINT '.$name.' CHECK '.$expression)) return -1;
		}
		return 1;
	}

	private function ensureAuthFingerprintKey()
	{
		$sql = 'SELECT rowid FROM '.$this->db->prefix()."const WHERE name='MJL_AUTH_FINGERPRINT_KEY' AND entity=0 LIMIT 1";
		$resql = $this->db->query($sql);
		if (!$resql) return -1;
		if ($this->db->num_rows($resql) > 0) return 1;
		$value = bin2hex(random_bytes(32));
		$sql = 'INSERT INTO '.$this->db->prefix()."const (name,value,type,visible,note,entity) VALUES ('MJL_AUTH_FINGERPRINT_KEY','".$this->db->escape($value)."','chaine',0,'HMAC key for non-reversible auth fingerprints',0)";
		return $this->db->query($sql) ? 1 : -1;
	}

	public function remove($options = '')
	{
		return $this->_remove(array(), $options);
	}
}
