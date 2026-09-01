#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { atomicRecord, canonicalJson } = require('../../custom/mjlfinancement/scripts/rst002b_shared_operation.lib');

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst002b-launcher-'));
  try {
    const first = atomicRecord(root, '00-before.json', { unit: 'RST-002B', sequence: 0, previous_sha256: null });
    const second = atomicRecord(root, '01-after.json', { unit: 'RST-002B', sequence: 1, previous_sha256: first });
    assert.match(first, /^[a-f0-9]{64}$/); assert.match(second, /^[a-f0-9]{64}$/);
    assert.equal(fs.statSync(path.join(root, '00-before.json')).mode & 0o777, 0o600);
    assert.throws(() => atomicRecord(root, '00-before.json', { replaced: true }));
    assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
    process.stdout.write('RST-002B shared launcher rehearsal: OK\n');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
main();
