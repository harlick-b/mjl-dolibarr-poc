<?php

require_once __DIR__.'/cli_guard.php';

function mjl_readiness_ini_state($value)
{
	$value = strtolower(trim((string) $value));
	if (in_array($value, array('1', 'on', 'yes', 'true'), true)) return 'on';
	if (in_array($value, array('stdout', 'stderr'), true)) return $value;
	return 'off';
}

$mjlObservedPhpPosture = array(
	'display_errors' => mjl_readiness_ini_state(ini_get('display_errors')),
	'log_errors' => mjl_readiness_ini_state(ini_get('log_errors')),
	'cookie_secure' => mjl_readiness_ini_state(ini_get('session.cookie_secure')),
	'cookie_httponly' => mjl_readiness_ini_state(ini_get('session.cookie_httponly')),
	'cookie_samesite' => (string) ini_get('session.cookie_samesite'),
);
define('NOLOGIN', 1);
define('NOSESSION', 1);
define('NOREQUIREUSER', 1);
define('NOREQUIREMENU', 1);
define('NOREQUIREHTML', 1);
define('NOBROWSERNOTIF', 1);
define('NOTOKENRENEWAL', 1);
ini_set('display_errors', '0');

$mjlReadinessFinished = false;
ob_start();
register_shutdown_function(function () use (&$mjlReadinessFinished) {
	if ($mjlReadinessFinished) return;
	while (ob_get_level() > 0) ob_end_clean();
	print json_encode(array(
		'schema_version' => 1,
		'environment' => 'unknown',
		'diagnostic_status' => 'BLOCKED',
		'controls' => array(array(
			'name' => 'diagnostic_bootstrap',
			'class' => 'integration',
			'status' => 'BLOCKED',
			'detail' => 'Unable to load the application for a read-only diagnostic.',
		)),
	), JSON_UNESCAPED_SLASHES).PHP_EOL;
});

require '/var/www/html/main.inc.php';
require_once __DIR__.'/rst012_schema.lib.php';

function mjl_readiness_control(&$controls, $name, $class, $status, $detail)
{
	$controls[] = array('name' => $name, 'class' => $class, 'status' => $status, 'detail' => $detail);
}

function mjl_readiness_scalar($db, $sql)
{
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') === '1' && getenv('MJL_READINESS_FAILURE_INJECTION') === '1') throw new RuntimeException('Injected disposable diagnostic read failure.');
	$res = $db->query($sql);
	if (!$res) throw new RuntimeException('Read-only configuration query failed.');
	$row = $db->fetch_row($res);
	return $row ? (string) $row[0] : '';
}

function mjl_readiness_constant($db, $prefix, $entity, $name)
{
	return mjl_readiness_scalar($db, "SELECT value FROM {$prefix}const WHERE entity IN (0,".(int) $entity.") AND name='".$db->escape($name)."' ORDER BY entity DESC,rowid DESC LIMIT 1");
}

$controls = array();
$environment = getenv('MJL_DISPOSABLE_TEST_TENANT') === '1' ? 'disposable' : 'installed';

