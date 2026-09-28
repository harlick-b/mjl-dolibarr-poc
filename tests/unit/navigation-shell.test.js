const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const registry = path.resolve(__dirname, '../../custom/mjlfinancement/lib/mjl_navigation_registry.lib.php');
function shell(policies) {
  const encoded = Buffer.from(JSON.stringify(policies)).toString('base64');
  const source = `require '${registry}'; $policies=json_decode(base64_decode('${encoded}'), true); echo json_encode(mjl_navigation_shell_projection(mjl_navigation_project_registry($policies)));`;
  return JSON.parse(execFileSync('php', ['-r', source], { encoding: 'utf8' }));
}

test('business navigation has six primary destinations and reachable authorized secondary pages', () => {
  const groups = shell({ workspace_enter: true, references_read: true, planning_read: true, monitoring_read: true, audit_read: true });
  assert.deepEqual(groups.map((group) => group.id), ['home', 'activities', 'partners', 'projects', 'audit']);
  assert.deepEqual(groups.flatMap((group) => group.secondary.map((item) => item.id)), ['alerts', 'reports', 'operations', 'requests', 'operation_types', 'audit_report']);
  assert.equal(groups.find((group) => group.id === 'home').label, 'Tableau de bord');
  assert.equal(groups.find((group) => group.id === 'audit').label, 'Historique');
});

test('admin navigation keeps technical administration and audit without business links', () => {
  const groups = shell({ workspace_enter: true, audit_read: true, admin: true });
  assert.deepEqual(groups.map((group) => group.id), ['home', 'access', 'audit']);
  assert.deepEqual(groups.flatMap((group) => group.secondary.map((item) => item.id)), ['technical', 'audit_report']);
});


test('each current role receives only its authorized primary destinations', () => {
  const common = { workspace_enter: true, references_read: true, planning_read: true, monitoring_read: true };
  const expectedBusiness = ['home', 'activities', 'partners', 'projects'];
  assert.deepEqual(shell(common).map((group) => group.id), expectedBusiness);
  assert.deepEqual(shell({ ...common, audit_read: true }).map((group) => group.id), [...expectedBusiness, 'audit']);
  assert.deepEqual(shell({ workspace_enter: true, audit_read: true, admin: true }).map((group) => group.id), ['home', 'access', 'audit']);
  assert.deepEqual(shell({ workspace_enter: true, references_read: true, planning_read: true }).flatMap((group) => group.secondary.map((item) => item.id)), ['operations', 'operation_types']);
});
