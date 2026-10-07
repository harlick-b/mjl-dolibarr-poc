const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../custom/mjlfinancement/class/mjlaccesscommand.class.php'),
  'utf8',
);

test('profile assignment and deactivation roll back when access audit persistence fails', () => {
  for (const event of ['access_profile_assigned', 'access_deactivated']) {
    const eventOffset = source.indexOf(`audit('${event}'`);
    assert.ok(eventOffset >= 0, `${event} audit call missing`);
    const nearby = source.slice(Math.max(0, eventOffset - 180), eventOffset + 360);
    assert.match(nearby, /audit\([\s\S]*<\s*1/);
    assert.match(nearby, /return array\(-1,/);
  }
  for (const method of ['assignProfile', 'deactivate']) {
    const functionOffset = source.indexOf(`public function ${method}(`);
    const nextFunctionOffset = source.indexOf('\n\tpublic function ', functionOffset + 1);
    const methodSource = source.slice(functionOffset, nextFunctionOffset < 0 ? source.length : nextFunctionOffset);
    assert.match(methodSource, /\$result\[0\] < 0[\s\S]*rollback/);
  }
});

test('invitation profile participant never controls the caller transaction', () => {
  const functionOffset = source.indexOf('public function assignProfileInTransaction');
  const nextFunctionOffset = source.indexOf('\n\tpublic function ', functionOffset + 1);
  const participantSource = source.slice(functionOffset, nextFunctionOffset < 0 ? source.length : nextFunctionOffset);
  assert.doesNotMatch(participantSource, /->(?:begin|commit|rollback)\s*\(/);
});
