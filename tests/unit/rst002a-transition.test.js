const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const customRoot = path.join(root, 'custom/mjlfinancement');

function phpFiles(directory = customRoot) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...phpFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.php')) files.push(full);
  }
  return files;
}

test('access-profile assignment is role-only and never persists Partner scopes', () => {
  const source = read('custom/mjlfinancement/lib/mjl_scope.lib.php');
  assert.match(source, /function mjl_scope_assign_access_profile\(\$userId, \$roleCode, User \$actor, \$entity = null, \$source = 'manual', \$note = ''\)/);
  assert.doesNotMatch(source, /scope_soc_ids|scopes=/);
  assert.doesNotMatch(source, /function mjl_scope_(?:assign_soc_scope|user_soc_ids|partner_sql_filter|can_access_fk_soc|object_fk_soc|can_access_object|replace_scope_rows)\b/);
});

test('normal runtime PHP does not depend on the retained Partner-scope table', () => {
  const allowed = new Set([
    'scripts/check_production_readiness.php',
    'scripts/verify_sample_data.php',
    'scripts/verify_scope_integrity.php',
    'scripts/verification/schema/role_scope_schema.php',
    'scripts/verification/scope/access_model.php',
    'scripts/verification/scope/unresolved_scope.php',
  ]);
  const findings = phpFiles()
    .map((full) => [full, path.relative(customRoot, full)])
    .filter(([full, relative]) => !allowed.has(relative) && fs.readFileSync(full, 'utf8').includes('mjlfinancement_user_soc_scope'))
    .map(([, relative]) => relative);
  assert.deepEqual(findings, []);
});

test('retired Partner authorization inputs and audit payloads have no runtime backdoor', () => {
  const retired = /mjl_legacy_partner_[A-Za-z0-9_]*\b|mjl_scope_(?:assign_soc_scope|user_soc_ids|partner_sql_filter|programme_sql_filter|partner_ids|programme_ids|can_access_fk_soc|object_fk_soc|can_access_object|replace_scope_rows)\b|scope_soc_ids|scopes=/;
  const findings = phpFiles()
    .filter((full) => retired.test(fs.readFileSync(full, 'utf8')))
    .map((full) => path.relative(customRoot, full));
  assert.deepEqual(findings, []);
});

test('allowed retained-table runtime references are diagnostics only, never DML', () => {
  for (const relative of [
    'custom/mjlfinancement/scripts/check_production_readiness.php',
    'custom/mjlfinancement/scripts/verify_sample_data.php',
    'custom/mjlfinancement/scripts/verify_scope_integrity.php',
    'custom/mjlfinancement/scripts/verification/schema/role_scope_schema.php',
    'custom/mjlfinancement/scripts/verification/scope/access_model.php',
    'custom/mjlfinancement/scripts/verification/scope/unresolved_scope.php',
  ]) {
    const source = read(relative);
    assert.doesNotMatch(source, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+[^;\n]*mjlfinancement_user_soc_scope/i, `${relative} mutates retained scope rows`);
  }
});

