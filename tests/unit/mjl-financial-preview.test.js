const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../custom/mjlfinancement/js/mjl_financial_preview.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const { summary } = context.window.MjlFinance;

test('budget preview keeps missing amounts distinct from explicit zero', () => {
  const missing = summary('', ['0']);
  assert.equal(missing.activity, 'Non renseigné');
  assert.equal(missing.operations, '0 F CFA');
  assert.equal(missing.difference, 'Non renseigné');

  const partial = summary('100', ['0', '']);
  assert.equal(partial.operations, 'Non renseigné');
  assert.equal(partial.difference, 'Non renseigné');
});

test('budget preview preserves a one-franc difference above JavaScript safe integers', () => {
  const result = summary('9007199254740993', ['9007199254740992']);
  assert.equal(result.activity, '9 007 199 254 740 993 F CFA');
  assert.equal(result.operations, '9 007 199 254 740 992 F CFA');
  assert.equal(result.difference, '1 F CFA');
  assert.equal(summary('100', ['100']).difference, '-');
  assert.equal(summary('100', ['101']).difference, '-1 F CFA');
});

test('budget preview does not present an invalid or overflowing input as zero', () => {
  assert.equal(summary('9223372036854775808', ['1']).activity, 'Saisie invalide');
  assert.equal(summary('0100', ['1']).difference, 'Saisie invalide');
  assert.equal(summary(' 100', ['1']).activity, 'Saisie invalide');
});
