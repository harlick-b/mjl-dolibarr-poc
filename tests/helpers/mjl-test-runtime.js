const { execFileSync } = require('node:child_process');

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

module.exports = { composeExec, login, scalar, sql };
