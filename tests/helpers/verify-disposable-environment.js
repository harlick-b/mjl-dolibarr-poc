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
  };
  const resolved = options.resolvedConfig || JSON.parse(execFileSync(
    'docker',
    ['compose', 'config', '--format', 'json'],
    { cwd: repositoryRoot, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ));
  return assertDisposableConfig(resolved, expected);
}

module.exports = { verifyDisposableEnvironment };
