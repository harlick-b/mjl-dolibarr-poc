<?php

if (PHP_SAPI !== 'cli' || !function_exists('posix_geteuid') || posix_geteuid() !== 0) {
	fwrite(STDERR, "RST-005 one-off bootstrap failed closed.\n");
	exit(1);
}

$allowed = array(
	'/opt/mjl-tests/fixtures/database-evidence.php',
	'/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php',
	'/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php',
	'/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_foundation.php',
);

$script = isset($argv[1]) ? (string) $argv[1] : '';
if (count($argv) < 2 || !in_array($script, $allowed, true)) {
	fwrite(STDERR, "RST-005 one-off bootstrap failed closed.\n");
	exit(1);
}

$environment = array(
	'dolibarr_main_url_root' => 'DOLI_URL_ROOT',
	'dolibarr_main_db_host' => 'DOLI_DB_HOST',
	'dolibarr_main_db_name' => 'DOLI_DB_NAME',
	'dolibarr_main_db_user' => 'DOLI_DB_USER',
	'dolibarr_main_db_pass' => 'DOLI_DB_PASSWORD',
);
$values = array();
foreach ($environment as $variable => $name) {
	$value = getenv($name);
	if ($value === false || $value === '') {
		fwrite(STDERR, "RST-005 one-off bootstrap failed closed.\n");
		exit(1);
	}
	$values[$variable] = $value;
}

$configuration = "<?php\n";
foreach ($values as $variable => $value) $configuration .= '$'.$variable.'='.var_export($value, true).";\n";
$configuration .= <<<'PHP'
$dolibarr_main_document_root='/var/www/html';
$dolibarr_main_url_root_alt='/custom';
$dolibarr_main_document_root_alt='/var/www/html/custom';
$dolibarr_main_data_root='/tmp/rst005-oneoff-data';
$dolibarr_main_db_port='3306';
$dolibarr_main_db_prefix='llx_';
$dolibarr_main_db_type='mysqli';
$dolibarr_main_authentication='dolibarr';
$dolibarr_main_prod=1;
$dolibarr_main_instance_unique_id='rst005-oneoff';
$dolibarr_main_db_character_set='utf8mb4';
$dolibarr_main_db_collation='utf8mb4_unicode_ci';
PHP;
$configuration .= "\n";

$configurationPath = '/var/www/html/conf/conf.php';
umask(0077);
if (!is_dir('/tmp/rst005-oneoff-data') && !mkdir('/tmp/rst005-oneoff-data', 0700, true)) {
	fwrite(STDERR, "RST-005 one-off bootstrap failed closed.\n");
	exit(1);
}
if (!is_dir(dirname($configurationPath)) && !mkdir(dirname($configurationPath), 0700, true)) {
	fwrite(STDERR, "RST-005 one-off bootstrap failed closed.\n");
	exit(1);
}
if (file_put_contents($configurationPath, $configuration, LOCK_EX) === false || !chmod($configurationPath, 0600)) {
	fwrite(STDERR, "RST-005 one-off bootstrap failed closed.\n");
	exit(1);
}
register_shutdown_function(static function () use ($configurationPath) {
	@unlink($configurationPath);
});

$hold = getenv('MJL_RST005_MUTATION_HOLD_SECONDS');
if ($hold !== false) {
	if (!preg_match('/^(?:[1-9]|[12][0-9]|30)$/', (string) $hold)) {
		fwrite(STDERR, "RST-005 one-off bootstrap failed closed.\n");
		exit(1);
	}
	sleep((int) $hold);
}

array_shift($argv);
$argc = count($argv);
require $script;
