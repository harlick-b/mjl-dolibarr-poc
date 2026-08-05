const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const approvedRoot = 'docs/design-system/approved/v3';
const validationReport = `${approvedRoot}/docs/design/design-validation-report.md`;
const protectedIndexBlobs = new Map([
  [`${approvedRoot}/DESIGN.md`, '54a8a790fd4c5a7b09b2dbc731e851792d1150a2'],
  [`${approvedRoot}/MANUAL-REVIEW.md`, '89f46c3890e7d9156cec275ceb414fa0ff01329a'],
  [`${approvedRoot}/PRODUCT.md`, 'ec570fc01a1c04dced67571ba251f8f7bcdb2046'],
  [`${approvedRoot}/design-manifest.yaml`, 'd8bba8fcad4b672aa168ed33085f10394079a0f1'],
  [`${approvedRoot}/design-tokens/README.md`, '4dfa681c8909f3d5a9fb93478cc6f9acf4e00a00'],
  [`${approvedRoot}/design-tokens/semantic-tokens.json`, 'fca1235bbbeb93d4560c9636c7ab7c1923adc4a3'],
  [`${approvedRoot}/design-tokens/tokens.json`, '51b80342a1bf2f5a589fd463799121f32ca82c45'],
  [`${approvedRoot}/docs/design/component-inventory.md`, '84242e550475cc3c432e07f668b14f7306d35840'],
  [`${approvedRoot}/docs/design/design-assumptions.md`, '11fc939fbc0f198832b2cf1f68ea95030b1b4505'],
  [`${approvedRoot}/docs/design/design-decisions.md`, '910bca05f2ef00d3d8a5eacbfc42d6defcf53fe2'],
]);
const baseReportBlob = 'ba316daf3e604e852d7617d70ef8588f0c142336';
const baseReportLength = 4377;
const baseReportSha256 = 'fc1331288600b0d98810eb7994157ee871a9a3e67217635deb9e3b118caeca01';

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function indexBlobs() {
  const index = fs.readFileSync(path.join(root, '.git/index'));
  assert.equal(index.subarray(0, 4).toString('ascii'), 'DIRC');
  assert.ok([2, 3].includes(index.readUInt32BE(4)), 'unsupported Git index version');
  const count = index.readUInt32BE(8);
  const entries = new Map();
  let offset = 12;
  for (let entry = 0; entry < count; entry += 1) {
    const entryStart = offset;
    const oid = index.subarray(offset + 40, offset + 60).toString('hex');
    const pathStart = offset + 62;
    const pathEnd = index.indexOf(0, pathStart);
    assert.ok(pathEnd >= 0, 'malformed Git index entry');
    entries.set(index.subarray(pathStart, pathEnd).toString('utf8'), oid);
    offset = entryStart + Math.ceil((pathEnd + 1 - entryStart) / 8) * 8;
  }
  return entries;
}

function gitBlobOid(content) {
  const header = Buffer.from(`blob ${content.length}\0`);
  return crypto.createHash('sha1').update(header).update(content).digest('hex');
}

test('active v3 governance freezes normative artifacts and keeps evidence append-only', () => {
  const readme = read('docs/design-system/README.md');

  assert.match(readme, /normative v3 artifacts are immutable/i);
  assert.match(readme, /material design changes require a validated v4/i);
  assert.match(readme, /runtime\s+CSS and tests remain code-owned/i);
  assert.match(readme, /validation report is the sole append-only exception/i);
  assert.match(readme, /prior results (?:must not|may never) be\s+rewritten or deleted/i);

  const indexed = indexBlobs();
  for (const [artifact, baseOid] of protectedIndexBlobs) {
    assert.equal(indexed.get(artifact), baseOid, `${artifact} must remain unchanged in the prospective index`);
  }

  const currentReport = fs.readFileSync(path.join(root, validationReport));
  assert.equal(
    crypto.createHash('sha256').update(currentReport.subarray(0, baseReportLength)).digest('hex'),
    baseReportSha256,
    'validation history must retain its exact base bytes',
  );
  const appendedEvidence = currentReport.subarray(baseReportLength).toString('utf8');
  assert.match(appendedEvidence, /^\n## Remediation evidence, 2026-08-04\n/);
  assert.equal((appendedEvidence.match(/^## Remediation evidence, 2026-08-04$/gm) || []).length, 1);

  const indexedReportOid = indexed.get(validationReport);
  if (indexedReportOid !== baseReportBlob) {
    assert.equal(indexedReportOid, gitBlobOid(currentReport), 'the indexed validation report must equal the append-only worktree report');
  }
});

test('public token routes impose the repository-owned referrer boundary', () => {
  const hook = read('custom/mjlfinancement/class/actions_mjlfinancement.class.php');

  assert.match(hook, /<meta name="referrer" content="same-origin">/);
  assert.match(hook, /rel="stylesheet"[^>]+referrerpolicy="no-referrer"/);
});

test('active documentation states the precise Google Fonts privacy boundary', () => {
  const readme = read('docs/design-system/README.md');
  const deployment = read('docs/mjl-deployment-checklist.md');

  assert.match(readme, /ordinary network metadata/i);
  assert.match(readme, /IP\s+address/i);
  assert.match(readme, /user agent/i);
  assert.match(readme, /Referrer-Policy: same-origin/);
  assert.match(readme, /application\s+paths and query tokens/i);
  assert.match(readme, /gstatic(?: font origin)? may receive the Google stylesheet URL/i);
  assert.match(deployment, /preserves `Referrer-Policy: same-origin`/);
});

test('v3 remediation activates the approved auth and interactive-row metrics', () => {
  const authCss = read('custom/mjlfinancement/css/mjl_auth.css.php');
  const appCss = read('custom/mjlfinancement/css/mjl_app.css.php');
  const projects = read('custom/mjlfinancement/projects.php');

  assert.match(authCss, /\.mjl-auth-brand h1\s*\{[^}]*line-height:\s*2rem;/s);
  assert.match(projects, /<tr class="oddeven mjl-row-interactive">/);

  const mobileRule = appCss.indexOf('@media (max-width: 768px)');
  const protectedRow = appCss.indexOf('.mjl-operational-table tr.mjl-row-interactive > td', mobileRule);
  assert.ok(mobileRule >= 0, 'mobile operational-table rule is missing');
  assert.ok(protectedRow > mobileRule, 'interactive-row protection must follow the mobile transformation');
  assert.match(appCss.slice(protectedRow), /min-height:\s*var\(--mjl-row-interactive\)/);
});

test('live Inter CSS inspection accepts discrete weights and covering ranges', () => {
  const { inspectInterFontCss } = require('../evidence/inter-font-css');
  const face = (weight, display = 'swap') => `@font-face { font-family: Inter; font-style: normal; font-weight: ${weight}; font-display: ${display}; src: url(https://fonts.gstatic.com/s/inter/${String(weight).replace(/\s+/g, '-')}.woff2) format('woff2'); }`;

  const discrete = inspectInterFontCss(['400', '500', '600', '700'].map((weight) => face(weight)).join('\n'));
  assert.deepEqual(discrete.coveredWeights, [400, 500, 600, 700]);
  assert.equal(discrete.faceCount, 4);

  const ranged = inspectInterFontCss(face('400 700'));
  assert.deepEqual(ranged.coveredWeights, [400, 500, 600, 700]);
  assert.throws(() => inspectInterFontCss(face('400 700', 'block')), /font-display: swap/);
});
