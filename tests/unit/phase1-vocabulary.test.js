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
  const containmentAllowances = new Map(Object.entries({
    'custom/mjlfinancement/scripts/rst_phase1_reset.php': {
      reason: 'the approved executor must name each legacy table that it quarantines or rejects',
      tokens: {
        mjlfinancement_convention: 2,
        mjlfinancement_budget_line: 1,
        mjlfinancement_fund_receipt: 1,
        mjlfinancement_expense: 1,
        mjlfinancement_validation: 1,
        mjlfinancement_workflow_action: 1,
        mjlfinancement_exchange_log: 1,
        mjlfinancement_report: 1,
        mjlfinancement_access_audit: 1,
      },
    },
    'custom/mjlfinancement/scripts/verify_phase1_reset.php': {
      reason: 'the containment verifier must prove each deleted legacy table is absent',
      tokens: {
        mjlfinancement_convention: 1,
        mjlfinancement_budget_line: 1,
        mjlfinancement_fund_receipt: 1,
        mjlfinancement_expense: 1,
        mjlfinancement_validation: 1,
        mjlfinancement_workflow_action: 1,
        mjlfinancement_exchange_log: 1,
        mjlfinancement_report: 1,
        mjlfinancement_access_audit: 1,
      },
    },
  }));
  const observed = new Map();
  const forbidden = /MJL(?:Convention|BudgetLine|FundReceipt|Expense|WorkflowAction|ExchangeLog|Report|PTFBailleur)|Partenaire\s*\/\s*Programme|SUPERVISEUR_N[12]|\bDPAF\b|Expense amount|budget line|mjlfinancement_(?:convention|budget_line|fund_receipt|expense|validation|workflow_action|exchange_log|report|access_audit)/gi;

  for (const relative of runtimeFiles('custom/mjlfinancement')) {
    if (relative.includes('/langs/')) continue;
    const matches = [...fs.readFileSync(path.join(root, relative), 'utf8').matchAll(forbidden)];
    for (const match of matches) {
      const token = match[0].toLowerCase();
      const allowance = containmentAllowances.get(relative);
      assert.ok(allowance, `${relative}: uncontained obsolete token ${match[0]}`);
      assert.ok(allowance.reason.length > 20, `${relative}: containment reason is missing`);
      assert.ok(Object.hasOwn(allowance.tokens, token), `${relative}: unexpected obsolete token ${match[0]}`);
      const key = `${relative}:${token}`;
      observed.set(key, (observed.get(key) || 0) + 1);
    }
  }

  for (const [relative, allowance] of containmentAllowances) {
    for (const [token, count] of Object.entries(allowance.tokens)) {
      assert.equal(observed.get(`${relative}:${token}`) || 0, count, `${relative}: exact allowance for ${token}`);
    }
  }
});
