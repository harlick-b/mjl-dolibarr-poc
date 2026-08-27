const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const launcher = require('../../custom/mjlfinancement/scripts/rst005_shared_launcher.lib');
const operation = require('../../custom/mjlfinancement/scripts/rst005_shared_operation.lib');

function baseApproval(overrides = {}) {
	const root = '/tmp/rst005-launcher-execute-rollback-fixture/repository';
	const record = {
		version: 3,
		unit: 'RST-005',
		mode: 'execute',
		target_profile: 'disposable_shared_shape',
		operation_id: '1'.repeat(32),
		recovery_policy: 'containment_only_phase1',
		approved_commit: 'a'.repeat(40),
		complete_tree_sha256: 'b'.repeat(64),
		complete_tree_manifest_sha256: 'c'.repeat(64),
		backup_key_sha256: 'd'.repeat(64),
		repository_root: root,
		compose_project_name: 'mjl-test-rst005-shared-shape-fixture',
		database_name: 'dolidb',
		database_root: `${root}/data/mariadb`,
		document_root: `${root}/data/documents`,
		backup_root: '/tmp/rst005-custody/backups-one',
		evidence_root: '/tmp/rst005-custody/evidence-one',
		compose_config_sha256: 'e'.repeat(64),
		compose_environment_sha256: launcher.EMPTY_SHA256,
		compose_files: [{ path: `${root}/docker-compose.yml`, sha256: 'f'.repeat(64) }],
		docker_runtime: {
			daemon_id: 'RST005-DAEMON-01', server_version: '28.4.0',
			images: {
				dolibarr: { reference: 'dolibarr/dolibarr:23.0.2', id: `sha256:${'2'.repeat(64)}`, repo_digests: [] },
				mariadb: { reference: 'mariadb:11', id: `sha256:${'3'.repeat(64)}`, repo_digests: [] },
			},
			tools: Object.fromEntries(['compose_plugin', 'docker', 'flock', 'git', 'node', 'php'].map((name) => [name, { path: `/approved/${name}`, sha256: '4'.repeat(64), version: `${name} version` }])),
		},
		database_runtime: {
			container_id: '5'.repeat(64), client_version: 'mariadb client 11.8', server_version: '11.8.2-MariaDB',
			image_id: `sha256:${'3'.repeat(64)}`, datadir: '/var/lib/mysql/', datadir_filesystem: '1:2', server_identity_sha256: '',
		},
		issued_at: '2026-08-26T08:00:00.000Z',
		expires_at: '2026-08-26T09:00:00.000Z',
		nonce: '7'.repeat(32),
		...overrides,
	};
	const databaseIdentity = { ...record.database_runtime };
	delete databaseIdentity.server_identity_sha256;
	record.database_runtime.server_identity_sha256 = require('node:crypto').createHash('sha256').update(launcher.canonicalJson(databaseIdentity)).digest('hex');
	record.target_identity_sha256 = launcher.approvalTargetIdentitySha256(record);
	record.execution_identity_sha256 = launcher.approvalExecutionIdentitySha256(record);
	const locks = launcher.targetLockPaths(record);
	record.target_lock_path = locks.target;
	record.mutation_lock_path = locks.mutation;
	return record;
}

test('stable target identity ignores operation custody while execution identity binds it', () => {
	const first = baseApproval();
	const second = baseApproval({
		operation_id: '8'.repeat(32), backup_root: '/tmp/rst005-custody/backups-two', evidence_root: '/tmp/rst005-custody/evidence-two',
	});
	assert.equal(first.target_identity_sha256, second.target_identity_sha256);
	assert.notEqual(first.execution_identity_sha256, second.execution_identity_sha256);
	assert.equal(first.target_lock_path, second.target_lock_path);
	assert.equal(first.mutation_lock_path, second.mutation_lock_path);
});

