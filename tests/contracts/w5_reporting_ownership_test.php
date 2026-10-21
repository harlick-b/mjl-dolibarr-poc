<?php
$root=dirname(__DIR__,2);
function w5_assert($condition,$message){if($condition)return;fwrite(STDERR,"FAIL: ".$message."\n");exit(1);}
foreach(array('index.php','alerts.php','reports.php','workflowactions.php') as $page){$source=file_get_contents($root.'/custom/mjlfinancement/'.$page);w5_assert(substr_count($source,'mjl_reporting_shell(')===1,$page.' must hand off once to the REST shell.');}
$adapter=file_get_contents($root.'/custom/mjlfinancement/lib/api/mjl_api_reporting.lib.php');
$delivery=file_get_contents($root.'/custom/mjlfinancement/lib/reporting/mjl_export_delivery.lib.php');
w5_assert(strpos($adapter,'mjl_monitoring_read_page(')!==false,'Dashboard and alerts must retain the bounded monitoring reader.');
w5_assert(strpos($adapter,'mjl_reporting_read_preview(')!==false&&strpos($adapter,'mjl_reporting_read_audit(')!==false,'Report and audit previews must retain bounded reporting readers.');
w5_assert(strpos($adapter,'new MjlExport(')!==false&&strpos($adapter,'mjl_export_deliver_checked(')!==false,'REST exports must retain generation and checked delivery delegation.');
w5_assert(strpos($delivery,'new MjlExportDelivery()')!==false,'The checked delivery helper must retain the delivery owner.');
foreach(array('lib/reporting/mjl_reporting_http.lib.php','lib/reporting/mjl_reporting_presentation.lib.php','lib/monitoring/mjl_monitoring_http.lib.php','tpl/reporting/report.php','tpl/reporting/audit.php','tpl/monitoring/home.php','tpl/monitoring/alerts.php') as $removed)w5_assert(!file_exists($root.'/custom/mjlfinancement/'.$removed),'Superseded HTML owner remains: '.$removed);
print "W5 reporting ownership contract passed.\n";
