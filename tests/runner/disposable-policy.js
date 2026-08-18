const path = require('node:path');

const PROJECT_PREFIX = 'mjl-test-';
const SHARED_PORT = 8080;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function origin(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`${label} must be an absolute HTTP URL.`);
  }
  invariant(parsed.protocol === 'http:', `${label} must use HTTP for the local disposable tenant.`);
  invariant(parsed.pathname === '/' && !parsed.search && !parsed.hash, `${label} must contain only an origin.`);
  return parsed.origin;
}

function volumeAt(service, target) {
  const matches = (service.volumes || []).filter((volume) => volume.target === target);
  invariant(matches.length === 1, `${target} must have exactly one storage mount.`);
  return matches[0];
}

function isWithin(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertNamedStorage(config, service, target, source, expected) {
  const mount = volumeAt(service, target);
  invariant(mount.type === 'volume' && mount.source === source, `${target} must use its dedicated named volume.`);

  const declaration = config.volumes && config.volumes[source];
  invariant(declaration, `${source} must be declared by the disposable Compose project.`);
  invariant(declaration.external !== true, `${source} must not be external storage.`);
  invariant(
    declaration.name === `${expected.projectName}_${source}`,
    `${source} must have a project-scoped volume name.`,
  );
}

function assertReadOnlyBind(service, target, source) {
  const mount = volumeAt(service, target);
  invariant(mount.type === 'bind', `${target} must be a repository bind mount.`);
  invariant(path.resolve(mount.source) === path.resolve(source), `${target} must use the expected repository source.`);
  invariant(mount.read_only === true, `${target} must be read-only.`);
}

function assertUnprivilegedService(name, service) {
  invariant(service.privileged !== true, `${name} must not run privileged.`);
  invariant(!service.pid || service.pid !== 'host', `${name} must not share the host PID namespace.`);
  invariant(!service.ipc || service.ipc !== 'host', `${name} must not share the host IPC namespace.`);
  invariant(!service.network_mode || service.network_mode !== 'host', `${name} must not use host networking.`);
  invariant(!Array.isArray(service.devices) || service.devices.length === 0, `${name} must not expose host devices.`);
}

function assertDisposableConfig(config, expected) {
  invariant(expected && typeof expected === 'object', 'Expected disposable run identity is required.');
  invariant(
    typeof expected.projectName === 'string' && expected.projectName.startsWith(PROJECT_PREFIX),
    `Expected project name must start with ${PROJECT_PREFIX}.`,
  );
  invariant(config && config.name === expected.projectName, 'Resolved Compose project name does not match the unique test project name.');

  const expectedOrigin = origin(expected.baseUrl, 'MJL_BASE_URL');
  invariant(Number(expected.port) !== SHARED_PORT, `Disposable tests must not use shared port ${SHARED_PORT}.`);
  invariant(new URL(expectedOrigin).hostname === '127.0.0.1', 'Disposable tests must bind to 127.0.0.1.');
  invariant(Number(new URL(expectedOrigin).port) === Number(expected.port), 'MJL_BASE_URL port does not match the allocated port.');

  const mariadb = config.services && config.services.mariadb;
  const dolibarr = config.services && config.services.dolibarr;
  invariant(mariadb && dolibarr, 'Disposable Compose must define mariadb and dolibarr services.');
  invariant(
    Object.keys(config.services).sort().join(',') === 'dolibarr,mariadb',
    'Disposable Compose must contain only the mariadb and dolibarr services.',
  );
  assertUnprivilegedService('mariadb', mariadb);
  assertUnprivilegedService('dolibarr', dolibarr);
  invariant(mariadb.restart === 'no' && dolibarr.restart === 'no', 'Disposable services must use restart policy no.');
  invariant(!mariadb.container_name && !dolibarr.container_name, 'Disposable services must not use shared fixed container names.');

  const configuredRoot = dolibarr.environment && dolibarr.environment.DOLI_URL_ROOT;
  invariant(origin(configuredRoot, 'DOLI_URL_ROOT') === expectedOrigin, 'DOLI_URL_ROOT must match MJL_BASE_URL.');

  const ports = (dolibarr.ports || []).filter((port) => Number(port.target) === 80);
  invariant(ports.length === 1, 'Dolibarr must publish exactly one browser port.');
  invariant(Number(ports[0].published) === Number(expected.port), 'Published browser port must match the allocated port.');
  invariant(Number(ports[0].published) !== SHARED_PORT, `Disposable tests must not publish shared port ${SHARED_PORT}.`);
  invariant(ports[0].host_ip === '127.0.0.1', 'Disposable browser port must publish on the loopback interface only.');

  assertNamedStorage(config, mariadb, '/var/lib/mysql', 'mjl_test_db', expected);
  assertNamedStorage(config, dolibarr, '/var/www/documents', 'mjl_test_docs', expected);
  assertNamedStorage(config, dolibarr, '/var/www/html/conf', 'mjl_test_conf', expected);
  assertReadOnlyBind(dolibarr, '/var/www/html/custom', path.join(expected.repositoryRoot, 'custom'));
  assertReadOnlyBind(
    dolibarr,
    '/etc/apache2/conf-enabled/mjl-native-guard.conf',
    path.join(expected.repositoryRoot, 'custom/mjlfinancement/deployment/apache-native-guard.conf'),
  );
  assertReadOnlyBind(dolibarr, '/opt/mjl-tests', path.join(expected.repositoryRoot, 'tests'));
  assertReadOnlyBind(dolibarr, '/opt/mjl-evidence', expected.evidenceRoot);

  const repositoryData = path.join(expected.repositoryRoot, 'data');
  const allowedBinds = new Set([
    path.resolve(path.join(expected.repositoryRoot, 'custom')),
    path.resolve(path.join(expected.repositoryRoot, 'custom/mjlfinancement/deployment/apache-native-guard.conf')),
    path.resolve(path.join(expected.repositoryRoot, 'tests')),
    path.resolve(expected.evidenceRoot),
  ]);
  for (const service of Object.values(config.services || {})) {
    for (const mount of service.volumes || []) {
      if (mount.type === 'bind') {
        invariant(!isWithin(mount.source, repositoryData), 'Disposable services must not mount repository data.');
        invariant(allowedBinds.has(path.resolve(mount.source)), 'Disposable services must not use unapproved bind mounts.');
      }
    }
    invariant(
      service === dolibarr || !(service.ports || []).length,
      'Only Dolibarr may publish a disposable port.',
    );
  }

  for (const [name, declaration] of Object.entries(config.volumes || {})) {
    invariant(declaration.external !== true, `Volume ${name} must not be external.`);
    invariant(
      typeof declaration.name === 'string' && declaration.name.startsWith(`${expected.projectName}_`),
      `Volume ${name} must be project-scoped.`,
    );
  }

  for (const [name, network] of Object.entries(config.networks || {})) {
    invariant(network.external !== true, `Network ${name} must not be external.`);
    invariant(
      typeof network.name === 'string' && network.name.startsWith(`${expected.projectName}_`),
      `Network ${name} must use a project-scoped network name.`,
    );
  }

  return Object.freeze({
    projectName: expected.projectName,
    baseUrl: expectedOrigin,
    port: Number(expected.port),
    databaseVolume: `${expected.projectName}_mjl_test_db`,
    documentVolume: `${expected.projectName}_mjl_test_docs`,
    configVolume: `${expected.projectName}_mjl_test_conf`,
  });
}

function assertCleanupComplete(resources, projectName) {
  invariant(typeof projectName === 'string' && projectName.startsWith(PROJECT_PREFIX), 'A disposable project name is required for cleanup verification.');
  const survivors = ['containers', 'networks', 'volumes'].flatMap((kind) =>
    (Array.isArray(resources && resources[kind]) ? resources[kind] : []).map((name) => `${kind}: ${name}`),
  );
  invariant(survivors.length === 0, `Disposable project ${projectName} still owns resources:\n${survivors.join('\n')}`);
  return true;
}

module.exports = {
  PROJECT_PREFIX,
  assertCleanupComplete,
  assertDisposableConfig,
};
