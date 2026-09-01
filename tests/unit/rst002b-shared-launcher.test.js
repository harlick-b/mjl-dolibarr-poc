const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { atomicRecord } = require('../../custom/mjlfinancement/scripts/rst002b_shared_operation.lib');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('RST-002B launcher is dedicated, exact-mode, root-custodied, and fail closed', () => {
  const packet = read('custom/mjlfinancement/scripts/rst002b_shared_packet.js');
  const launcher = read('custom/mjlfinancement/scripts/rst002b_shared_launcher.js');
  const operation = read('custom/mjlfinancement/scripts/rst002b_shared_operation.lib.js');
  for (const source of [packet, launcher, operation]) assert.match(source, /RST-002B/);
  assert.match(launcher, /--mode=\(execute\|recover\|rollback\)/);
  assert.match(launcher, /O_NOFOLLOW/);
  assert.match(launcher, /stat\.uid === 0/);
  assert.match(launcher, /Repository binding changed/);
  assert.match(operation, /mariadb-dump/);
  assert.match(operation, /verifyEncryptedBackups/);
  assert.match(operation, /rst002b_activity_assignment\.php/);
  assert.match(operation, /running\.join\(','\) === 'mariadb'/);
});

test('RST-002B durable evidence is exclusive, fsync-backed, and hash addressed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rst002b-record-'));
  try {
    const digest = atomicRecord(directory, 'record.json', { unit: 'RST-002B', sequence: 0 });
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(fs.statSync(path.join(directory, 'record.json')).mode & 0o777, 0o600);
    assert.throws(() => atomicRecord(directory, 'record.json', { replacement: true }));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
