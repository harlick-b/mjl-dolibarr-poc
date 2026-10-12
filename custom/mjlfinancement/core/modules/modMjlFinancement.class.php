<?php

include_once DOL_DOCUMENT_ROOT.'/core/modules/DolibarrModules.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/activity_schema_installer.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006a_schema.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006b_schema.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst012_schema.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

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
		$this->version = '0.21.0';
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
		$this->cronjobs = array(
			array(
				'label' => 'Réconciliation des statuts d’exécution MJL',
				'jobtype' => 'method',
				'class' => '/mjlfinancement/class/mjlexecutionreconciler.class.php',
				'objectname' => 'MjlExecutionReconciler',
				'method' => 'run',
				'parameters' => '',
				'comment' => 'Réconciliation horaire idempotente en Africa/Porto-Novo',
				'frequency' => 1,
				'unitfrequency' => 3600,
				'status' => 1,
				'test' => "isModEnabled('mjlfinancement')",
			),
		);

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
		$preparation = mjl_lifecycle_prepare($this->db, function ($path) {
			return $this->_load_tables($path);
		}, function () use ($options) {
			$this->remove($options);
			return $this->_init(array(), $options);
		});
		if ($preparation['result'] < 0) {
			if ($preparation['error'] !== '') $this->error = $preparation['error'];
		}
		return $preparation['result'];
	}

	public function remove($options = '')
	{
		return $this->_remove(array(), $options);
	}
}
