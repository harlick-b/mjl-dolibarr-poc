const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MAX_ARCHIVE_ENTRIES = 4096;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

function artifactSecretVariants(values) {
  const variants = new Set();
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) continue;
    variants.add(value);
    variants.add(encodeURIComponent(value));
    variants.add(Buffer.from(value, 'utf8').toString('base64'));
    variants.add(Buffer.from(value, 'utf8').toString('base64url'));
  }
  return [...variants].filter(Boolean);
}

function filesRecursively(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Artifact trees must not contain symbolic links.');
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
      else throw new Error('Artifact trees contain an unsupported file type.');
    }
  };
  visit(root);
  return files;
}

function bufferContains(buffer, variants) {
  return variants.some((variant) => buffer.includes(Buffer.from(variant, 'utf8')));
}

function scanArchive(file, variants) {
  const listing = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\n').filter(Boolean);
  if (listing.length > MAX_ARCHIVE_ENTRIES) throw new Error('Artifact archive has too many entries.');
  let bytes = 0;
  for (const entry of listing) {
    if (entry.startsWith('/') || entry.split('/').includes('..')) throw new Error('Artifact archive contains an unsafe entry path.');
    const content = execFileSync('unzip', ['-p', file, entry], { encoding: null, maxBuffer: MAX_ARCHIVE_BYTES, stdio: ['ignore', 'pipe', 'pipe'] });
    bytes += content.length;
    if (bytes > MAX_ARCHIVE_BYTES) throw new Error('Artifact archive is oversized.');
    if (bufferContains(content, variants)) return true;
  }
  return false;
}

function scanArtifacts(root, secrets) {
  const hits = [];
  for (const file of filesRecursively(root)) {
    let matchedCategory = null;
    try {
      for (const secret of secrets) {
        const variants = artifactSecretVariants([secret.value]);
        const extension = path.extname(file).toLowerCase();
        const matched = extension === '.zip' || extension === '.trace'
          ? scanArchive(file, variants)
          : bufferContains(fs.readFileSync(file), variants);
        if (matched) {
          matchedCategory = secret.category;
          break;
        }
      }
    } catch (_) {
      fs.rmSync(file, { force: true });
      throw new Error(`Artifact scan failed for ${path.relative(root, file)}.`);
    }
    if (matchedCategory) {
      fs.rmSync(file, { force: true });
      hits.push({ path: path.relative(root, file).split(path.sep).join('/'), category: matchedCategory });
    }
  }
  return hits;
}

function hashField(hash, type, value) {
  const bytes = Buffer.from(String(value), 'utf8');
  hash.update(`${type}:${bytes.length}:`, 'utf8');
  hash.update(bytes);
  hash.update('\n', 'utf8');
}

function streamTreeDigest(root) {
  const hash = crypto.createHash('sha256');
  if (!fs.existsSync(root)) {
    hashField(hash, 'absent', '.');
    return hash.digest('hex');
  }
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);
      if (entry.isSymbolicLink()) {
        hashField(hash, 'link-path', relative);
        hashField(hash, 'link-mode', stat.mode & 0o7777);
        hashField(hash, 'link-target', fs.readlinkSync(absolute));
      } else if (entry.isDirectory()) {
        hashField(hash, 'dir-path', relative);
        hashField(hash, 'dir-mode', stat.mode & 0o7777);
        visit(absolute);
      } else if (entry.isFile()) {
        hashField(hash, 'file-path', relative);
        hashField(hash, 'file-mode', stat.mode & 0o7777);
        hashField(hash, 'file-size', stat.size);
        hash.update(fs.readFileSync(absolute));
      } else {
        throw new Error(`Unsupported filesystem entry: ${relative}`);
      }
    }
  };
  visit(root);
  return hash.digest('hex');
}

module.exports = { artifactSecretVariants, scanArtifacts, streamTreeDigest };
