const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DISPOSABLE_PROJECT_PREFIX = 'mjl-phase3d-prereq-';
const SHARED_URLS = new Set([
  'http://127.0.0.1:8080',
  'http://localhost:8080',
]);

function normalizedOrigin(rawUrl, name) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new Error(`${name} must be an absolute HTTP URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`${name} must contain only the browser origin.`);
  }
  return parsed.origin;
}

function realDirectory(rawPath, name) {
  if (!rawPath) {
    throw new Error(`${name} is required.`);
  }
  const resolved = fs.realpathSync(rawPath);
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`${name} must identify an existing directory.`);
  }
  return resolved;
}

function isStrictChild(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function bindSource(config, serviceName, target) {
  const service = config.services && config.services[serviceName];
  const volume = service && Array.isArray(service.volumes)
    ? service.volumes.find((item) => item.type === 'bind' && item.target === target)
    : null;
  if (!volume || !volume.source) {
    throw new Error(`${serviceName} must bind ${target} from the disposable host directory.`);
  }
  return fs.realpathSync(volume.source);
}

function validateDisposableComposeConfig(config, env, repositoryRoot) {
  const baseUrl = normalizedOrigin(env.MJL_BASE_URL || '', 'MJL_BASE_URL');
  if (SHARED_URLS.has(baseUrl)) {
    throw new Error('MJL_BASE_URL must not target the shared default workspace.');
  }

  const projectName = env.COMPOSE_PROJECT_NAME || '';
  if (!projectName.startsWith(DISPOSABLE_PROJECT_PREFIX)) {
    throw new Error(`COMPOSE_PROJECT_NAME must start with ${DISPOSABLE_PROJECT_PREFIX}.`);
  }
  if (config.name !== projectName) {
    throw new Error('The resolved Compose project name does not match COMPOSE_PROJECT_NAME.');
  }

  const temporaryRoot = realDirectory(env.MJL_E2E_TEMP_DIR, 'MJL_E2E_TEMP_DIR');
  const systemTemp = fs.realpathSync(os.tmpdir());
  const repoRoot = fs.realpathSync(repositoryRoot);
  if (!isStrictChild(temporaryRoot, systemTemp)) {
    throw new Error('MJL_E2E_TEMP_DIR must be a dedicated child of the system temporary directory.');
  }
  if (isStrictChild(temporaryRoot, repoRoot) || temporaryRoot === repoRoot) {
    throw new Error('MJL_E2E_TEMP_DIR must be outside the repository.');
  }

  const databaseSource = bindSource(config, 'mariadb', '/var/lib/mysql');
  const documentSource = bindSource(config, 'dolibarr', '/var/www/documents');
  for (const [name, source] of [['MariaDB', databaseSource], ['document', documentSource]]) {
    if (!isStrictChild(source, temporaryRoot)) {
      throw new Error(`${name} bind source must be inside MJL_E2E_TEMP_DIR.`);
    }
    const repositoryData = path.join(repoRoot, 'data');
    if (source === repositoryData || isStrictChild(source, repositoryData)) {
      throw new Error(`${name} bind source must not use the repository data directory.`);
    }
  }

  const dolibarr = config.services && config.services.dolibarr;
  const publishedPorts = dolibarr && Array.isArray(dolibarr.ports)
    ? dolibarr.ports.filter((port) => Number(port.target) === 80)
    : [];
  if (publishedPorts.length !== 1) {
    throw new Error('Dolibarr must publish exactly one host port for container port 80.');
  }
  const browserPort = Number(new URL(baseUrl).port || (baseUrl.startsWith('https:') ? 443 : 80));
  if (Number(publishedPorts[0].published) !== browserPort) {
    throw new Error('The Dolibarr published port must match MJL_BASE_URL.');
  }

  const configuredRoot = dolibarr && dolibarr.environment && dolibarr.environment.DOLI_URL_ROOT;
  if (normalizedOrigin(configuredRoot || '', 'DOLI_URL_ROOT') !== baseUrl) {
    throw new Error('DOLI_URL_ROOT must match MJL_BASE_URL.');
  }

  return {
    baseUrl,
    projectName,
    temporaryRoot,
    databaseSource,
    documentSource,
  };
}

function verifyDisposableComposeEnvironment(options = {}) {
  const env = options.env || process.env;
  const repositoryRoot = options.repositoryRoot || process.cwd();
  const composeConfig = options.composeConfig || (() => execFileSync(
    'docker',
    ['compose', 'config', '--format', 'json'],
    { cwd: repositoryRoot, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ));
  const config = JSON.parse(composeConfig());
  return validateDisposableComposeConfig(config, env, repositoryRoot);
}

module.exports = {
  DISPOSABLE_PROJECT_PREFIX,
  validateDisposableComposeConfig,
  verifyDisposableComposeEnvironment,
};
