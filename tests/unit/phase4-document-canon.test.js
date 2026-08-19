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
  for (const owner of [authority, specification, permissions]) {
    assert.match(owner, /runtime active (?:Dolibarr )?entity[^.]*\$conf->entity|\$conf->entity[^.]*runtime active (?:Dolibarr )?entity/i);
  }
  assert.match(specification, /Cross-entity identifiers are denied for every role, including\s+Admin/);
  assert.match(specification, /Admin may list metadata,[^.]+current documents only in the runtime\s+active Dolibarr entity/i);
  assert.match(specification, /Admin may not upload, append, replace,\s+withdraw, categorize, review, validate/i);
  assert.match(permissions, /\| Current supporting documents \|[^\n]+\| Read-only in active entity \|/);
  assert.match(permissions, /\| Recover historical document version \|[^\n]+Yes, reason required and separately audited \| Yes, reason required and separately audited \|/);
  assert.match(permissions, /never the entity stored on the administrator's user row/i);
  assert.doesNotMatch(canon, /read[^.\n]*across entities/i);
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
  assert.match(canon, /Replacement atomically appends `PUBLISHED`[^.]+`SUPERSEDED`/i);
  assert.match(canon, /Withdrawal is irreversible/i);

  const versionSection = dictionary.slice(
    dictionary.indexOf('## Phase 4 Document Version'),
    dictionary.indexOf('## Phase 4 Document Lifecycle Event'),
  );
  for (const field of [
    'uploader identity and role snapshot',
    'original display filename',
    'validated media type',
    'byte size',
    'content hash',
    'encrypted-storage locator',
    'wrapped per-file key reference',
    'native ECM adapter reference',
    'scan engine/signature metadata',
    'created timestamp',
  ]) {
    assert.match(versionSection, new RegExp(field.split(' ').join('\\s+'), 'i'));
  }
  assert.doesNotMatch(versionSection, /withdrawal actor|withdrawal reason|withdrawal date|withdrawn state/i);

  const lifecycleSection = dictionary.slice(
    dictionary.indexOf('## Phase 4 Document Lifecycle Event'),
    dictionary.indexOf('## Phase 4 Revision Requirement Snapshot'),
  );
  for (const field of ['document version', 'per-series sequence', 'actor', 'timestamp', 'withdrawal reason', 'expected series version', 'audit reference']) {
    assert.match(lifecycleSection, new RegExp(field.split(' ').join('\\s+'), 'i'));
  }
  assert.match(dictionary, /Every retained current, superseded, or withdrawn ciphertext version counts toward/i);
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
  assert.match(canon, /every configured category applies to all three\s+parent\s+types/i);
  assert.doesNotMatch(canon, /applicability changes append/i);
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