test('v3 shared-shaped approval is exact and cannot substitute the real shared profile', () => {
	const record = baseApproval();
	assert.equal(launcher.validateApprovalRecord(record, { expectedMode: 'execute', now: new Date('2026-08-26T08:30:00.000Z') }).version, 3);
	assert.throws(() => launcher.validateApprovalRecord(baseApproval({ target_profile: 'shared' }), {
		expectedMode: 'execute', now: new Date('2026-08-26T08:30:00.000Z'),
	}), /shared target|profile|repository/i);
});

test('traffic v3 binds the exact approval and cannot predate it', () => {
	const approval = baseApproval();
	const traffic = {
		version: 3, unit: 'RST-005', operation_id: approval.operation_id,
		target_identity_sha256: approval.target_identity_sha256,
		execution_identity_sha256: approval.execution_identity_sha256,
		approval_sha256: launcher.approvalRecordSha256(approval), approval_nonce: approval.nonce,
		approved_commit: approval.approved_commit, compose_project_name: approval.compose_project_name,
		exclusive_docker_administration: true, no_direct_host_writers: true, no_direct_database_writers: true,
		database_name: approval.database_name, operator: 'fixture-operator', nonce: '9'.repeat(32),
		stopped_at: '2026-08-26T08:05:00.000Z', expires_at: '2026-08-26T08:20:00.000Z',
	};
	assert.equal(launcher.validateTrafficRecord(traffic, approval, new Date('2026-08-26T08:10:00.000Z')).version, 3);
	assert.throws(() => launcher.validateTrafficRecord({ ...traffic, stopped_at: '2026-08-26T07:59:59.000Z' }, approval, new Date('2026-08-26T08:10:00.000Z')), /predate|issued/i);
});

