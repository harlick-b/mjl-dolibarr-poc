<?php

require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';

/**
 * Load the one native technical administrator approved for the clean tenant.
 *
 * @param DoliDB $db Dolibarr database handle
 * @return User
 * @throws RuntimeException When the approved identity has drifted
 */
function mjl_load_preserved_native_admin($db)
{
	$adminUser = new User($db);
	if ($adminUser->fetch(1) <= 0
		|| (int) $adminUser->id !== 1
		|| (int) $adminUser->entity !== 0
		|| $adminUser->login !== 'admin'
		|| empty($adminUser->admin)
		|| empty($adminUser->statut)) {
		throw new RuntimeException(
			'The preserved native administrator must be active llx_user.rowid=1, entity=0, login=admin.'
		);
	}

	return $adminUser;
}
