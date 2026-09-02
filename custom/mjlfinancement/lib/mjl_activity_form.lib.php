<?php

if (!defined('MJL_ACTIVITY_RECOVERY_MAX_BYTES')) define('MJL_ACTIVITY_RECOVERY_MAX_BYTES', 65536);

/** Activity-specific recovery adapter. It stores typed editable text only. */
function mjl_activity_recovery_store(array $structure, $objectId, $view)
{
	global $conf,$user;
	$values=array(
		'name'=>(string)($structure['name']??''),
		'description'=>(string)($structure['description']??''),
		'date_start'=>(string)($structure['date_start']??''),
		'date_end'=>(string)($structure['date_end']??''),
		'authorized_amount'=>(string)($structure['authorized_amount']??''),
		'operations'=>array(),
	);
	foreach(array_slice((array)($structure['operations']??array()),0,50) as$op)$values['operations'][]=array('client_key'=>(string)($op['client_key']??''),'name'=>(string)($op['name']??''),'authorized_amount'=>(string)($op['authorized_amount']??''));
	$entry=array('user_id'=>(int)$user->id,'entity'=>(int)$conf->entity,'object_id'=>(int)$objectId,'view'=>$view,'values'=>$values,'expires'=>time()+600);
	if(strlen(serialize($entry))>MJL_ACTIVITY_RECOVERY_MAX_BYTES)return '';
	if(!isset($_SESSION['mjl_activity_recovery'])||!is_array($_SESSION['mjl_activity_recovery']))$_SESSION['mjl_activity_recovery']=array();
	foreach($_SESSION['mjl_activity_recovery'] as$key=>$candidate)if((int)($candidate['expires']??0)<=time())unset($_SESSION['mjl_activity_recovery'][$key]);
	$handle=bin2hex(random_bytes(16));$_SESSION['mjl_activity_recovery'][$handle]=$entry;return $handle;
}

function mjl_activity_recovery_consume($handle, $objectId, $view)
{
	global $conf,$user;
	if(!is_string($handle)||preg_match('/^[a-f0-9]{32}$/',$handle)!==1||empty($_SESSION['mjl_activity_recovery'][$handle]))return array();
	$entry=$_SESSION['mjl_activity_recovery'][$handle];
	if((int)$entry['user_id']!==(int)$user->id||(int)$entry['entity']!==(int)$conf->entity||(int)$entry['object_id']!==(int)$objectId||(string)$entry['view']!==$view||(int)$entry['expires']<=time())return array();
	unset($_SESSION['mjl_activity_recovery'][$handle]);return (array)$entry['values'];
}
