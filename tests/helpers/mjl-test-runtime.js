const { execFileSync } = require('node:child_process');
const net = require('node:net');

const defaultPassword = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

function composeExec(service, args, encoding = null, input = undefined) {
  return execFileSync('docker', ['compose', 'exec', '-T', service, ...args], {
    ...(encoding ? { encoding } : {}),
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function sql(query) {
  composeExec('mariadb', ['mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', 'dolidb'], null, `${query}\n`);
}

function scalar(query) {
  return composeExec('mariadb', ['mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', '-N', '-B', 'dolidb'], 'utf8', `${query}\n`).trim();
}

function privilegedScalar(query) {
  return composeExec('mariadb', ['mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', '--defaults-group-suffix=_root', '-N', '-B', 'dolidb'], 'utf8', `${query}\n`).trim();
}

async function login(page, username, password = defaultPassword) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.waitForLoadState('domcontentloaded');
}

function registerSecretAt(registry, category, value) {
  const port = Number(registry?.port);
  const capability = registry?.capability;
  if (typeof value !== 'string' || value === '') return Promise.resolve();
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^[a-f0-9]{32}$/.test(capability || '')) {
    return Promise.reject(new Error('Secret registry is unavailable.'));
  }
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setEncoding('utf8');
    socket.setTimeout(2000);
    let response = '';
    socket.once('connect', () => socket.end(`${JSON.stringify({ capability, category, value })}\n`));
    socket.on('data', (chunk) => { response += chunk; });
    socket.once('end', () => {
      if (response === 'OK\n') resolve();
      else reject(new Error('Secret registry rejected the enrollment.'));
    });
    socket.once('timeout', () => socket.destroy(new Error('Secret registry timed out.')));
    socket.once('error', () => reject(new Error('Secret registry unavailable.')));
  });
}

function registerSecret(category, value) {
  return registerSecretAt({
    port: process.env.MJL_SECRET_REGISTRY_PORT,
    capability: process.env.MJL_SECRET_REGISTRY_CAPABILITY,
  }, category, value);
}

module.exports = { composeExec, login, privilegedScalar, registerSecret, registerSecretAt, scalar, sql };
