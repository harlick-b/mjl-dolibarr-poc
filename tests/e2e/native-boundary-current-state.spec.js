const { test, expect } = require('@playwright/test');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test.describe.configure({ mode: 'serial' });

const users = ['agent.mjl', 'superviseur.n1', 'superviseur.n2', 'dpaf.mjl', 'admin.poc'];

const mjlPages = [
  '/custom/mjlfinancement/index.php',
  '/custom/mjlfinancement/projects.php',
  '/custom/mjlfinancement/documents.php',
];

const nativeRoutes = [
  '/projet/index.php',
  '/ecm/index.php',
  '/societe/index.php',
  '/comm/index.php',
  '/hrm/index.php',
  '/compta/index.php',
  '/accountancy/index.php',
  '/banque/list.php',
  '/tax/index.php',
  '/core/tools.php',
  '/api/index.php',
  '/modulebuilder/index.php',
  '/admin/modules.php',
  '/admin/index.php',
  '/admin/company.php',
  '/user/list.php',
  '/user/card.php',
  '/user/group/list.php',
  '/categories/index.php',
  '/product/index.php',
  '/imports/index.php',
  '/ticket/index.php',
  '/don/index.php',
  '/contrat/index.php',
  '/fichinter/index.php',
  '/website/index.php',
];

const nativeChromePattern = /Accueil|Rechercher|Mon tableau de bord|Configuration|Outils d'administration|Utilisateurs & Groupes|Tiers|Espace RH|Module Builder|Espace facturation et paiement|Module Category not enabled|Not enough permissions|Accès refusé/;

async function login(page, username, userPassword = password) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(userPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
}

async function expectMjlShell(page) {
  await expect(page.getByLabel('Menu module MJL')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(nativeChromePattern);
}

async function expectNativeRouteBlocked(page, path) {
  const response = await page.goto(path);
  expect(response.status(), path).toBe(403);
  await expect(page.getByLabel('Menu module MJL')).toBeVisible();
  await expect(page.locator('body')).toContainText(/Acces non autorise|Retour au tableau de bord/);
  await expect(page.locator('body')).not.toContainText(nativeChromePattern);
}

test('current runtime keeps MJL pages inside MJL shell before bootstrap E2E runs', async ({ page }) => {
  for (const username of users) {
    await login(page, username);
    for (const route of mjlPages) {
      await page.goto(route);
      await expectMjlShell(page);
    }
  }
});

test('current runtime blocks direct native browser routes before bootstrap E2E runs', async ({ page }) => {
  test.setTimeout(120000);

  for (const username of users) {
    await login(page, username);
    for (const route of nativeRoutes) {
      await expectNativeRouteBlocked(page, route);
    }
  }
});

test('current runtime preserves auth helper routes outside the native block', async ({ page }) => {
  await page.goto('/user/logout.php').catch(() => {});

  await page.goto('/index.php');
  await expect(page.getByLabel('Identifiant')).toBeVisible();
  await expect(page.getByLabel('Mot de passe')).toBeVisible();

  await page.goto('/user/passwordforgotten.php');
  await expect(page.locator('body')).not.toContainText(/Acces non autorise|Retour au tableau de bord/);
});
