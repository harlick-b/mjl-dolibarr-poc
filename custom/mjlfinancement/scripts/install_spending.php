<?php
require_once __DIR__.'/cli_guard.php';
define('NOLOGIN',1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/rst006b_schema.lib.php';
$lock='mjl:spending:'.substr(hash('sha256',mjl_rst005_scalar($db,'SELECT DATABASE()').':'.$db->prefix()),0,40);
try {
 if((string)mjl_rst005_scalar($db,"SELECT GET_LOCK('".$db->escape($lock)."',5)")!=='1')throw new RuntimeException('Spending migration is already running.');
 mjl_spending_install($db);
 print "MJL spending schema: OK\n";
} catch(Throwable $exception) {fwrite(STDERR,$exception->getMessage()."\n");exit(1);}
finally {$db->query("SELECT RELEASE_LOCK('".$db->escape($lock)."')");}
