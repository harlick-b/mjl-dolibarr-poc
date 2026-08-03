const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test('maintained executable verification rejects deprecated plan vocabulary', () => {
  const directories = [
    'tests/e2e',
    'tests/characterization',
    'tests/contracts',
    'custom/mjlfinancement/scripts/verification',
  ];
  const files = [
    'custom/mjlfinancement/scripts/audit_schema_current.php',
    'custom/mjlfinancement/scripts/verify_activity_workflow.php',
    'custom/mjlfinancement/scripts/verify_expense_workflow.php',
    'custom/mjlfinancement/scripts/verify_sample_data.php',
    'custom/mjlfinancement/scripts/verify_scope_integrity.php',
    'custom/mjlfinancement/scripts/verify_traceability_exports.php',
  ];
  const visit = (relative) => {
    const absolute = path.join(root, relative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (/\.(?:js|php)$/.test(entry.name)) files.push(child);
    }
  };
  directories.forEach(visit);

  for (const relative of files) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8').replaceAll('dpaf.mjl', '');
    assert.doesNotMatch(source, /Phase\s*\d|\bP\d+[A-Z]*[-A-Z0-9]*|SUPERVISEUR_N\d|\bDPAF\b/i, relative);
  }
});
