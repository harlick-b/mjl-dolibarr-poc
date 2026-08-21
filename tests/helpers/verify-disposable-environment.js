const { execFileSync } = require('node:child_process');
const path = require('node:path');

const { assertDisposableConfig } = require('../runner/disposable-policy');

function verifyDisposableEnvironment(options = {}) {
  const env = options.env || process.env;
  const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());
  const expected = {
    projectName: env.COMPOSE_PROJECT_NAME,
    baseUrl: env.MJL_BASE_URL,
    port: Number(env.MJL_TEST_PORT),
    repositoryRoot,
    evidenceRoot: path.resolve(env.MJL_EVIDENCE_ROOT),
    sentinel: env.MJL_DISPOSABLE_RUN_SENTINEL,
    testUserPassword: env.MJL_TEST_USER_PASSWORD,
  };
  const resolved = options.resolvedConfig || JSON.parse(execFileSync(
    'docker',
    ['compose', 'config', '--format', 'json'],
    { cwd: repositoryRoot, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ));
  const verified = assertDisposableConfig(resolved, expected);
  if (!options.resolvedConfig) {
    const sentinelPath = '/var/www/documents/.mjl-disposable-fixture-sentinel';
    const stat = execFileSync('docker', [
      'compose', 'exec', '-T', '--user', 'root', '-e', 'LC_ALL=C', 'dolibarr',
      'stat', '-c', '%u:%a:%F', sentinelPath,
    ], { cwd: repositoryRoot, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const content = execFileSync('docker', [
      'compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'cat', sentinelPath,
    ], { cwd: repositoryRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    if (stat !== '0:444:regular file' || !Buffer.from(expected.sentinel).equals(content)) {
      throw new Error('Disposable fixture sentinel runner attestation failed.');
    }
  }
  return verified;
}

module.exports = { verifyDisposableEnvironment };
