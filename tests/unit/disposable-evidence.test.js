const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { artifactSecretVariants, scanArtifacts, streamTreeDigest } = require('../runner/disposable-evidence');

test('builds raw, URL, base64, and base64url secret variants', () => {
  const variants = artifactSecretVariants(['s3cr/et+']);
  assert.ok(variants.includes('s3cr/et+'));
  assert.ok(variants.includes(encodeURIComponent('s3cr/et+')));
  assert.ok(variants.includes(Buffer.from('s3cr/et+').toString('base64')));
  assert.ok(variants.includes(Buffer.from('s3cr/et+').toString('base64url')));
});

test('deletes a contaminated artifact and reports only path/category', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-evidence-test-'));
  try {
    const file = path.join(root, 'failure.log');
    fs.writeFileSync(file, 'token=my-secret-value', { mode: 0o600 });
    const result = scanArtifacts(root, [{ category: 'test credential', value: 'my-secret-value' }]);
    assert.deepEqual(result, [{ path: 'failure.log', category: 'test credential' }]);
    assert.equal(fs.existsSync(file), false);
    assert.doesNotMatch(JSON.stringify(result), /my-secret-value/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('streams deterministic path/type/mode/content evidence without a plaintext manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-tree-test-'));
  try {
    fs.writeFileSync(path.join(root, 'a.txt'), 'alpha', { mode: 0o600 });
    fs.mkdirSync(path.join(root, 'nested'));
    fs.writeFileSync(path.join(root, 'nested', 'b.txt'), 'beta', { mode: 0o644 });
    const first = streamTreeDigest(root);
    const second = streamTreeDigest(root);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(first, second);
    fs.writeFileSync(path.join(root, 'nested', 'b.txt'), 'changed');
    assert.notEqual(streamTreeDigest(root), first);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('database evidence includes every authorized schema-object kind and exact shared baseline fields', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../fixtures/database-evidence.php'), 'utf8');
  for (const object of ['VIEWS', 'TRIGGERS', 'ROUTINES', 'PARAMETERS', 'EVENTS']) {
    assert.match(source, new RegExp(`information_schema\\.${object}`));
  }
  assert.match(source, /SELECT rowid,entity,login,admin,statut FROM llx_user WHERE admin=1/);
  assert.match(source, /SHOW CREATE DATABASE/);
  assert.match(source, /'BASE TABLE','SEQUENCE'/);
  assert.match(source, /SHOW CREATE ' \./);
  assert.match(source, /restorable_database_sha256/);
  assert.match(source, /evidence_restorable_schema_value/);
  assert.match(source, /EVENT_OBJECT_SCHEMA/);
  assert.match(source, /VIEW_DEFINITION/);
  assert.match(source, /unset\(\$restorableCreated\['Created'\]\)/);
  assert.match(source, /json_encode\(array_values\(\$created\)/);
  assert.match(source, /Restore evidence is restricted to an attested disposable tenant/);
  assert.match(source, /rst005_\(\?:schema\|full\)_restore_/);
  assert.match(source, /'root-type'.*'directory'/s);
  assert.match(source, /'root-mode'/);
  assert.match(source, /'audit_events'/);
  assert.doesNotMatch(source, /file_put_contents\([^)]*(?:\/tmp|manifest\.)/i);
});