test('Activity side-effect helpers enforce the transition freeze at persistence seams', () => {
  assert.match(read('custom/mjlfinancement/lib/mjl_timeline.lib.php'), /objectType === 'mjlfinancement_activity'[\s\S]*RST-002A/);
  assert.match(read('custom/mjlfinancement/lib/mjl_document.lib.php'), /objectType === 'mjlfinancement_activity'[\s\S]*RST-002A/);
  const exchange = read('custom/mjlfinancement/class/mjlexchangelog.class.php');
  for (const method of ['create', 'update', 'delete']) {
    const start = exchange.indexOf(`public function ${method}(`);
    const body = exchange.slice(start, exchange.indexOf('\n\tpublic function ', start + 1));
    if (method === 'create') assert.match(body, /object_type === 'mjlfinancement_activity'/, `${method} allows Activity exchange writes`);
    else assert.match(body, /exchangeMutationDenied\(/, `${method} bypasses persisted Activity exchange guard`);
  }
  assert.match(exchange, /SELECT entity, object_type[\s\S]*WHERE rowid = [^;\n]+ AND entity =/);
  assert.match(exchange, /!\$row \|\| \(int\) \$row->entity !== \(int\) \$conf->entity/);
  assert.match(exchange, /function create[\s\S]*\(int\) \$this->entity !== \(int\) \$conf->entity/);
  assert.match(exchange, /function exchangeMutationDenied[\s\S]*\(int\) \$this->entity !== \(int\) \$conf->entity/);
});

test('workspace metrics are explicitly unavailable before any legacy loader can run', () => {
  const source = read('custom/mjlfinancement/lib/mjl_workspace.lib.php');
  const start = source.indexOf('function mjl_workspace_metrics(');
  const next = source.indexOf('\nfunction ', start + 1);
  const body = source.slice(start, next);
  assert.match(body, /return mjl_workspace_unavailable_metrics\(\);/);
  assert.doesNotMatch(body, /mjl_workspace_(?:own_activity_drafts|activity_count|expense_review_count|count|capture)\(/);
});

test('dashboard aggregate entrypoints are unavailable before legacy loaders can run', () => {
  const source = read('custom/mjlfinancement/lib/mjl_dashboard.lib.php');
  for (const [name, expectedReturn] of [
    ['mjl_dashboard_workspace_metrics_filtered', 'mjl_dashboard_unavailable_workspace_metrics'],
    ['mjl_dashboard_supervision_kpis', 'mjl_dashboard_unavailable_supervision_kpis'],
  ]) {
    const start = source.indexOf(`function ${name}(`);
    const next = source.indexOf('\nfunction ', start + 1);
    const body = source.slice(start, next);
    assert.match(body, new RegExp(`return ${expectedReturn}\\(\\);`));
    assert.doesNotMatch(body, /mjl_dashboard_(?:capture|activity_count|expense_count|deadline_risk_count|physical_execution_percent|budget_total|validated_expense_total)\(/);
  }
});

test('validation diagnostics reuse the complete Expense target predicate', () => {
  const validation = read('custom/mjlfinancement/validations.php');
  const traceability = read('custom/mjlfinancement/lib/mjl_traceability_scope.lib.php');
  assert.match(validation, /mjl_traceability_expense_target_integrity_sql\('v\.fk_expense', 'v\.entity'\)/);
  assert.match(traceability, /function mjl_traceability_expense_target_integrity_sql\(/);
});

test('RST-002A acceptance and current-state docs classify deferred suites and Roadmap accurately', () => {
  const acceptance = read('docs/mjl-acceptance-tests.md');
  const functionalMap = read('docs/mjl-current-app-functional-map.md');
  assert.match(acceptance, /`npm run test:e2e` runs twelve retained legacy capability suites[\s\S]{0,200}They are non-gating until RST-013A\/RST-014A/);
  assert.doesNotMatch(acceptance, /test:e2e` runs the twelve blocking capability suites/);
  assert.match(functionalMap, /\| Roadmap \| `roadmap\.php` \| Temporarily unavailable under RST-002A\./);
});

test('Activity document list and direct-download resolvers fail closed', () => {
  const source = read('custom/mjlfinancement/lib/mjl_document.lib.php');
  for (const name of ['mjl_activity_document_download_rows', 'mjl_activity_document_fetch_download_row']) {
    const start = source.indexOf(`function ${name}(`);
    const next = source.indexOf('\nfunction ', start + 1);
    assert.ok(start >= 0, `missing ${name}`);
    assert.match(source.slice(start, next), /\{\s*return array\(\);\s*\}/, `${name} exposes Activity documents during RST-002A`);
  }
});

test('every public legacy Activity mutator is frozen by the shared transition policy', () => {
  const source = read('custom/mjlfinancement/class/mjlactivity.class.php');
  const methods = [
    'create', 'update', 'delete', 'updateImportantFields', 'updateExecution',
    'submit', 'requestCorrection', 'correct', 'validate', 'prevalidate',
    'finalValidate', 'reject',
  ];
  for (const method of methods) {
    const start = source.indexOf(`public function ${method}(`);
    assert.ok(start >= 0, `missing public mutator ${method}`);
    const next = source.indexOf('\n\tpublic function ', start + 1);
    const body = source.slice(start, next < 0 ? source.length : next);
    assert.match(body, /mjl_activity_transition_mutation_allowed\(/, `${method} bypasses the transition freeze`);
  }
});

test('temporary module landing is Admin-only and query-free', () => {
  const source = read('custom/mjlfinancement/index.php');
  assert.match(source, /mjl_scope_is_platform_admin\(\$user/);
  assert.doesNotMatch(source, /mjl_(?:dashboard|alerts)_/);
  for (const forbidden of ['reports.php', 'activities.php', 'alerts.php', 'documents.php', 'roadmap.php', 'dpafdashboard.php']) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace('.', '\\.')));
  }
});

test('scope-security suite has one canonical require chain', () => {
  const wrapper = read('tests/e2e/scope-security.spec.js');
  const compatibility = read('tests/e2e/cases/scope-security.cases.js');
  assert.equal((wrapper.match(/require\(/g) || []).length, 1);
  assert.match(wrapper, /require\('\.\/cases\/scope-security\.cases'\)/);
  assert.equal(compatibility.trim(), "require('./rst002a-authorization.cases');");
});
