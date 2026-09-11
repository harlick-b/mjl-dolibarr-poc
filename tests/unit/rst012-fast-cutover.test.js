const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'custom/mjlfinancement/scripts/rst012_fast_cutover.js');

test('RST-012 exposes one guarded cutover command', () => {
  const source = fs.readFileSync(script, 'utf8');
  assert.match(source, /Guarded additive RST-012 cutover/);
  assert.match(source, /Use --confirm=RST-012-FAST or --help/);
  assert.match(source, /'--conflict-exit-code', '75'/);
});

test('RST-012 cutover orders the required safety gates', () => {
  const source = fs.readFileSync(script, 'utf8');
  for (const contract of [
    /\['status', '--porcelain'\]/,
    /rst012-before-/,
    /fs\.fsyncSync\(descriptor\)/,
    /guardedPhp\('verify-predecessor'\)/,
    /guardedPhp\('verify-empty'\)/,
    /guardedPhp\('apply'\)/,
    /Post-restart target verification/,
    /contender\.status === 1/,
    /Dolibarr remains stopped because the exact predecessor could not be verified/,
  ]) assert.match(source, contract);
  const stop = source.indexOf("dc(['stop', 'dolibarr']");
  const backup = source.indexOf('mariadb-dump', stop);
  const apply = source.indexOf("guardedPhp('apply')", backup);
  const restart = source.indexOf("dc(['start', 'dolibarr']", apply);
  assert.ok(stop > 0 && backup > stop && apply > backup && restart > apply);
});

test('RST-012 command and disposable rehearsal are wired', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['cutover:rst012-fast'], 'node custom/mjlfinancement/scripts/rst012_fast_cutover.js');
  assert.equal(pkg.scripts['test:rst012-wrapper'], 'node tests/runner/rst012-fast-cutover-rehearsal.js');
  const rehearsal = fs.readFileSync(path.join(root, 'tests/runner/rst012-fast-cutover-rehearsal.js'), 'utf8');
  for (const point of ['forward-001', 'forward-002', 'forward-003', 'forward-004']) assert.match(rehearsal, new RegExp(`'${point}'`));
  for (const proof of ['clean install', 'repeated activation', 'guarded migration', 'malformed-state refusal', 'post-restart failure containment', 'empty rollback', 'evidence-preserving containment']) assert.match(rehearsal, new RegExp(proof, 'i'));
  assert.match(rehearsal, /MJL_RST012_REHEARSAL_FAIL_AFTER_SETUP/);
});
