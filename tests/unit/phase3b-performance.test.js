const test=require('node:test');
const assert=require('node:assert/strict');
const {getSuitePlan}=require('../runner/disposable-run');
test('performance acceptance is available through the disposable runner',()=>{
 assert.deepEqual(getSuitePlan('phase3b-performance'),['phase3b-performance']);
});
