const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const allowedCatalogKeys = [
  'MJLFinancement',
  'ModuleMjlFinancementName',
  'ModuleMjlFinancementDesc',
];

function catalogKeys(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
    .map((line) => line.slice(0, line.indexOf('=')));
}

function runtimeFiles(relative, files = []) {
  const absolute = path.join(root, relative);
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) runtimeFiles(child, files);
    else if (/\.(?:php|js)$/.test(entry.name)) files.push(child);
  }
  return files;
}

test('Phase 1 language catalogs expose only current module vocabulary', () => {
  for (const locale of ['fr_FR', 'en_US']) {
    const relative = `custom/mjlfinancement/langs/${locale}/mjlfinancement.lang`;
    assert.deepEqual(catalogKeys(relative), allowedCatalogKeys, relative);
  }
});

test('maintained runtime has no obsolete finance or legacy-role vocabulary', () => {
  const containmentAllowlist = new Set([
    'custom/mjlfinancement/scripts/rst_phase1_reset.php',
    'custom/mjlfinancement/scripts/verify_phase1_reset.php',
    'custom/mjlfinancement/js/native_guard.js.php',
    'custom/mjlfinancement/lib/mjl_native_modules.lib.php',
  ]);
  const forbidden = /MJL(?:Convention|BudgetLine|FundReceipt|Expense|WorkflowAction|ExchangeLog|Report|PTFBailleur)|Partenaire\s*\/\s*Programme|SUPERVISEUR_N[12]|\bDPAF\b|Expense amount|budget line|mjlfinancement_(?:convention|budget_line|fund_receipt|expense|validation|workflow_action|exchange_log|report|access_audit)/i;

  for (const relative of runtimeFiles('custom/mjlfinancement')) {
    if (relative.includes('/langs/') || containmentAllowlist.has(relative)) continue;
    assert.doesNotMatch(fs.readFileSync(path.join(root, relative), 'utf8'), forbidden, relative);
  }
});

test('obsolete-vocabulary exceptions stay limited to named containment files', () => {
  const unit = fs.readFileSync(__filename, 'utf8');
  for (const reasonedBoundary of [
    'scripts/rst_phase1_reset.php',
    'scripts/verify_phase1_reset.php',
    'js/native_guard.js.php',
    'lib/mjl_native_modules.lib.php',
  ]) {
    assert.match(unit, new RegExp(reasonedBoundary.replaceAll('.', '\\.')), reasonedBoundary);
  }
});
