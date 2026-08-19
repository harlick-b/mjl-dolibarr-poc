const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

test('RST-010A custom document endpoints are dependency-free denial responses', () => {
  for (const relativePath of [
    'custom/mjlfinancement/documents.php',
    'custom/mjlfinancement/documentdownload.php',
  ]) {
    const source = read(relativePath);
    assert.match(source, /http_response_code\(403\)/, relativePath);
    assert.match(source, /Content-Type:\s*text\/plain;\s*charset=UTF-8/, relativePath);
    assert.match(source, /Cache-Control:\s*no-store/, relativePath);
    assert.match(source, /X-Content-Type-Options:\s*nosniff/, relativePath);
    assert.doesNotMatch(source, /main\.inc\.php|accessforbidden|\$_(?:GET|POST|REQUEST)|\$db\b|DOL_DATA_ROOT|fopen|readfile|file_get_contents|Content-Disposition/i, relativePath);
  }
});

test('RST-010A Apache containment denies every retained native document delivery seam', () => {
  const guard = read('custom/mjlfinancement/deployment/apache-native-guard.conf');
  const denialPage = read('custom/mjlfinancement/nativeforbidden.php');
  assert.match(guard, /\^\/\(document\|viewimage\)\\\.php/);
  assert.match(guard, /\|ecm\|/);
  assert.match(guard, /Require all denied/);
  assert.match(denialPage, /http_response_code\(403\)/);
  assert.match(denialPage, /Content-Type:\s*text\/plain;\s*charset=UTF-8/);
  assert.doesNotMatch(denialPage, /main\.inc\.php|llxHeader|llxFooter|\$_SESSION|\$db\b/i);
});

test('RST-010A retains no live document behavior or stale live-document evidence script', () => {
  for (const removed of [
    'custom/mjlfinancement/lib/mjl_document.lib.php',
    'custom/mjlfinancement/lib/mjl_document_audit.lib.php',
    'tests/evidence/inter-font-live.js',
  ]) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, removed)), false, removed);
  }

  const module = read('custom/mjlfinancement/core/modules/modMjlFinancement.class.php');
  assert.doesNotMatch(module, /documents\.php|documentdownload\.php/);
});

test('RST-010A has a dedicated disposable runner and immutable snapshot fixture', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.scripts['test:rst010a'], 'node tests/runner/run-suite.js rst010a');

  const runnerPlan = read('tests/runner/disposable-run.js');
  const runner = read('tests/runner/run-suite.js');
  const config = read('playwright.config.js');
  const fixture = read('tests/fixtures/rst010a-document-state.php');

  assert.match(runnerPlan, /rst010a:\s*\['rst010a'\]/);
  assert.match(runnerPlan, /'phase1-reset':\s*\[[^\]]*'rst010a'/s);
  assert.match(runner, /document-containment\.spec\.js/);
  assert.match(config, /document-containment\.spec\.js/);
  assert.match(fixture, /llx_ecm_files/);
  assert.match(fixture, /llx_ecm_directories/);
  assert.match(fixture, /hash_file\('sha256'/);
  assert.match(fixture, /DOL_DATA_ROOT|\/var\/www\/documents/);
});
