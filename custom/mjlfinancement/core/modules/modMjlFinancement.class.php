<?php

include_once DOL_DOCUMENT_ROOT.'/core/modules/DolibarrModules.class.php';

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
		$this->description = 'MJL financing POC';
		$this->descriptionlong = 'MJL financing POC module for conventions, activities, budget lines, expenses, fund receipts, validations, workflow actions, exchange logs, and reports.';
		$this->version = '0.9.0';
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
		$this->depends = array('modSociete', 'modProjet', 'modECM', 'modExport');
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
		$this->addRight($r, 1, 'Read MJL conventions', 'convention', 'read');
		$this->addRight($r, 2, 'Create/update MJL conventions', 'convention', 'write');
		$this->addRight($r, 3, 'Delete MJL conventions', 'convention', 'delete');
		$this->addRight($r, 6, 'Read MJL activities', 'activity', 'read');
		$this->addRight($r, 7, 'Create/update MJL activities', 'activity', 'write');
		$this->addRight($r, 8, 'Delete MJL activities', 'activity', 'delete');
		$this->addRight($r, 9, 'Validate MJL activities', 'activity', 'validate');
		$this->addRight($r, 11, 'Read MJL budget lines', 'budgetline', 'read');
		$this->addRight($r, 12, 'Create/update MJL budget lines', 'budgetline', 'write');
		$this->addRight($r, 13, 'Delete MJL budget lines', 'budgetline', 'delete');
		$this->addRight($r, 21, 'Read MJL expenses', 'expense', 'read');
		$this->addRight($r, 22, 'Create/update MJL expenses', 'expense', 'write');
		$this->addRight($r, 23, 'Delete MJL expenses', 'expense', 'delete');
		$this->addRight($r, 24, 'Validate MJL expenses', 'expense', 'validate');
		$this->addRight($r, 31, 'Read MJL exports', 'export', 'read');
		$this->addRight($r, 32, 'Export MJL reports', 'export', 'write');
		$this->addRight($r, 41, 'Read MJL fund receipts', 'fundreceipt', 'read');
		$this->addRight($r, 42, 'Create/update MJL fund receipts', 'fundreceipt', 'write');
		$this->addRight($r, 51, 'Read MJL validations', 'validation', 'read');
		$this->addRight($r, 52, 'Create/update MJL validations', 'validation', 'write');
		$this->addRight($r, 56, 'Read MJL workflow actions', 'workflowaction', 'read');
		$this->addRight($r, 57, 'Create/update MJL workflow actions', 'workflowaction', 'write');
		$this->addRight($r, 58, 'Read MJL exchange logs', 'exchangelog', 'read');
		$this->addRight($r, 59, 'Create/update MJL exchange logs', 'exchangelog', 'write');
		$this->addRight($r, 61, 'Read MJL reports', 'report', 'read');
		$this->addRight($r, 62, 'Create/update MJL reports', 'report', 'write');

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
			'perms' => '$user->hasRight("mjlfinancement", "convention", "read") || $user->hasRight("mjlfinancement", "activity", "read") || $user->hasRight("mjlfinancement", "budgetline", "read") || $user->hasRight("mjlfinancement", "expense", "read") || $user->hasRight("mjlfinancement", "fundreceipt", "read") || $user->hasRight("mjlfinancement", "validation", "read") || $user->hasRight("mjlfinancement", "workflowaction", "read") || $user->hasRight("mjlfinancement", "exchangelog", "read") || $user->hasRight("mjlfinancement", "report", "read") || $user->hasRight("mjlfinancement", "export", "read")',
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
		$result = $this->_load_tables('/mjlfinancement/sql/');
		if ($result < 0) {
			return -1;
		}
		$this->remove($options);
		return $this->_init(array(), $options);
	}

	public function remove($options = '')
	{
		return $this->_remove(array(), $options);
	}
}
