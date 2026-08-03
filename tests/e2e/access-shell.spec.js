require('./cases/navigation-shell.cases');

const { test, expect } = require('@playwright/test');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

test('representative native workspaces are denied inside the guarded MJL shell', async ({ page }) => {
  test.setTimeout(90000);
  for (const username of ['agent.mjl', 'dpaf.mjl', 'admin.poc']) {
    await login(page, username);
    for (const route of ['/projet/index.php', '/societe/index.php', '/user/list.php', '/admin/index.php']) {
      const response = await page.goto(route);
      expect(response.status(), `${username}: ${route}`).toBe(403);
      await expect(page.getByLabel('Menu module MJL')).toBeVisible();
    }
  }
});

test('authentication helper routes remain reachable outside the native block', async ({ page }) => {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await expect(page.getByLabel('Identifiant')).toBeVisible();
  await page.goto('/user/passwordforgotten.php');
  await expect(page.getByLabel('Adresse email')).toBeVisible();
});
