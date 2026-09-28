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
