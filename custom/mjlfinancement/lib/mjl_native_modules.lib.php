<?php

require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';

function mjl_native_modules_disabled_for_workspace()
{
	return array(
		'modAccounting',
		'modComptabilite',
		'modFacture',
		'modBanque',
		'modTax',
		'modExpenseReport',
		'modHoliday',
		'modHRM',
		'modModuleBuilder',
		'modApi',
	);
}

function mjl_native_modules_disable_workspace_modules($logger = null)
{
	$errors = array();
	foreach (mjl_native_modules_disabled_for_workspace() as $module) {
		$result = unActivateModule($module, 1, 1);
		if ($result !== '') {
			$errors[] = $module.': '.$result;
			continue;
		}
		if (is_callable($logger)) {
			call_user_func($logger, 'Disabled native module '.$module);
		}
	}

	return $errors;
}
