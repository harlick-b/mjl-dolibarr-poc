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
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
});

test('Inter resources are scoped to MJL browser documents and emitted once', async ({ page }) => {
  const stylesheet = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  let fontCssReferer = null;
  let fontFileReferer = null;
  await page.route('https://fonts.googleapis.com/**', async (route) => {
    fontCssReferer = route.request().headers().referer || '';
    await route.fulfill({
      contentType: 'text/css',
      headers: { 'cache-control': 'no-store' },
      body: '@font-face{font-family:Inter;font-style:normal;font-weight:400 700;src:url(https://fonts.gstatic.com/s/inter/mjl-test.woff2) format("woff2")}',
    });
  });
  await page.route('https://fonts.gstatic.com/**', async (route) => {
    fontFileReferer = route.request().headers().referer || '';
    await route.fulfill({ contentType: 'font/woff2', body: '' });
  });
  const expectInterHead = async () => {
    await expect(page.locator(`link[rel="stylesheet"][href="${stylesheet}"]`)).toHaveCount(1);
    await expect(page.locator('link[rel="preconnect"][href="https://fonts.googleapis.com"]')).toHaveCount(1);
    await expect(page.locator('link[rel="preconnect"][href="https://fonts.gstatic.com"][crossorigin]')).toHaveCount(1);
  };

  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/custom/mjlfinancement/invitation.php?invite=token-value-must-not-leak');
  await expectInterHead();
  await expect.poll(() => fontFileReferer).not.toBeNull();
  expect(fontCssReferer).toBe('');
  expect(fontFileReferer).toMatch(/^https:\/\/fonts\.googleapis\.com\//);
  expect(fontFileReferer).not.toContain('token-value-must-not-leak');
  expect(fontFileReferer).not.toContain('/custom/mjlfinancement/');

  await page.goto('/index.php');
  await expectInterHead();

  fontCssReferer = null;
  fontFileReferer = null;
  await page.goto('/user/passwordforgotten.php?setnewpassword=1&mjlreset=token-value-must-not-leak');
  await expectInterHead();
  await expect.poll(() => fontCssReferer).not.toBeNull();
  await expect.poll(() => fontFileReferer).not.toBeNull();
  expect(fontCssReferer).toBe('');
  expect(fontFileReferer).toMatch(/^https:\/\/fonts\.googleapis\.com\//);
  expect(fontFileReferer).not.toContain('token-value-must-not-leak');

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/index.php');
  await expectInterHead();

  const authenticatedIndex = await page.request.get('/index.php', { maxRedirects: 0 });
  expect(await authenticatedIndex.text()).not.toContain('fonts.googleapis.com');

  for (const route of [
    '/custom/mjlfinancement/css/mjl_app.css.php',
    '/custom/mjlfinancement/js/native_guard.js.php',
    '/custom/mjlfinancement/documentdownload.php?type=expense&id=0',
  ]) {
    const response = await page.request.get(route);
    expect(await response.text(), route).not.toContain('fonts.googleapis.com');
  }

  await page.goto('/projet/index.php');
  await expect(page.locator(`link[href="${stylesheet}"]`)).toHaveCount(0);
});

test('MJL pages remain usable with the font CDN blocked', async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await expect(page.getByLabel('Identifiant')).toBeVisible();
  await expect(page.locator('.mjl-auth-page')).toHaveCSS('font-family', /Inter.*Arial.*Helvetica.*sans-serif/i);

  await login(page, 'admin.poc');
  await expect(page.locator('.mjl-workspace')).toHaveCSS('font-family', /Inter.*Arial.*Helvetica.*sans-serif/i);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('v3 visual roles render with the approved metrics and print behavior', async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());
  await page.goto('/index.php');

  await expect(page.locator('.mjl-auth-brand h1')).toHaveCSS('font-size', '24px');
  await expect(page.locator('.mjl-auth-brand h1')).toHaveCSS('font-weight', '700');
  await expect(page.locator('.mjl-auth-field label').first()).toHaveCSS('font-weight', '600');
  await expect(page.locator('.mjl-auth-link')).toHaveCSS('font-weight', '500');
  await expect(page.locator('.mjl-auth-field input').first()).toHaveCSS('border-radius', '10px');
  const authButton = page.locator('.mjl-auth-button');
  expect((await authButton.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await authButton.hover();
  await expect(authButton).toHaveCSS('background-color', 'rgb(18, 63, 98)');
  await page.mouse.down();
  expect(await authButton.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');
  await page.mouse.up();
  await authButton.evaluate((node) => { node.disabled = true; });
  await expect(authButton).toHaveCSS('background-color', 'rgb(227, 232, 235)');
  await expect(authButton).toHaveCSS('cursor', 'not-allowed');
  await authButton.evaluate((node) => { node.disabled = false; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(authButton).toHaveCSS('transition-duration', '0s');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'no-preference' });
  await page.locator('.mjl-auth-link').focus();
  await expect(page.locator('.mjl-auth-link')).toHaveCSS('outline-style', 'solid');
  await page.emulateMedia({ forcedColors: 'none' });

  await login(page, 'admin.poc');
  await expect(page.locator('.mjl-workspace h1')).toHaveCSS('font-size', '24px');
  await expect(page.locator('.mjl-workspace h1')).toHaveCSS('line-height', '32px');

  const badge = page.locator('.mjl-status-pill').first();
  await expect(badge).toHaveCSS('border-radius', '6px');
  expect((await badge.boundingBox()).height).toBeGreaterThanOrEqual(20);

  await page.goto('/custom/mjlfinancement/activities.php');
  const dataCell = page.locator('.mjl-operational-table tbody tr').first().locator('td').first();
  expect((await dataCell.boundingBox()).height).toBeGreaterThanOrEqual(40);

  await page.goto('/custom/mjlfinancement/documents.php');
  const nativeButton = page.locator('.mjl-module-shell .button').first();
  expect((await nativeButton.boundingBox()).height).toBeGreaterThanOrEqual(40);
  await expect(nativeButton).toHaveCSS('border-radius', '10px');

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.mjl-module-sidebar')).toHaveCSS('display', 'none');
});
