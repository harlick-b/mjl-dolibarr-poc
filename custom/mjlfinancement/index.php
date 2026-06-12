<?php

require '../../main.inc.php';

if (!$user->hasRight('mjlfinancement', 'convention', 'read') && !$user->hasRight('mjlfinancement', 'budgetline', 'read') && !$user->hasRight('mjlfinancement', 'expense', 'read')) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');

llxHeader('', $langs->trans('MJLFinancement'));

print load_fiche_titre($langs->trans('MJLFinancement'), '', 'money-bill');
print '<div class="info">'.$langs->trans('ModuleMjlFinancementDesc').'</div>';

llxFooter();
$db->close();
