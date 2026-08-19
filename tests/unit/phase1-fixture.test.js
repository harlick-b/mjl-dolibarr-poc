const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const disposableEnvironment = require('../helpers/verify-disposable-environment');
const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');

function validRequest() {
  return {
    namespace: 'rst014a-unit',
    entity: 1,
    users: [
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'norole', role: null },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire jetable' }],
      projects: [{ key: 'project', label: 'Projet jetable', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type jetable' }],
    },
  };
}

test('canonicalizes the exact bounded public fixture request', () => {
  let captured;
  test.mock.method(disposableEnvironment, 'verifyDisposableEnvironment', () => Object.freeze({ projectName: 'mjl-test-unit' }));
  test.mock.method(childProcess, 'execFileSync', (_command, _args, options) => {
    captured = options.input;
    return JSON.stringify({
      users: { validator: { id: 1, login: 'rst014a-unit.validator' }, agent: { id: 2, login: 'rst014a-unit.agent' }, norole: { id: 3, login: 'rst014a-unit.norole' } },
      partners: { partner: 4 }, projects: { project: 5 }, operationTypes: { type: 6 },
    });
  });
  const result = createPhase1FixtureSet(validRequest());
  assert.equal(
    captured,
    '{"namespace":"rst014a-unit","entity":1,"users":[{"key":"validator","role":"VALIDATEUR_DEFINITIF"},{"key":"agent","role":"AGENT_SAISIE"},{"key":"norole","role":null}],"references":{"partners":[{"key":"partner","label":"Partenaire jetable"}],"projects":[{"key":"project","label":"Projet jetable","partnerKey":"partner"}],"operationTypes":[{"key":"type","label":"Type jetable"}]}}',
  );
  assert.equal(result.users.agent.id, 2);
  test.mock.restoreAll();
});

test('rejects unknown, unsafe, oversized, noncanonical, and cross-request input', () => {
  const cases = [
    { ...validRequest(), extra: true },
    { ...validRequest(), namespace: 'UPPER' },
    { ...validRequest(), namespace: 'x'.repeat(25) },
    { ...validRequest(), entity: 0 },
    { ...validRequest(), entity: 1.5 },
    { ...validRequest(), entity: Number.MAX_SAFE_INTEGER + 1 },
    { ...validRequest(), users: [] },
    { ...validRequest(), users: [{ key: 'constructor', role: null }] },
    { ...validRequest(), users: [{ key: 'agent', role: 'ADMIN_PLATEFORME' }] },
    { ...validRequest(), users: [{ key: 'agent', role: null, password: 'secret' }] },
    { ...validRequest(), references: { ...validRequest().references, partners: [{ key: 'p', label: ' padded ' }] } },
    { ...validRequest(), references: { ...validRequest().references, partners: [{ key: 'p', label: 'e\u0301' }] } },
    { ...validRequest(), references: { ...validRequest().references, partners: [{ key: 'p', label: 'bad\u0001' }] } },
    { ...validRequest(), references: { ...validRequest().references, projects: [{ key: 'p', label: 'Projet', partnerKey: 'missing' }] } },
    { ...validRequest(), references: { ...validRequest().references, partners: Array.from({ length: 9 }, (_, index) => ({ key: `p${index}`, label: `P ${index}` })) } },
  ];
  for (const value of cases) assert.throws(() => createPhase1FixtureSet(value));
});

test('requires a Validator for references and rejects duplicate keys', () => {
  const noValidator = validRequest();
  noValidator.users = [{ key: 'agent', role: 'AGENT_SAISIE' }];
  assert.throws(() => createPhase1FixtureSet(noValidator), /Validator/i);

  const duplicate = validRequest();
  duplicate.users.push({ key: 'agent', role: null });
  assert.throws(() => createPhase1FixtureSet(duplicate), /duplicate/i);
});

test('maximum-length derived login remains exact and collision-safe', () => {
  const value = validRequest();
  value.namespace = 'n'.repeat(24);
  value.users = [{ key: 'u'.repeat(20), role: null }];
  value.references = { partners: [], projects: [], operationTypes: [] };
  test.mock.method(disposableEnvironment, 'verifyDisposableEnvironment', () => Object.freeze({ projectName: 'mjl-test-unit' }));
  test.mock.method(childProcess, 'execFileSync', () => JSON.stringify({
    users: { ['u'.repeat(20)]: { id: 1, login: `${'n'.repeat(24)}.${'u'.repeat(20)}` } },
    partners: {}, projects: {}, operationTypes: {},
  }));
  const result = createPhase1FixtureSet(value);
  assert.equal(result.users['u'.repeat(20)].login.length, 45);
  test.mock.restoreAll();
});

test('write-capable source preflights before bootstrap/DB and never copies Admin authentication', () => {
  const root = path.resolve(__dirname, '../..');
  const factory = fs.readFileSync(path.join(root, 'tests/fixtures/phase1-fixture.php'), 'utf8');
  const preflight = factory.indexOf("require __DIR__ . '/phase1-fixture-preflight.php'");
  const bootstrap = factory.indexOf("require_once '/var/www/html/main.inc.php'");
  const database = factory.indexOf('new PDO(');
  assert.ok(preflight >= 0 && preflight < bootstrap && bootstrap < database);
  assert.doesNotMatch(factory, /SELECT[^;\n]*pass(?:_crypted|_temp)?[^;\n]*FROM\s+llx_user/i);
  assert.doesNotMatch(factory, /WHERE\s+admin\s*=\s*1[^;\n]*(?:INSERT|creator|source)/i);
});

test('accepts only the exact secret-free result and recursively freezes null-prototype maps', () => {
  test.mock.method(disposableEnvironment, 'verifyDisposableEnvironment', () => Object.freeze({ projectName: 'mjl-test-unit' }));
  test.mock.method(childProcess, 'execFileSync', () => JSON.stringify({
    users: { validator: { id: 10, login: 'rst014a-unit.validator' }, agent: { id: 11, login: 'rst014a-unit.agent' }, norole: { id: 12, login: 'rst014a-unit.norole' } },
    partners: { partner: 20 }, projects: { project: 30 }, operationTypes: { type: 40 },
  }));
  const result = createPhase1FixtureSet(validRequest());
  assert.equal(Object.getPrototypeOf(result.users), null);
  assert.equal(Object.getPrototypeOf(result.partners), null);
  assert.equal(result.users.validator.login, 'rst014a-unit.validator');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.users.validator));

  test.mock.restoreAll();
  test.mock.method(disposableEnvironment, 'verifyDisposableEnvironment', () => Object.freeze({ projectName: 'mjl-test-unit' }));
  test.mock.method(childProcess, 'execFileSync', () => JSON.stringify({
    users: { validator: { id: 10, login: 'rst014a-unit.validator', password: 'secret' }, agent: { id: 11, login: 'rst014a-unit.agent' }, norole: { id: 12, login: 'rst014a-unit.norole' } },
    partners: { partner: 20 }, projects: { project: 30 }, operationTypes: { type: 40 },
  }));
  assert.throws(() => createPhase1FixtureSet(validRequest()));
  test.mock.restoreAll();
});
