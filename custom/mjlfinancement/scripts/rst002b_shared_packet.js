#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { canonicalJson } = require('./rst002b_shared_operation.lib');

function invariant(value, message) { if (!value) throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function protectedTree(root) {
  const roots = ['custom','docs','tests','AGENTS.md','CONTEXT.md','DESIGN.md','README.md','docker-compose.yml','package.json','package-lock.json','playwright.config.js'];
  const entries = [];
  const visit = (relative) => {
    const absolute = path.join(root, relative); const stat = fs.lstatSync(absolute);
    invariant(!stat.isSymbolicLink(), `Protected source link refused: ${relative}`);
    if (stat.isDirectory()) {
      entries.push({ path: relative, type: 'directory', mode: stat.mode & 0o7777 });
      for (const name of fs.readdirSync(absolute).sort()) visit(path.join(relative, name));
    } else { invariant(stat.isFile(), `Protected source type refused: ${relative}`); entries.push({ path: relative, type: 'file', mode: stat.mode & 0o7777, sha256: sha256(fs.readFileSync(absolute)) }); }
  };
  for (const relative of roots) visit(relative);
  return { manifest: { version: 1, unit: 'RST-002B', entries }, sha256: sha256(Buffer.from(`${canonicalJson(entries)}\n`)) };
}
function writeProtected(file, bytes) {
  const descriptor = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o400);
  try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); fs.fchownSync(descriptor, 0, 0); fs.fchmodSync(descriptor, 0o400); } finally { fs.closeSync(descriptor); }
}
function main() {
  invariant(typeof process.getuid === 'function' && process.getuid() === 0, 'Root operator required.');
  invariant(process.argv.length === 3 && process.argv[2].startsWith('--output-root='), 'Use exactly --output-root=/absolute/new/directory.');
  const outputRoot = process.argv[2].slice(14); const repositoryRoot = process.cwd();
  invariant(path.isAbsolute(outputRoot) && path.normalize(outputRoot) === outputRoot && !fs.existsSync(outputRoot), 'Output root must be new and absolute.');
  invariant(execFileSync('/usr/bin/git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repositoryRoot, encoding: 'utf8' }) === '', 'Repository must be clean.');
  const commit = execFileSync('/usr/bin/git', ['rev-parse', '--verify', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  const key = crypto.randomBytes(32); const nonce = crypto.randomBytes(16).toString('hex');
  const tree = protectedTree(repositoryRoot);
  const approval = { version: 1, unit: 'RST-002B', mode: 'execute', approved_commit: commit,
    complete_tree_sha256: tree.sha256, repository_root: repositoryRoot,
    compose_project_name: 'mjl-dolibarr-poc', database_name: 'dolidb',
    compose_files: [{ path: path.join(repositoryRoot, 'docker-compose.yml'), sha256: sha256(fs.readFileSync(path.join(repositoryRoot, 'docker-compose.yml'))) }],
    backup_root: path.join(outputRoot, 'backups'), evidence_root: path.join(outputRoot, 'evidence'),
    backup_key_sha256: sha256(key), nonce,
    issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(),
    docker_runtime: { images: { mariadb: { id: execFileSync('/usr/bin/docker', ['image', 'inspect', '--format', '{{.Id}}', 'mariadb:11'], { encoding: 'utf8' }).trim() }, dolibarr: { id: execFileSync('/usr/bin/docker', ['image', 'inspect', '--format', '{{.Id}}', 'dolibarr/dolibarr:23.0.2'], { encoding: 'utf8' }).trim() } } },
  };
  fs.mkdirSync(outputRoot, { mode: 0o700 }); fs.chownSync(outputRoot, 0, 0);
  for (const name of ['approval','key','traffic','backups','evidence']) { fs.mkdirSync(path.join(outputRoot, name), { mode: 0o700 }); fs.chownSync(path.join(outputRoot, name), 0, 0); }
  writeProtected(path.join(outputRoot, 'approval/record'), Buffer.from(`${canonicalJson(approval)}\n`));
  writeProtected(path.join(outputRoot, 'key/bytes'), key);
  writeProtected(path.join(outputRoot, 'protected-tree-manifest.json'), Buffer.from(`${canonicalJson(tree.manifest)}\n`));
  writeProtected(path.join(outputRoot, 'traffic/template'), Buffer.from(`${canonicalJson({ version: 1, unit: 'RST-002B', nonce, stopped_at: 'REPLACE', expires_at: 'REPLACE', exclusive_docker_administration: true, no_direct_host_writers: true, no_direct_database_writers: true })}\n`));
  key.fill(0);
  process.stdout.write(`${JSON.stringify({ status: 'awaiting-traffic-stop-and-explicit-approval', output_root: outputRoot, approved_commit: commit, complete_tree_sha256: approval.complete_tree_sha256 })}\n`);
}
try { main(); } catch (_) { process.stderr.write('RST-002B packet generation failed closed.\n'); process.exitCode = 1; }
