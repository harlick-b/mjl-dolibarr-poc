<?php
ob_start();
require __DIR__.'/api_reference_request_test.php';
checkReferenceRequest('/activities', 'q=justice&validation_status=DRAFT&page=2');
checkReferenceRequest('/activities/123', '');
checkReferenceRequest('/activities/123/review', '');
checkReferenceRequest('/activities/123/timeline', 'cursor=456');
checkReferenceRequest('/assignment-agents', '');
checkReferenceRequest('/assignment-agents', 'page=2');
checkReferenceRequest('/monitoring-options', '');
checkReferenceRequest('/activities', 'entity=2', 400);
checkReferenceRequest('/activities', 'page=1&page=2', 400);
checkReferenceRequest('/activities/123', 'cursor=1', 400);
checkReferenceRequest('/activities/123/timeline', 'cursor=0', 400);
checkReferenceRequest('/activities/123/structure', '', 405);
print "Activity REST request boundary passed\n";
