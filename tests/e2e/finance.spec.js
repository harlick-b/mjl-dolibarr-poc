const { test, expect } = require('@playwright/test');

const { verifyDisposableEnvironment } = require('../helpers/verify-disposable-environment');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test.beforeAll(() => {
  verifyDisposableEnvironment();
});

test('expense finance references remain limited to the active assigned scope', async ({ page }) => {
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill('agent.mjl');
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.goto('/custom/mjlfinancement/expenses.php?action=create');

  const conventionOptions = page.locator('select[name="fk_convention"] option');
  await expect(conventionOptions.filter({ hasText: 'CONV-UNICEF-2026-001' })).toHaveCount(1);
  await expect(conventionOptions.filter({ hasText: 'CONV-RED-2026-001' })).toHaveCount(0);
});
