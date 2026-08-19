const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

test('Phase 4 Admin document exception is active-entity-only and non-mutating', () => {
  const authority = read('docs/mjl-authoritative-decisions.md');
  const specification = read('docs/mjl-functional-specification-v2.md');
  const permissions = read('docs/mjl-permission-matrix-v2.md');
  const decisions = read('docs/mjl-decision-register-v2.md');
  const canon = `${authority}\n${specification}\n${permissions}`;

  assert.match(decisions, /\| DEC-042 \|[^\n]+runtime active Dolibarr entity[^\n]+\| APPROVED \|/);
  assert.match(canon, /\$conf->entity/);
  assert.match(canon, /cross-entity identifiers? (?:are|is) denied/i);
  assert.match(canon, /Admin[^.]+current document[^.]+active entity/i);
  assert.match(canon, /Admin[^.]+may not[^.]+upload[^.]+replace[^.]+withdraw/i);
  assert.match(permissions, /Recover historical document version[^\n]+reason required and separately audited/);
  assert.doesNotMatch(canon, /Admin (?:reads?|may read|can read)[^.\n]*across entities/i);
});

test('Phase 4 document content and lifecycle are separate immutable records', () => {
  const dictionary = read('docs/mjl-data-dictionary-v2.md');
  const status = read('docs/mjl-status-and-transition-model-v2.md');
  const specification = read('docs/mjl-functional-specification-v2.md');
  const canon = `${dictionary}\n${status}\n${specification}`;

  assert.match(dictionary, /## Phase 4 Document Lifecycle Event/);
  for (const event of ['PUBLISHED', 'SUPERSEDED', 'WITHDRAWN']) {
    assert.match(canon, new RegExp(`\\b${event}\\b`));
  }
  assert.match(canon, /per-series sequence/i);
  assert.match(canon, /at most one[^.]+current version/i);
  assert.match(canon, /lifecycle event and[^.]+audit event[^.]+same transaction/i);
  assert.match(canon, /projection[^.]+rebuild/i);
  assert.match(canon, /retryable conflict/i);

  const versionSection = dictionary.slice(
    dictionary.indexOf('## Phase 4 Document Version'),
    dictionary.indexOf('## Phase 4 Document Lifecycle Event'),
  );
  assert.doesNotMatch(versionSection, /withdrawal actor|withdrawal reason|withdrawal date|withdrawn state/i);
});

test('Phase 4 category changes and submission requirements use frozen revisions', () => {
  const dictionary = read('docs/mjl-data-dictionary-v2.md');
  const specification = read('docs/mjl-functional-specification-v2.md');
  const canon = `${dictionary}\n${specification}`;

  assert.match(dictionary, /## Phase 4 Category Rule Revision/);
  for (const field of [
    'stable category identifier',
    'label',
    'active state',
    'parent applicability',
    'requirement mode',
    'effective timestamp',
    'actor',
    'canonical payload',
    'payload hash',
  ]) {
    assert.match(canon, new RegExp(field, 'i'));
  }
  assert.match(canon, /Drafts do not freeze/i);
  assert.match(canon, /correction and resubmission[^.]+new\s+immutable\s+snapshot/i);
  assert.match(canon, /qualifying (?:document )?series and version identifiers/i);
  assert.match(canon, /retryable stale-submission/i);
});

test('current design audits mark removed routes as absent', () => {
  for (const relativePath of [
    'docs/design-system/audit/current-screen-inventory.md',
    'docs/design-system/audit/current-ui-audit.md',
  ]) {
    const audit = read(relativePath);
    for (const route of ['budgetlines.php', 'reports.php', 'validations.php', 'exchangelogs.php', 'roadmap.php']) {
      const line = audit.split('\n').find((candidate) => candidate.includes(route));
      assert.ok(line, `${relativePath} must inventory ${route}`);
      assert.match(line, /Removed|404|absent/i, `${relativePath}: ${route}`);
    }
  }
});
