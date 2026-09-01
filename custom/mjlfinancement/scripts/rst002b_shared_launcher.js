#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { runRst002bOperation, runRst002bRecover, runRst002bRollback, canonicalJson } = require('./rst002b_shared_operation.lib');

function invariant(value, message) { if (!value) throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function protectedTreeSha256(root) {
  const roots = ['custom','docs','tests','AGENTS.md','CONTEXT.md','DESIGN.md','README.md','docker-compose.yml','package.json','package-lock.json','playwright.config.js'];
  const entries = [];
  const visit = (relative) => {
    const absolute = require('node:path').join(root, relative); const stat = fs.lstatSync(absolute);
    invariant(!stat.isSymbolicLink(), 'Protected source link refused.');
    if (stat.isDirectory()) {
      entries.push({ path: relative, type: 'directory', mode: stat.mode & 0o7777 });
      for (const name of fs.readdirSync(absolute).sort()) visit(require('node:path').join(relative, name));
    } else { invariant(stat.isFile(), 'Protected source type refused.'); entries.push({ path: relative, type: 'file', mode: stat.mode & 0o7777, sha256: sha256(fs.readFileSync(absolute)) }); }
  };
  for (const relative of roots) visit(relative);
  return sha256(Buffer.from(`${canonicalJson(entries)}\n`));
}
function readProtected(file, maximum) {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { const stat = fs.fstatSync(descriptor); invariant(stat.isFile() && stat.uid === 0 && stat.nlink === 1 && (stat.mode & 0o7777) === 0o400 && stat.size <= maximum, 'Protected input custody is invalid.'); return fs.readFileSync(descriptor); } finally { fs.closeSync(descriptor); }
}
function parseMode() {
  invariant(process.argv.length === 3 && /^--mode=(execute|recover|rollback)$/.test(process.argv[2]), 'Use one exact launcher mode.');
  return process.argv[2].slice(7);
}
function validateApproval(value, mode) {
  invariant(value.version === 1 && value.unit === 'RST-002B' && value.mode === (mode === 'recover' ? 'execute' : mode), 'Approval mode or unit is invalid.');
  invariant(/^[a-f0-9]{40}$/.test(value.approved_commit) && /^[a-f0-9]{64}$/.test(value.complete_tree_sha256) && /^[a-f0-9]{64}$/.test(value.backup_key_sha256), 'Approval digests are invalid.');
  invariant(Date.parse(value.expires_at) > Date.now(), 'Approval expired.');
  return value;
}
async function main() {
  invariant(typeof process.getuid === 'function' && process.getuid() === 0, 'Root operator required.');
  const mode = parseMode();
  const approvalBytes = readProtected('/run/mjl-rst002b/approval/record', 65536);
  const key = readProtected('/run/mjl-rst002b/key/bytes', 32);
  const trafficBytes = readProtected('/run/mjl-rst002b/traffic/record', 16384);
  invariant(key.length === 32, 'Backup key length is invalid.');
  const approval = validateApproval(JSON.parse(approvalBytes.toString('utf8')), mode);
  invariant(`${canonicalJson(approval)}\n` === approvalBytes.toString('utf8'), 'Approval is not canonical.');
  invariant(crypto.createHash('sha256').update(key).digest('hex') === approval.backup_key_sha256, 'Backup key mismatch.');
  const traffic = JSON.parse(trafficBytes.toString('utf8'));
  invariant(`${canonicalJson(traffic)}\n` === trafficBytes.toString('utf8'), 'Traffic-stop record is not canonical.');
  invariant(traffic.unit === 'RST-002B' && traffic.nonce === approval.nonce && traffic.exclusive_docker_administration === true && traffic.no_direct_host_writers === true && traffic.no_direct_database_writers === true
    && Number.isFinite(Date.parse(traffic.stopped_at)) && Date.parse(traffic.stopped_at) >= Date.parse(approval.issued_at)
    && Date.parse(traffic.expires_at) > Date.now() && Date.parse(traffic.expires_at) <= Date.parse(traffic.stopped_at) + 15 * 60 * 1000, 'Traffic-stop record is invalid.');
  const assertLiveBinding = async () => {
    const commit = execFileSync('/usr/bin/git', ['rev-parse', '--verify', 'HEAD'], { cwd: approval.repository_root, encoding: 'utf8' }).trim();
    invariant(commit === approval.approved_commit && execFileSync('/usr/bin/git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: approval.repository_root, encoding: 'utf8' }) === ''
      && protectedTreeSha256(approval.repository_root) === approval.complete_tree_sha256, 'Repository binding changed.');
  };
  const options = { approval, key, assertLiveBinding, env: Object.freeze({ PATH: '/usr/bin:/bin' }) };
  const result = mode === 'rollback' ? await runRst002bRollback(options) : (mode === 'recover' ? await runRst002bRecover(options) : await runRst002bOperation(options));
  key.fill(0); process.stdout.write(`${JSON.stringify({ status: result.status, mode, commit: approval.approved_commit, complete_tree_sha256: approval.complete_tree_sha256 })}\n`);
}
main().catch(() => { process.stderr.write('RST-002B shared launcher failed closed.\n'); process.exitCode = 1; });
