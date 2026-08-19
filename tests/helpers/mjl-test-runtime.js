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

async function login(page, username, password = defaultPassword) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.waitForLoadState('domcontentloaded');
}

function registerSecret(category, value) {
  const socketPath = process.env.MJL_SECRET_REGISTRY_SOCKET;
  if (!socketPath || typeof value !== 'string' || value === '') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    socket.setEncoding('utf8');
    socket.setTimeout(2000);
    socket.once('connect', () => socket.end(`${JSON.stringify({ category, value })}\n`));
    socket.once('close', resolve);
    socket.once('timeout', () => socket.destroy(new Error('Secret registry timed out.')));
    socket.once('error', () => reject(new Error('Secret registry unavailable.')));
  });
}

module.exports = { composeExec, login, registerSecret, scalar, sql };
