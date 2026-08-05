const { execFileSync } = require('node:child_process');

const defaultPassword = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

function composeExec(service, args, encoding = null) {
  return execFileSync('docker', ['compose', 'exec', '-T', service, ...args], encoding ? { encoding } : { stdio: 'pipe' });
}

function sql(query) {
  composeExec('mariadb', ['mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e', query]);
}

function scalar(query) {
  return composeExec('mariadb', ['mariadb', '-udolidbuser', '-ppoc_pwd', '-N', '-B', 'dolidb', '-e', query], 'utf8').trim();
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
