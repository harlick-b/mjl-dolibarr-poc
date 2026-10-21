<?php
require __DIR__.'/../../custom/mjlfinancement/lib/auth/mjl_auth_session.lib.php';
function checkExpiry($expected,$started,$active,$now) {
 $actual=mjl_auth_session_expiry_decision($started,$active,$now);
 if($actual!==$expected)throw new RuntimeException('Session expiry policy mismatch: '.json_encode(array($expected,$actual,$started,$active,$now)));
}
checkExpiry('valid',1000,1100,2000);
checkExpiry('valid',1000,29000,29800);
checkExpiry('valid',1000,1000,87399);
checkExpiry('session_expired',1000,1000,87400);
checkExpiry('valid',1000,87399,87399);
checkExpiry('session_expired',1000,87399,87400);
checkExpiry('session_invalidated',0,0,1000);
checkExpiry('session_invalidated',1100,1100,1000);
checkExpiry('session_invalidated',1000,999,1100);
print "Session idle/absolute expiry policy passed\n";
