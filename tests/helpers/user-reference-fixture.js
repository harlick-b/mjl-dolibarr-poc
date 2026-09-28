const childProcess = require('node:child_process');

const disposableEnvironment = require('./verify-disposable-environment');

const ROLES = new Set([null, 'AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF']);
const KEY_PATTERN = /^[a-z][a-z0-9-]{0,19}$/;
const NAMESPACE_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,22}[a-z0-9])?$/;
const RESERVED_KEYS = new Set(['constructor', 'prototype']);
const FIXTURE_PATH = '/opt/mjl-tests/fixtures/user-reference-fixture.php';
const MAX_REQUEST_BYTES = 16 * 1024;

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const actual = Object.keys(value);
  if (actual.length !== expected.length || expected.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`${label} has an invalid shape.`);
  }
}

function validateKey(key, seen, label) {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key) || RESERVED_KEYS.has(key)) throw new Error(`${label} contains an invalid key.`);
  if (seen.has(key)) throw new Error(`${label} contains a duplicate key.`);
  seen.add(key);
}

function validateLabel(label) {
  if (typeof label !== 'string' || label.length === 0 || label !== label.trim() || label !== label.normalize('NFC')) {
    throw new Error('Reference labels must be nonempty, edge-trimmed NFC strings.');
  }
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(label) || [...label].length > 112) throw new Error('Reference label is invalid or oversized.');
}

function validateRequest(request) {
  exactKeys(request, ['namespace', 'entity', 'users', 'references'], 'Fixture request');
  if (typeof request.namespace !== 'string' || !NAMESPACE_PATTERN.test(request.namespace)) throw new Error('Fixture namespace is invalid.');
  if (!Number.isSafeInteger(request.entity) || request.entity <= 0 || request.entity > 2147483647) throw new Error('Fixture entity is invalid.');
  if (!Array.isArray(request.users) || request.users.length < 1 || request.users.length > 8) throw new Error('Fixture users must contain one to eight records.');
  exactKeys(request.references, ['partners', 'projects', 'operationTypes'], 'Fixture references');

  const userKeys = new Set();
  let hasValidator = false;
  for (const user of request.users) {
    exactKeys(user, ['key', 'role'], 'Fixture user');
    validateKey(user.key, userKeys, 'Fixture users');
    if (!ROLES.has(user.role)) throw new Error('Fixture user role is unsupported.');
    if (user.role === 'VALIDATEUR_DEFINITIF') hasValidator = true;
  }

  const collectionKeys = new Set();
  const partnerKeys = new Set();
  for (const collection of ['partners', 'projects', 'operationTypes']) {
    const entries = request.references[collection];
    if (!Array.isArray(entries) || entries.length > 8) throw new Error(`Fixture ${collection} is invalid or oversized.`);
    for (const entry of entries) {
      exactKeys(entry, collection === 'projects' ? ['key', 'label', 'partnerKey'] : ['key', 'label'], `Fixture ${collection} entry`);
      validateKey(entry.key, collectionKeys, 'Fixture references');
      validateLabel(entry.label);
      if (collection === 'partners') partnerKeys.add(entry.key);
      if (collection === 'projects' && (typeof entry.partnerKey !== 'string' || !partnerKeys.has(entry.partnerKey))) {
        throw new Error('Fixture Project must reference a request-local Partenaire key.');
      }
    }
  }
  const referenceCount = request.references.partners.length + request.references.projects.length + request.references.operationTypes.length;
  if (referenceCount > 0 && !hasValidator) throw new Error('Fixture references require a Validator.');
}

function canonicalRequest(request) {
  validateRequest(request);
  const canonical = JSON.stringify({
    namespace: request.namespace,
    entity: request.entity,
    users: request.users.map(({ key, role }) => ({ key, role })),
    references: {
      partners: request.references.partners.map(({ key, label }) => ({ key, label })),
      projects: request.references.projects.map(({ key, label, partnerKey }) => ({ key, label, partnerKey })),
      operationTypes: request.references.operationTypes.map(({ key, label }) => ({ key, label })),
    },
  });
  if (Buffer.byteLength(canonical, 'utf8') > MAX_REQUEST_BYTES) throw new Error('Fixture request exceeds 16 KiB.');
  return canonical;
}

function nullRecord() {
  return Object.create(null);
}

function copyIdMap(source, expectedKeys, label) {
  exactKeys(source, expectedKeys, label);
  const output = nullRecord();
  for (const key of expectedKeys) {
    if (!Number.isSafeInteger(source[key]) || source[key] <= 0) throw new Error(`${label} contains an invalid identifier.`);
    output[key] = source[key];
  }
  return output;
}

function normalizeResult(value, request) {
  exactKeys(value, ['users', 'partners', 'projects', 'operationTypes'], 'Fixture result');
  exactKeys(value.users, request.users.map(({ key }) => key), 'Fixture result users');
  const users = nullRecord();
  for (const { key } of request.users) {
    exactKeys(value.users[key], ['id', 'login'], `Fixture result user ${key}`);
    if (!Number.isSafeInteger(value.users[key].id) || value.users[key].id <= 0 || value.users[key].login !== `${request.namespace}.${key}`) {
      throw new Error('Fixture result contains an invalid user.');
    }
    users[key] = Object.freeze({ id: value.users[key].id, login: value.users[key].login });
  }
  const result = {
    users,
    partners: copyIdMap(value.partners, request.references.partners.map(({ key }) => key), 'Fixture result partners'),
    projects: copyIdMap(value.projects, request.references.projects.map(({ key }) => key), 'Fixture result projects'),
    operationTypes: copyIdMap(value.operationTypes, request.references.operationTypes.map(({ key }) => key), 'Fixture result operation types'),
  };
  for (const map of Object.values(result)) Object.freeze(map);
  return Object.freeze(result);
}

function captureAdminEvidence() {
  let decoded;
  try {
    const output = childProcess.execFileSync('docker', [
      'compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/database-evidence.php',
    ], { encoding: 'utf8', env: process.env, input: '', stdio: ['pipe', 'pipe', 'pipe'] });
    decoded = JSON.parse(output);
  } catch (_) {
    throw new Error('Independent native administrator attestation failed.');
  }
  if (decoded?.admin_count !== 1 || !/^[a-f0-9]{64}$/.test(decoded?.admin_sha256 || '')) {
    throw new Error('Independent native administrator attestation failed.');
  }
  return decoded.admin_sha256;
}

function createUserReferenceFixtureSet(request) {
  disposableEnvironment.verifyDisposableEnvironment();
  const adminBefore = captureAdminEvidence();
  let result;
  let failure;
  try {
    const input = canonicalRequest(request);
    const output = childProcess.execFileSync('docker', [
      'compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', FIXTURE_PATH,
    ], { encoding: 'utf8', env: process.env, input, stdio: ['pipe', 'pipe', 'pipe'] });
    let decoded;
    try {
      decoded = JSON.parse(output);
    } catch (_) {
      throw new Error('User/reference disposable fixture returned an invalid response.');
    }
    result = normalizeResult(decoded, request);
  } catch (error) {
    failure = error instanceof Error && /^(Fixture|Reference)/.test(error.message)
      ? error
      : new Error('User/reference disposable fixture creation failed.');
  } finally {
    const adminAfter = captureAdminEvidence();
    if (adminAfter !== adminBefore) throw new Error('Native administrator attestation changed during fixture creation.');
  }
  if (failure) throw failure;
  return result;
}

module.exports = { createUserReferenceFixtureSet };
