const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('RST-003 reference routes remain the approved RST-009A navigation destinations', () => {
  for (const route of ['partners.php', 'projects.php', 'operationtypes.php']) {
    const source = read(`custom/mjlfinancement/${route}`);
    assert.match(source, /mjl_reference_require_read\(\$user\)/);
    assert.doesNotMatch(source, /Partenaires \/ Programmes|scope_soc_ids|mjlfinancement_user_soc_scope/);
  }
  const navigation = read('custom/mjlfinancement/lib/mjl_navigation_registry.lib.php');
	assert.match(navigation, /operationtypes\.php/);
	assert.match(navigation, /mjl_navigation_leaf\('references', 'partners', 'Partenaires'/);
});

test('RST-003 reference mutations have no hard-delete interface', () => {
  for (const relative of [
    'custom/mjlfinancement/partners.php',
    'custom/mjlfinancement/projects.php',
    'custom/mjlfinancement/operationtypes.php',
    'custom/mjlfinancement/class/mjloperationtype.class.php',
  ]) {
    const source = read(relative);
    assert.doesNotMatch(source, /function\s+delete\s*\(|action[^\n]{0,40}delete|confirm_delete/i, relative);
  }
});

test('RST-003 uses exact native status constants and immutable Project ownership', () => {
  const source = read('custom/mjlfinancement/lib/mjl_reference.lib.php');
  assert.match(source, /Project::STATUS_VALIDATED/);
  assert.match(source, /Project::STATUS_CLOSED/);
  assert.match(source, /MJL-PROJET-/);
  assert.match(source, /function mjl_reference_project_update_label\(/);
  const updateBody = source.slice(source.indexOf('function mjl_reference_project_update_label('), source.indexOf('\nfunction ', source.indexOf('function mjl_reference_project_update_label(') + 1));
  assert.doesNotMatch(updateBody, /fk_soc\s*=/);
  assert.doesNotMatch(updateBody, /ref\s*=/);
});

test('native Dolibarr mutation route families remain blocked by Apache', () => {
  const apache = read('custom/mjlfinancement/deployment/apache-native-guard.conf');
  for (const family of ['api', 'imports', 'projet', 'societe']) assert.match(apache, new RegExp(`\\b${family}\\b`));
});

test('RST-003 has a focused disposable schema and browser verification gate', () => {
  const packageJson = JSON.parse(read('package.json'));
  const runner = read('tests/runner/run-suite.js');
  assert.equal(packageJson.scripts['test:rst003'], 'node tests/runner/run-suite.js rst003');
  assert.match(runner, /reference_foundation\.php/);
  assert.match(runner, /partners-projects\.spec\.js/);
});
