const { test, expect } = require('@playwright/test');

async function login(page, loginName) {
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
  await page.getByLabel('Mot de passe').fill(process.env.MJL_TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

test('Phase 3A custom document routes fail closed for anonymous requests', async ({ request }) => {
  for (const path of ['/custom/mjlfinancement/documents.php','/custom/mjlfinancement/documentdownload.php?id=1']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(403);
    expect(await response.text()).not.toMatch(/fatal error|warning/i);
  }
});

test('Phase 3A execution events remain visible through the entity-filtered audit UI', async ({ page }) => {
  await login(page, 'phase3a.execution.validator');
  const response = await page.goto('/custom/mjlfinancement/workflowactions.php?audit_action=OPERATION_EXECUTION_UPDATED');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Audit' })).toBeVisible();
  await expect(page.locator('body')).toContainText('OPERATION_EXECUTION_UPDATED');
});
