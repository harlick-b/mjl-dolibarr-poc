#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const {
  buildSharedAuthorization,
  canonicalJson,
  parseLauncherMode,
  readProtectedPath,
  validateApprovalRecord,
  validateStoppedServices,
  validateTrafficRecord,
  sanitizedRuntimeEnvironment,
  verifyComposeTarget,
  verifyDockerRuntimeBinding,
  verifyInheritedTargetLock,
  verifyMutationLeaseAvailable,
  verifyRepositoryBinding,
} = require('./rst005_shared_launcher.lib');
const {
  cleanupIsolatedRestoreResources,
  isolatedRestoreNames,
  runRst005Operation,
  runRst005Recover,
  runRst005Rollback,
} = require('./rst005_shared_operation.lib');

let failureStage = 10;
let isolatedDiagnostics = false;
const signalController = new AbortController();
let receivedSignal = null;
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {
  if (receivedSignal === null) receivedSignal = signal;
  signalController.abort(new Error(`RST-005 launcher interrupted by ${signal}.`));
});

function failClosed(error) {
  process.stderr.write('RST-005 shared launcher failed closed.\n');
  if (isolatedDiagnostics && error instanceof Error) process.stderr.write(`RST-005 isolated diagnostic: ${error.message}\n`);
  process.exitCode = receivedSignal ? 128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[receivedSignal]) : failureStage;
}

function parseCanonicalRecord(bytes, label) {
  const text = bytes.toString('utf8');
  const record = JSON.parse(text);
  if (text !== `${canonicalJson(record)}\n`) throw new Error(`${label} record is not canonical.`);
  return record;
}

const PROTECTED_INPUTS = Object.freeze({
  approval: '/run/mjl-rst005/approval/record',
  key: '/run/mjl-rst005/key/bytes',
  traffic: '/run/mjl-rst005/traffic/record',
  environment: '/run/mjl-rst005/environment/record',
});

function sameBytes(left, right) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sameProtectedFile(left, right) {
  return left.path === right.path && left.stat.dev === right.stat.dev && left.stat.ino === right.stat.ino
    && left.stat.size === right.stat.size && left.stat.mtimeMs === right.stat.mtimeMs && left.stat.ctimeMs === right.stat.ctimeMs
    && sameBytes(left.bytes, right.bytes);
}

function mountIdentity(file) {
  const escaped = (value) => value.replace(/\\040/g, ' ').replace(/\\011/g, '\t').replace(/\\012/g, '\n').replace(/\\134/g, '\\');
  const candidates = fs.readFileSync('/proc/self/mountinfo', 'utf8').trim().split('\n').map((line) => {
    const fields = line.split(' ');
    return { id: fields[0], mountpoint: escaped(fields[4]) };
  }).filter((entry) => file === entry.mountpoint || file.startsWith(`${entry.mountpoint}/`)).sort((left, right) => right.mountpoint.length - left.mountpoint.length);
  if (candidates.length === 0) throw new Error('Protected input mount identity is unavailable.');
  return candidates[0].id;
}

function composeArguments(approval, tail) {
  return ['compose', '--env-file', '/dev/null', '--project-directory', approval.repository_root,
    ...approval.compose_files.flatMap((entry) => ['-f', entry.path]), '-p', approval.compose_project_name, ...tail];
}

