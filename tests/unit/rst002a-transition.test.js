const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('access-profile assignment is role-only and never persists Partner scopes', () => {
  const source = read('custom/mjlfinancement/lib/mjl_scope.lib.php');
  assert.match(source, /function mjl_scope_assign_access_profile\(\$userId, \$roleCode, User \$actor, \$entity = null, \$source = 'manual', \$note = ''\)/);
  assert.doesNotMatch(source, /scope_soc_ids|scopes=/);
  assert.doesNotMatch(source, /function mjl_scope_(?:assign_soc_scope|user_soc_ids|partner_sql_filter|can_access_fk_soc|object_fk_soc|can_access_object|replace_scope_rows)\b/);
});

test('normal runtime PHP does not depend on the retained Partner-scope table', () => {
  const customRoot = path.join(root, 'custom/mjlfinancement');
  const allowed = new Set([
    'scripts/check_production_readiness.php',
    'scripts/verify_sample_data.php',
    'scripts/verify_scope_integrity.php',
    'scripts/verification/schema/role_scope_schema.php',
    'scripts/verification/scope/access_model.php',
    'scripts/verification/scope/unresolved_scope.php',
  ]);
  const findings = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.php')) {
        const relative = path.relative(customRoot, full);
        if (!allowed.has(relative) && fs.readFileSync(full, 'utf8').includes('mjlfinancement_user_soc_scope')) findings.push(relative);
      }
    }
  };
  walk(customRoot);
  assert.deepEqual(findings, []);
});

test('retired Partner authorization inputs and audit payloads have no runtime backdoor', () => {
  const customRoot = path.join(root, 'custom/mjlfinancement');
  const retired = /mjl_scope_(?:assign_soc_scope|user_soc_ids|partner_sql_filter|programme_sql_filter|partner_ids|programme_ids|can_access_fk_soc|object_fk_soc|can_access_object|replace_scope_rows)\b|scope_soc_ids|scopes=/;
  const findings = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.php')) {
        const source = fs.readFileSync(full, 'utf8');
        if (retired.test(source)) findings.push(path.relative(customRoot, full));
      }
    }
  };
  walk(customRoot);
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
  assert.match(exchange, /SELECT entity, object_type[\s\S]*WHERE rowid =/);
  assert.match(exchange, /!\$row \|\| \(int\) \$row->entity !== \(int\) \$conf->entity/);
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
