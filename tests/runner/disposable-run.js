const crypto = require('node:crypto');
const path = require('node:path');

const { PROJECT_PREFIX } = require('./disposable-policy');

function createRunPlan(options = {}) {
  if (typeof options.repositoryRoot !== 'string' || options.repositoryRoot.trim() === '') {
    throw new Error('A repository root is required.');
  }

  const port = Number(options.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('The disposable port must be an available non-privileged TCP port.');
  }
  if (port === 8080) {
    throw new Error('Disposable tests must never use the shared app port 8080.');
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const timestamp = now.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '').toLowerCase();
  const processId = Number.isInteger(options.processId) ? options.processId : process.pid;
  const randomHex = options.randomHex || crypto.randomBytes(4).toString('hex');
  if (!/^[a-f0-9]{8}$/.test(randomHex)) {
    throw new Error('The disposable run suffix must contain eight lowercase hexadecimal characters.');
  }

  const repositoryRoot = path.resolve(options.repositoryRoot);
  const projectName = `${PROJECT_PREFIX}${timestamp}-${processId}-${randomHex}`;
  const artifactRoot = path.join(repositoryRoot, 'test-results', 'runs', projectName);

  return Object.freeze({
    projectName,
    baseUrl: `http://127.0.0.1:${port}`,
    port,
    repositoryRoot,
    composeFile: path.join(repositoryRoot, 'tests/fixtures/disposable-compose.override.yml'),
    artifactRoot,
    databaseVolume: `${projectName}_mjl_test_db`,
    documentVolume: `${projectName}_mjl_test_docs`,
  });
}

function sanitizeOutput(value, literalSecrets = []) {
  let output = String(value ?? '');
  for (const secret of literalSecrets) {
    if (typeof secret === 'string' && secret.length > 0) {
      output = output.split(secret).join('[REDACTED]');
    }
  }

  return output
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:/]+:)[^\s@]+@/gi, '$1[REDACTED]@')
    .replace(/((?:password|passwd|api[_-]?key|token|secret)\s*[:=]\s*)[^\s]+/gi, '$1[REDACTED]');
}

function getSuitePlan(mode) {
  const plans = {
    all: ['unit', 'verify', 'e2e'],
    unit: ['unit'],
    verify: ['verify'],
    e2e: ['e2e'],
    characterization: ['characterization'],
    'manual-accessibility': ['manual-accessibility'],
  };
  if (!Object.hasOwn(plans, mode)) {
    throw new Error(`Unknown test mode: ${mode}`);
  }
  return [...plans[mode]];
}

module.exports = {
  createRunPlan,
  getSuitePlan,
  sanitizeOutput,
};
