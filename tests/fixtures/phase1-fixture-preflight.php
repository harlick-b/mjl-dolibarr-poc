<?php

declare(strict_types=1);

function mjl_fixture_preflight_fail(): never
{
    file_put_contents('php://stderr', "Disposable fixture preflight failed.\n");
    exit(2);
}

if (PHP_SAPI !== 'cli'
    || !function_exists('posix_geteuid')
    || posix_geteuid() !== 33
    || getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1'
    || !preg_match('/^mjl-test-[a-z0-9-]+$/', (string) getenv('MJL_DISPOSABLE_PROJECT_NAME'))
) {
    mjl_fixture_preflight_fail();
}

$mjlFixtureSentinel = (string) getenv('MJL_DISPOSABLE_RUN_SENTINEL');
if (!preg_match('/^[a-f0-9]{32}$/', $mjlFixtureSentinel)) {
    mjl_fixture_preflight_fail();
}

$mjlFixtureSentinelPath = '/var/www/documents/.mjl-disposable-fixture-sentinel';
$mjlFixtureStat = @lstat($mjlFixtureSentinelPath);
if ($mjlFixtureStat === false
    || is_link($mjlFixtureSentinelPath)
    || !is_file($mjlFixtureSentinelPath)
    || (int) $mjlFixtureStat['uid'] !== 0
    || (((int) $mjlFixtureStat['mode']) & 0777) !== 0444
    || !hash_equals($mjlFixtureSentinel, trim((string) @file_get_contents($mjlFixtureSentinelPath)))
) {
    mjl_fixture_preflight_fail();
}

return $mjlFixtureSentinel;
