<?php
ob_start();
require __DIR__.'/api_reference_request_test.php';
checkReferenceRequest('/operations', 'activity_id=12&type_id=3&operation_status=TODO');
checkReferenceRequest('/operations/12', '');
checkReferenceRequest('/operations/12/expenses', 'page=2');
checkReferenceRequest('/spending-operations', 'page=1');
checkReferenceRequest('/exception-requests', 'type=CANCELLATION&status=PENDING&request_id=12&activity_id=3');
checkReferenceRequest('/operations/12', 'entity=2', 400);
checkReferenceRequest('/operations/12/expenses', 'page=0', 400);
checkReferenceRequest('/operations/12/execution', '', 405);
checkReferenceRequest('/operations/12/expenses/13', '', 405);
checkReferenceRequest('/cancellation-requests/12/decisions', '', 405);
print "Execution REST request boundary passed\n";
