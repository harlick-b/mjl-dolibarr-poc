<?php

if (PHP_SAPI !== 'cli') { http_response_code(403); exit(1); }
require_once __DIR__.'/cli_guard.php';

function mjl_rst006b_hash_field($hash, $type, $value)
{
	$value=(string)$value;hash_update($hash,$type.':'.strlen($value).':'.$value."\n");
}

function mjl_rst006b_documents_sha256($root)
{
	$stat=@lstat($root);if($stat===false||is_link($root)||!is_dir($root))throw new RuntimeException('Invalid document root.');
	$sentinel=$root.'/.mjl-disposable-fixture-sentinel';$excludeSentinel=false;
	if(file_exists($sentinel)){
		$value=(string)getenv('MJL_DISPOSABLE_RUN_SENTINEL');$project=(string)getenv('MJL_DISPOSABLE_PROJECT_NAME');$sentinelStat=@lstat($sentinel);
		$excludeSentinel=getenv('MJL_DISPOSABLE_TEST_TENANT')==='1'&&preg_match('/^(?:mjl-test|mjl-rst006a-wrapper|mjl-rst012-wrapper)-[a-z0-9-]+$/',$project)===1&&preg_match('/^[a-f0-9]{32}$/',$value)===1&&$sentinelStat!==false&&!is_link($sentinel)&&is_file($sentinel)&&hash_equals($value,(string)@file_get_contents($sentinel));
		if(!$excludeSentinel)throw new RuntimeException('Disposable fixture sentinel is forbidden in the shared tenant document root.');
	}
	$hash=hash_init('sha256');mjl_rst006b_hash_field($hash,'root-mode',((int)$stat['mode'])&07777);
	$walk=function($directory,$relative='')use(&$walk,$hash,$excludeSentinel){$entries=scandir($directory);if($entries===false)throw new RuntimeException('Unable to enumerate document evidence.');sort($entries,SORT_STRING);foreach($entries as$name){if($name==='.'||$name==='..'||($relative===''&&in_array($name,array('initdb.log','install.lock'),true))||($relative===''&&$excludeSentinel&&$name==='.mjl-disposable-fixture-sentinel'))continue;$absolute=$directory.'/'.$name;$path=$relative===''?$name:$relative.'/'.$name;$mode=fileperms($absolute);if($mode===false)throw new RuntimeException('Unable to stat document evidence.');if(is_link($absolute)){mjl_rst006b_hash_field($hash,'link-path',$path);mjl_rst006b_hash_field($hash,'link-mode',$mode&07777);mjl_rst006b_hash_field($hash,'link-target',(string)readlink($absolute));}elseif(is_dir($absolute)){mjl_rst006b_hash_field($hash,'dir-path',$path);mjl_rst006b_hash_field($hash,'dir-mode',$mode&07777);$walk($absolute,$path);}elseif(is_file($absolute)){mjl_rst006b_hash_field($hash,'file-path',$path);mjl_rst006b_hash_field($hash,'file-mode',$mode&07777);mjl_rst006b_hash_field($hash,'file-size',filesize($absolute));mjl_rst006b_hash_field($hash,'file-sha256',hash_file('sha256',$absolute));}else throw new RuntimeException('Unsupported document entry.');}};
	$walk($root);return hash_final($hash);
}

try { print mjl_rst006b_documents_sha256('/var/www/documents').PHP_EOL; }
catch(Throwable$exception){fwrite(STDERR,'RST-006B document evidence failed: '.$exception->getMessage().PHP_EOL);exit(1);}
