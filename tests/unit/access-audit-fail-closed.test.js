const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../custom/mjlfinancement/lib/mjl_scope.lib.php'),
  'utf8',
);

test('profile assignment and deactivation roll back when access audit persistence fails', () => {
  for (const event of ['access_profile_assigned', 'access_deactivated']) {
    const eventOffset = source.indexOf(`mjl_auth_record_event('${event}'`);
    assert.ok(eventOffset >= 0, `${event} audit call missing`);
    const nearby = source.slice(Math.max(0, eventOffset - 180), eventOffset + 300);
    assert.match(nearby, /mjl_auth_record_event\([\s\S]*<\s*1/);
    assert.match(nearby, /rollback/);
  }
});

test('low-level role assignment fails closed when its transaction commit fails', () => {
  const functionOffset = source.indexOf('function mjl_scope_assign_active_role');
  const nextFunctionOffset = source.indexOf('\nfunction ', functionOffset + 1);
  const assignmentSource = source.slice(functionOffset, nextFunctionOffset);
  assert.match(assignmentSource, /if \(!\$db->commit\(\)\) \{[\s\S]*?return -1;/);
});
