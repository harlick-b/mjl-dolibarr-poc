const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { atomicRecord, backupVerificationApproval } = require('../../custom/mjlfinancement/scripts/rst002b_shared_operation.lib');

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
  assert.match(operation, /requireStoppedServices/);
  assert.match(launcher, /Recovery requires an existing approval-bound durable operation prefix/);
  assert.match(launcher, /Traffic-stop authority expired before mutation completion/);
  assert.match(launcher, /Shared service state changed/);
  assert.match(operation, /inspectForwardPrefix/);
  assert.match(operation, /verifyRetainedBackups/);
  assert.match(operation, /startAndHealthCheck/);
  assert.match(operation, /\/usr\/bin\/curl/);
  assert.match(operation, /suppressFailureInjection/);
  assert.match(operation, /rehearsalFailurePoints/);
  assert.match(operation, /cleanupNamedContainers/);
  assert.match(operation, /restorable_trigger_sha256/);
  assert.match(operation, /container','create','--pull=never/);
  assert.match(operation, /immutable one-off identity inspection failed/);
  assert.doesNotMatch(operation, /\['run',\s*'--rm'/);
  assert.match(packet, /--\(mode\|output-root\|prior-report\|profile\|failure-point\)/);
  assert.match(packet, /disposable-shared-shape/);
  assert.match(packet, /Failure injection requires the disposable shared-shape profile/);
  assert.match(launcher, /disposable_shared_shape/);
  assert.match(packet, /\/tmp\\\/rst002b-launcher-/);
  assert.match(launcher, /\/tmp\\\/rst002b-launcher-/);
  assert.match(packet, /\/usr\/bin\/flock/);
  assert.match(packet, /outer_argv/);
  assert.match(packet, /\/var\/run\/docker\.sock/);
  assert.match(launcher, /verifyInheritedTargetLock/);
  assert.match(launcher, /completedPrefix/);
  assert.doesNotMatch(launcher, /verifyMutationLeaseAvailable/);
  assert.match(launcher, /compose_config_sha256/);
});

test('RST-002B durable evidence is exclusive, fsync-backed, and hash addressed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rst002b-record-'));
  try {
    fs.chmodSync(directory, 0o700);
    const digest = atomicRecord(directory, 'record.json', { unit: 'RST-002B', sequence: 0 }, { requiredUid: process.getuid() });
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(fs.statSync(path.join(directory, 'record.json')).mode & 0o777, 0o400);
    assert.throws(() => atomicRecord(directory, 'record.json', { replacement: true }, { requiredUid: process.getuid() }));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('RST-002B adapts immutable image bindings to the proven restore verifier contract', () => {
  const approval = backupVerificationApproval({
    target_profile: 'disposable_shared_shape',
    images: { mariadb: `sha256:${'a'.repeat(64)}`, dolibarr: `sha256:${'b'.repeat(64)}` },
  });
  assert.equal(approval.target_profile, 'disposable_shared_shape');
  assert.equal(approval.docker_runtime.images.mariadb.id, `sha256:${'a'.repeat(64)}`);
  assert.equal(approval.docker_runtime.images.dolibarr.id, `sha256:${'b'.repeat(64)}`);
});