try {
	try {
		mjl_rst012_require_target($db);
		mjl_readiness_control($controls, 'rst012_schema', 'integration', 'OK', 'Exact RST-012 schema is installed.');
	} catch (Throwable $exception) {
		mjl_readiness_control($controls, 'rst012_schema', 'integration', 'BLOCKED', 'Exact RST-012 schema is not established.');
	}

	$entity = isset($conf->entity) ? (int) $conf->entity : 0;
	mjl_readiness_control($controls, 'active_entity', 'integration', $entity > 0 ? 'OK' : 'BLOCKED', $entity > 0 ? 'A positive active Dolibarr entity is selected.' : 'No valid active Dolibarr entity is selected.');

	$prefix = $db->prefix();
	$adminExact = (int) mjl_readiness_scalar($db, "SELECT COUNT(*) FROM {$prefix}user WHERE rowid=1 AND entity=0 AND login='admin' AND admin=1 AND statut=1") === 1
		&& (int) mjl_readiness_scalar($db, "SELECT COUNT(*) FROM {$prefix}user") === 1;
	mjl_readiness_control($controls, 'native_administrator', 'integration', $adminExact ? 'OK' : 'BLOCKED', $adminExact ? 'The exact retained native technical administrator is present.' : 'The retained native administrator baseline differs.');

	$businessQueries = array(
		"SELECT COUNT(*) FROM {$prefix}user WHERE admin=0",
		"SELECT COUNT(*) FROM {$prefix}societe",
		"SELECT COUNT(*) FROM {$prefix}projet",
		"SELECT COUNT(*) FROM {$prefix}ecm_files",
	);
	$tableLike = str_replace(array('=','%','_'), array('==','=%','=_'), $prefix.'mjlfinancement_').'%';
	$tableResult = $db->query("SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE '".$db->escape($tableLike)."' ESCAPE '=' AND COLUMN_NAME='entity' ORDER BY TABLE_NAME");
	if (!$tableResult) throw new RuntimeException('Read-only business-table discovery failed.');
	while ($table = $db->fetch_object($tableResult)) {
		if (!preg_match('/^[A-Za-z0-9_]+$/', $table->TABLE_NAME)) throw new RuntimeException('Unsafe business-table identifier.');
		$businessQueries[] = 'SELECT COUNT(*) FROM `'.$table->TABLE_NAME.'`';
	}
	$businessCount = 0;
	foreach ($businessQueries as $query) $businessCount += (int) mjl_readiness_scalar($db, $query);
	mjl_readiness_control($controls, 'empty_start', 'integration', $businessCount === 0 ? 'OK' : 'BLOCKED', $businessCount === 0 ? 'No MJL business or sample records are present.' : 'The inspected tenant contains MJL business or sample records.');

	$moduleEnabled = (int) mjl_readiness_scalar($db, "SELECT COUNT(*) FROM {$prefix}const WHERE entity=".$entity." AND name='MAIN_MODULE_MJLFINANCEMENT' AND value='1'") === 1;
	mjl_readiness_control($controls, 'mjl_module', 'integration', $moduleEnabled ? 'OK' : 'BLOCKED', $moduleEnabled ? 'The MJL module is enabled for the active entity.' : 'The MJL module is not enabled exactly once for the active entity.');

	$guardPath = DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/deployment/apache-native-guard.conf';
	$guard = @file_get_contents($guardPath);
	$enabledGuard = @file_get_contents('/etc/apache2/conf-enabled/mjl-native-guard.conf');
	$guarded = is_string($guard) && is_string($enabledGuard) && hash_equals(hash('sha256', $guard), hash('sha256', $enabledGuard)) && strpos($guard, '/custom/mjlfinancement/scripts') !== false && strpos($guard, 'Require all denied') !== false;
	mjl_readiness_control($controls, 'route_containment', 'integration', $guarded ? 'OK' : 'BLOCKED', $guarded ? 'The committed Apache guard is enabled and denies operational scripts.' : 'The enabled operational-script guard is missing, different, or incomplete.');

	$registrationAbsent = !file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/register.php');
	$nativeUserDenied = is_string($guard) && strpos($guard, '<LocationMatch "^/user/(?!logout\\.php$|passwordforgotten\\.php') !== false;
	$invitationOnly = $registrationAbsent && $nativeUserDenied && is_string($enabledGuard) && hash_equals(hash('sha256', $guard), hash('sha256', $enabledGuard));
	mjl_readiness_control($controls, 'invitation_only', 'integration', $invitationOnly ? 'OK' : 'BLOCKED', $invitationOnly ? 'The enabled guard denies native user routes and no custom registration route exists.' : 'Invitation-only route containment is incomplete.');

	$lang = mjl_readiness_constant($db, $prefix, $entity, 'MAIN_LANG_DEFAULT');
	$currency = mjl_readiness_constant($db, $prefix, $entity, 'MAIN_MONNAIE');
	$languageOk = strpos($lang, 'fr_') === 0;
	$currencyOk = $currency === 'XOF';
	$timezoneOk = date_default_timezone_get() === 'Africa/Porto-Novo';
	mjl_readiness_control($controls, 'french_language', 'integration', $languageOk ? 'OK' : 'BLOCKED', $languageOk ? 'French is configured.' : 'The required French configuration is not established.');
	mjl_readiness_control($controls, 'xof_currency', 'integration', $currencyOk ? 'OK' : 'BLOCKED', $currencyOk ? 'XOF is configured.' : 'The required XOF configuration is not established.');
	mjl_readiness_control($controls, 'porto_novo_timezone', 'integration', $timezoneOk ? 'OK' : 'BLOCKED', $timezoneOk ? 'Africa/Porto-Novo is configured.' : 'Africa/Porto-Novo is not configured.');

	$cronCount = (int) mjl_readiness_scalar($db, "SELECT COUNT(*) FROM {$prefix}cronjob WHERE entity=".$entity." AND objectname='MjlExecutionReconciler' AND methodename='run' AND frequency=1 AND unitfrequency=3600 AND status=1");
	mjl_readiness_control($controls, 'reconciler_registration', 'integration', $cronCount === 1 ? 'OK' : 'BLOCKED', $cronCount === 1 ? 'Exactly one enabled hourly reconciler is registered.' : 'The exact unique hourly reconciler registration is not established.');

	$baseUrl = isset($dolibarr_main_url_root) ? (string) $dolibarr_main_url_root : '';
	$baseUrlKnown = $environment !== 'disposable' && $baseUrl !== '' && stripos($baseUrl, 'localhost') === false && stripos($baseUrl, '127.0.0.1') === false;
	mjl_readiness_control($controls, 'public_base_url', 'release', $baseUrlKnown ? 'OK' : 'UNKNOWN', $baseUrlKnown ? 'A non-local public base URL is configured.' : 'Final client public/base URL needs confirmation.');

	$mailServer = mjl_readiness_constant($db, $prefix, $entity, 'MAIN_MAIL_SMTP_SERVER');
	$mailFrom = mjl_readiness_constant($db, $prefix, $entity, 'MAIN_MAIL_EMAIL_FROM');
	$mailKnown = $mailServer !== '' && $mailFrom !== '' && stripos($mailFrom, 'domain.com') === false;
	mjl_readiness_control($controls, 'mail_transport', 'release', $mailKnown ? 'OK' : 'UNKNOWN', $mailKnown ? 'Mail transport settings are present; delivery still requires operator evidence.' : 'Final client mail transport needs confirmation.');

	$phpPosture = 'Observed local PHP: display_errors='.$mjlObservedPhpPosture['display_errors']
		.', log_errors='.$mjlObservedPhpPosture['log_errors']
		.', cookie_secure='.$mjlObservedPhpPosture['cookie_secure']
		.', cookie_httponly='.$mjlObservedPhpPosture['cookie_httponly']
		.', cookie_samesite='.($mjlObservedPhpPosture['cookie_samesite'] !== '' ? $mjlObservedPhpPosture['cookie_samesite'] : 'unset')
		.'; final operator posture needs confirmation.';
	$storagePosture = 'Observed local storage: documents_directory='.(is_dir(DOL_DATA_ROOT) ? 'present' : 'absent')
		.', documents_writable_by_diagnostic_process='.(is_writable(DOL_DATA_ROOT) ? 'yes' : 'no')
		.', configuration_readable='.(is_readable(DOL_DOCUMENT_ROOT.'/conf/conf.php') ? 'yes' : 'no')
		.'; final persistent storage and custody need client confirmation.';
	foreach (array(
		'session_error_logging' => $phpPosture,
		'secret_custody' => 'Final client secret custody and rotation process needs confirmation.',
		'persistent_storage' => $storagePosture,
		'backup_restore_evidence' => 'Production backup and restore evidence is not inferred from this diagnostic.',
		'signed_accessibility' => 'The signed human accessibility review remains outstanding.',
	) as $name => $detail) mjl_readiness_control($controls, $name, 'release', 'UNKNOWN', $detail);

	$blocked = false;
	foreach ($controls as $control) if ($control['class'] === 'integration' && $control['status'] !== 'OK') $blocked = true;
	$result = array('schema_version' => 1, 'environment' => $environment, 'diagnostic_status' => $blocked ? 'BLOCKED' : 'OK', 'controls' => $controls);
	while (ob_get_level() > 0) ob_end_clean();
	$mjlReadinessFinished = true;
	print json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).PHP_EOL;
	exit($blocked ? 1 : 0);
} catch (Throwable $exception) {
	while (ob_get_level() > 0) ob_end_clean();
	$mjlReadinessFinished = true;
	print json_encode(array('schema_version' => 1, 'environment' => $environment, 'diagnostic_status' => 'BLOCKED', 'controls' => array(array('name' => 'diagnostic_execution', 'class' => 'integration', 'status' => 'BLOCKED', 'detail' => 'The read-only diagnostic could not complete.'))), JSON_UNESCAPED_SLASHES).PHP_EOL;
	exit(1);
}
