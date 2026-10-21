<?php
require __DIR__.'/../../custom/mjlfinancement/lib/api/mjl_api_http.lib.php';
function checkReferenceRequest($path, $query, $expectedStatus = 200) {
 $_SERVER = array('REQUEST_METHOD' => 'GET', 'PATH_INFO' => '/v1'.$path, 'QUERY_STRING' => $query);
 $_POST = $_FILES = array();
 $status = 200;
 try { mjl_api_request(); } catch (MjlApiError $error) { $status = $error->status; }
 if ($status !== $expectedStatus) throw new RuntimeException('Unexpected request status for '.$path.'?'.$query.': '.$status);
}
checkReferenceRequest('/projects', 'page=2&partner_id=123');
checkReferenceRequest('/projects/123', '');
checkReferenceRequest('/operation-types', 'page=2');
checkReferenceRequest('/operation-types/123', '');
checkReferenceRequest('/operation-types', 'partner_id=1', 400);
checkReferenceRequest('/projects', 'partner_id=1&partner_id=2', 400);
checkReferenceRequest('/projects', 'partner_id=0', 400);
checkReferenceRequest('/projects/123', 'partner_id=1', 400);
checkReferenceRequest('/partners', 'partner_id=1', 400);
checkReferenceRequest('/projects', 'entity=2', 400);
print "Reference REST request boundary passed\n";