async function main() {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) throw new Error('Root operator required.');
  isolatedDiagnostics = process.env.MJL_RST005_ISOLATED_DIAGNOSTICS === '1' && process.cwd().startsWith('/tmp/rst005-launcher');
  const mode = parseLauncherMode(process.argv.slice(2));
  let runtimeEnvironment = sanitizedRuntimeEnvironment(process.env, 'shared');
  failureStage = 11;
  let approvalEvidence;
  let keyEvidence;
  let trafficEvidence;
  let environmentEvidence;
  try {
    signalController.signal.throwIfAborted();
    approvalEvidence = readProtectedPath(PROTECTED_INPUTS.approval, 'approval', { requiredUid: 0, maximumBytes: 65536 });
    keyEvidence = readProtectedPath(PROTECTED_INPUTS.key, 'encryption key', { requiredUid: 0, maximumBytes: 32 });
    trafficEvidence = readProtectedPath(PROTECTED_INPUTS.traffic, 'traffic stop', { requiredUid: 0, maximumBytes: 16384 });
    environmentEvidence = readProtectedPath(PROTECTED_INPUTS.environment, 'Compose environment', { requiredUid: 0, maximumBytes: 16384, allowEmpty: true });
    if (keyEvidence.bytes.length !== 32) throw new Error('Encryption key must contain exactly 32 bytes.');
    const identities = [approvalEvidence, keyEvidence, trafficEvidence, environmentEvidence].map((entry) => `${entry.stat.dev}:${entry.stat.ino}`);
    if (new Set(identities).size !== identities.length || new Set([approvalEvidence.path, keyEvidence.path, trafficEvidence.path, environmentEvidence.path].map((entry) => require('node:path').dirname(entry))).size !== 4) throw new Error('Approval, key, traffic, and environment custody must be separate.');
    if (new Set([approvalEvidence.path, keyEvidence.path, trafficEvidence.path, environmentEvidence.path].map(mountIdentity)).size !== 4) throw new Error('Approval, key, traffic, and environment must use distinct mount identities.');
    failureStage = 12;
    const approval = validateApprovalRecord(parseCanonicalRecord(approvalEvidence.bytes, 'Approval'), { expectedMode: mode });
    isolatedDiagnostics = approval.target_profile !== 'shared' && process.env.MJL_RST005_ISOLATED_DIAGNOSTICS === '1';
    if (crypto.createHash('sha256').update(keyEvidence.bytes).digest('hex') !== approval.backup_key_sha256) throw new Error('Encryption key does not match the approved operation package.');
    if (crypto.createHash('sha256').update(environmentEvidence.bytes).digest('hex') !== approval.compose_environment_sha256) throw new Error('Compose environment does not match approval.');
    const approvedEnvironment = approval.target_profile === 'shared' && environmentEvidence.bytes.length === 0 ? {} : parseCanonicalRecord(environmentEvidence.bytes, 'Compose environment');
    if (approval.target_profile === 'shared' && environmentEvidence.bytes.length !== 0) throw new Error('Shared Compose environment must be exactly zero bytes.');
    if (!approvedEnvironment || Array.isArray(approvedEnvironment) || typeof approvedEnvironment !== 'object') throw new Error('Compose environment must be an object.');
    const allowedEnvironment = approval.target_profile === 'shared' ? [] : ['MJL_BASE_URL', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_EVIDENCE_ROOT', 'MJL_REPOSITORY_ROOT', 'MJL_TEST_PORT', 'MJL_TEST_USER_PASSWORD'];
    if (Object.keys(approvedEnvironment).some((name) => !allowedEnvironment.includes(name)) || Object.values(approvedEnvironment).some((value) => typeof value !== 'string' || value.length === 0 || /[\r\n\0]/.test(value))) throw new Error('Compose environment exceeds its exact allowlist.');
    runtimeEnvironment = Object.freeze({ ...sanitizedRuntimeEnvironment(process.env, approval.target_profile === 'shared' ? 'shared' : 'disposable'), ...approvedEnvironment });
    const traffic = parseCanonicalRecord(trafficEvidence.bytes, 'Traffic-stop');
    validateTrafficRecord(traffic, approval);
    verifyInheritedTargetLock(approval.target_lock_path);
    verifyMutationLeaseAvailable(approval.mutation_lock_path);
    failureStage = 13;
    const assertLiveBinding = () => {
      signalController.signal.throwIfAborted();
      const fresh = [];
      try {
        const freshApproval = readProtectedPath(PROTECTED_INPUTS.approval, 'approval', { requiredUid: 0, maximumBytes: 65536 });
        const freshKey = readProtectedPath(PROTECTED_INPUTS.key, 'encryption key', { requiredUid: 0, maximumBytes: 32 });
        const freshTraffic = readProtectedPath(PROTECTED_INPUTS.traffic, 'traffic stop', { requiredUid: 0, maximumBytes: 16384 });
        const freshEnvironment = readProtectedPath(PROTECTED_INPUTS.environment, 'Compose environment', { requiredUid: 0, maximumBytes: 16384, allowEmpty: true });
        fresh.push(freshApproval, freshKey, freshTraffic, freshEnvironment);
        if (!sameProtectedFile(freshApproval, approvalEvidence)
          || !sameProtectedFile(freshKey, keyEvidence)
          || !sameProtectedFile(freshTraffic, trafficEvidence)
          || !sameProtectedFile(freshEnvironment, environmentEvidence)) throw new Error('Protected launcher input identity changed after initial validation.');
        validateApprovalRecord(parseCanonicalRecord(freshApproval.bytes, 'Approval'), { expectedMode: mode });
        validateTrafficRecord(parseCanonicalRecord(freshTraffic.bytes, 'Traffic-stop'), approval);
        const liveRepository = verifyRepositoryBinding(approval);
        verifyDockerRuntimeBinding(approval);
        const resolvedBytes = execFileSync('/usr/bin/docker', composeArguments(approval, ['config', '--format', 'json']), {
          cwd: approval.repository_root,
          env: runtimeEnvironment,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (crypto.createHash('sha256').update(resolvedBytes).digest('hex') !== approval.compose_config_sha256) throw new Error('Resolved Compose digest does not match approval.');
        verifyComposeTarget(approval, JSON.parse(resolvedBytes.toString('utf8')));
        const running = execFileSync('/usr/bin/docker', composeArguments(approval, ['ps', '--status', 'running', '--services']), {
          cwd: approval.repository_root,
          env: runtimeEnvironment,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim().split('\n').filter(Boolean);
        validateStoppedServices(running);
        signalController.signal.throwIfAborted();
        return liveRepository;
      } finally {
        for (const evidence of fresh) evidence.bytes.fill(0);
      }
    };
    failureStage = 13;
    const repository = assertLiveBinding();
    await cleanupIsolatedRestoreResources(isolatedRestoreNames(approval.nonce), undefined, runtimeEnvironment);
    failureStage = 17;
    const operationOptions = {
      approval,
      key: keyEvidence.bytes,
      buildSharedAuthorization,
      onStage: (stage) => {
        failureStage = stage;
        const isolatedSharedTrace = approval.target_profile === 'disposable_shared_shape'
          && approval.compose_project_name.startsWith('mjl-test-rst005-shared-shape-')
          && approval.repository_root.startsWith('/tmp/rst005-launcher-execute-rollback-');
        if ((approval.target_profile === 'disposable' || isolatedSharedTrace) && process.env.MJL_RST005_STAGE_TRACE === '1') process.stdout.write(`RST005_STAGE=${stage}\n`);
      },
      assertLiveBinding,
      signal: signalController.signal,
      runtimeEnvironment,
    };
    const result = mode === 'rollback'
      ? await runRst005Rollback(operationOptions)
      : (mode === 'recover' ? await runRst005Recover(operationOptions) : await runRst005Operation(operationOptions));
    verifyRepositoryBinding(approval);
    process.stdout.write(`${JSON.stringify({ status: result.status, mode, commit: repository.commit, complete_tree_sha256: repository.completeTreeSha256 })}\n`);
  } finally {
    for (const evidence of [keyEvidence, approvalEvidence, trafficEvidence, environmentEvidence]) if (evidence && Buffer.isBuffer(evidence.bytes)) evidence.bytes.fill(0);
  }
}

main().catch((error) => failClosed(error));