test('protected tree exposes an independently hashable nonsecret manifest', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-tree-v3-'));
	try {
		for (const relative of launcher.PROTECTED_TREE_ROOTS) {
			const target = path.join(root, relative);
			if (path.extname(relative) || !['custom', 'docs', 'tests'].includes(relative)) {
				fs.mkdirSync(path.dirname(target), { recursive: true });
				fs.writeFileSync(target, `${relative}\n`);
			} else fs.mkdirSync(target, { recursive: true });
		}
		const result = launcher.protectedTreeEvidence(root);
		assert.match(result.completeTreeSha256, /^[a-f0-9]{64}$/);
		assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);
		assert.equal(result.manifest.version, 3);
		assert.ok(result.manifest.entries.some((entry) => entry.path === 'AGENTS.md' && entry.type === 'file'));
	} finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('durable v3 chain binds both identities and rejects an invalid record grammar', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-chain-v3-'));
	fs.chmodSync(root, 0o700);
	const binding = { operationId: 'a'.repeat(32), targetIdentitySha256: 'b'.repeat(64), executionIdentitySha256: 'c'.repeat(64) };
	try {
		const first = operation.writeDurableRecord(root, { ...binding, sequence: 0, kind: 'manifest-before', previousSha256: null, payload: { manifest_sha256: 'd'.repeat(64) } }, { requiredUid: process.getuid() });
		operation.writeDurableRecord(root, { ...binding, sequence: 1, kind: 'unexpected-record', previousSha256: first.sha256, payload: {} }, { requiredUid: process.getuid() });
		assert.throws(() => operation.durableRecordChain(root, binding, { requiredUid: process.getuid(), validateGrammar: true }), /grammar|kind|state/i);
	} finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('durable v3 grammar rejects allowed kinds in an invalid order', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-chain-order-v3-'));
	fs.chmodSync(root, 0o700);
	const binding = { operationId: 'a'.repeat(32), targetIdentitySha256: 'b'.repeat(64), executionIdentitySha256: 'c'.repeat(64) };
	try {
		const first = operation.writeDurableRecord(root, { ...binding, sequence: 0, kind: 'manifest-before', previousSha256: null, payload: {} }, { requiredUid: process.getuid() });
		operation.writeDurableRecord(root, { ...binding, sequence: 1, kind: 'completed-report', previousSha256: first.sha256, payload: {} }, { requiredUid: process.getuid() });
		assert.throws(() => operation.durableRecordChain(root, binding, { requiredUid: process.getuid(), validateGrammar: true }), /grammar|manifest-before.*completed-report/i);
	} finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('durable v3 grammar accepts manifest-only recovery publication', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-chain-manifest-recovery-v3-'));
	fs.chmodSync(root, 0o700);
	const binding = { operationId: 'a'.repeat(32), targetIdentitySha256: 'b'.repeat(64), executionIdentitySha256: 'c'.repeat(64) };
	try {
		const first = operation.writeDurableRecord(root, { ...binding, sequence: 0, kind: 'manifest-before', previousSha256: null, payload: {} }, { requiredUid: process.getuid() });
		operation.writeDurableRecord(root, { ...binding, sequence: 1, kind: 'manifest-recovery', previousSha256: first.sha256, payload: {} }, { requiredUid: process.getuid() });
		assert.equal(operation.durableRecordChain(root, binding, { requiredUid: process.getuid(), validateGrammar: true }).at(-1).kind, 'manifest-recovery');
	} finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('inherited target-lock verification rejects an open but unlocked descriptor', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-unlocked-fd-'));
	const lock = path.join(root, 'target.lock');
	fs.writeFileSync(lock, '');
	fs.chmodSync(lock, 0o600);
	const descriptor = fs.openSync(lock, 'r+');
	try {
		assert.throws(() => launcher.verifyInheritedTargetLock(lock, { requiredUid: process.getuid() }), /active exclusive flock|contention/i);
	} finally {
		fs.closeSync(descriptor);
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('PHP classifier is read-only and shared authorization has no recover-to-rollback shortcut', () => {
	const php = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_activity_foundation.php'), 'utf8');
	const classify = php.slice(php.indexOf("if ($options['mode'] === 'classify')"), php.indexOf("} elseif ($options['mode'] === 'preflight')"));
	assert.doesNotMatch(classify, /DROP |ALTER |RENAME |CREATE /);
	assert.doesNotMatch(php, /record\['mode'\] === 'recover'.*options\['mode'\] === 'rollback'/s);
});

test('shared packet generator binds the immutable operator runtime and emits the flock boundary', () => {
	const generator = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_packet.js'), 'utf8');
	assert.match(generator, /process\.getuid\(\) === 0/);
	assert.match(generator, /crypto\.randomBytes\(32\)/);
	assert.match(generator, /'--nonblock', '--no-fork'/);
	assert.match(generator, /protected-tree-manifest\.json/);
	assert.match(generator, /immutableImagePhpIdentity\(dolibarrImageId\)/);
	assert.match(generator, /hostToolIdentity\(process\.execPath, '\/opt\/node'/);
	assert.match(generator, /\/var\/www\/documents:rw,noexec,nosuid,nodev,mode=0700/);
	assert.match(generator, /\/var\/www\/html\/custom:rw,noexec,nosuid,nodev,mode=0700/);
	assert.doesNotMatch(generator, /compose[^\n]*(?:stop|down|up)|\b(?:ALTER|CREATE TABLE|DROP TABLE|RENAME TABLE)\b/i);
	assert.doesNotMatch(generator, /process\.stdout\.write\([^\n]*(?:key|password)/i);
});

test('restore lifecycle and Compose binding are bounded and exact', () => {
	const source = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_operation.lib.js'), 'utf8');
	const launcherSource = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_launcher.lib.js'), 'utf8');
	assert.match(source, /restoreLifetimeSeconds = approval\.target_profile === 'shared' \? '900' : '30'/);
	assert.match(source, /\/var\/lib\/mysql:rw,noexec,nosuid,nodev,mode=0700/);
	assert.match(source, /cleanupIsolatedRestoreResources\(names/);
	assert.match(source, /hostMountRelation/);
	assert.match(launcherSource, /service\.networks\.default === null/);
	assert.match(launcherSource, /Disposable MariaDB tmpfs is not exact/);
});
