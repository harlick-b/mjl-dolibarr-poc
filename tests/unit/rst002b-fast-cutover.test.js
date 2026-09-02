const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst002b_fast_cutover.js');
const environment = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8' };

test('RST-002B fast cutover explains its small local-empty-tenant interface', () => {
  const result = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8', env: environment });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /stop.*backup.*apply.*verify.*restart/is);
  assert.doesNotMatch(result.stdout, /approval packet|protected-tree digest|encrypted restore/i);
});

test('RST-002B fast cutover rejects anything except its exact confirmation before Docker', () => {
  const result = spawnSync(process.execPath, [script, '--confirm=wrong'], { encoding: 'utf8', env: environment });
  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, 'Use --confirm=RST-002B-FAST or --help.\n');
});
