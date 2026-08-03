require('./cases/partner-project.cases');

const { test, expect } = require('@playwright/test');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test('project rows expose distinct open and management actions with accessible labels', async ({ page }) => {
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill('dpaf.mjl');
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.goto('/custom/mjlfinancement/projects.php');

  const row = page.getByRole('table').locator('tbody tr').first();
  await expect(row.locator('td[data-label="Ouvrir"]')).toBeVisible();
  await expect(row.locator('td[data-label="Actions"]')).toBeVisible();
});
