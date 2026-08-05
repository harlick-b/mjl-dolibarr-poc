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
    await expect(page.locator('meta[name="referrer"][content="same-origin"]')).toHaveCount(1);
    await expect(page.locator(`link[rel="stylesheet"][href="${stylesheet}"]`)).toHaveCount(1);
    await expect(page.locator('link[rel="preconnect"][href="https://fonts.googleapis.com"]')).toHaveCount(1);
    await expect(page.locator('link[rel="preconnect"][href="https://fonts.gstatic.com"][crossorigin]')).toHaveCount(1);
  };
  const expectSameOriginPolicy = (response) => {
    expect(response).not.toBeNull();
    expect(response.headers()['referrer-policy']).toBe('same-origin');
  };

  await page.goto('/user/logout.php').catch(() => {});
  const invitationResponse = await page.goto('/custom/mjlfinancement/invitation.php?invite=token-value-must-not-leak');
  expectSameOriginPolicy(invitationResponse);
  await expectInterHead();
  await expect.poll(() => fontFileReferer).not.toBeNull();
  expect(fontCssReferer).toBe('');
  expect(fontFileReferer).toMatch(/^https:\/\/fonts\.googleapis\.com\//);
  expect(fontFileReferer).not.toContain('token-value-must-not-leak');
  expect(fontFileReferer).not.toContain('/custom/mjlfinancement/');

  const loginResponse = await page.goto('/index.php');
  expectSameOriginPolicy(loginResponse);
  await expectInterHead();

  fontCssReferer = null;
  fontFileReferer = null;
  const resetResponse = await page.goto('/user/passwordforgotten.php?setnewpassword=1&mjlreset=token-value-must-not-leak');
  expectSameOriginPolicy(resetResponse);
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
  await expect(page.locator('.mjl-auth-brand h1')).toHaveCSS('line-height', '32px');
  await expect(page.locator('.mjl-auth-brand h1')).toHaveCSS('font-weight', '700');
  await expect(page.locator('.mjl-auth-field label').first()).toHaveCSS('font-weight', '600');
  const authLink = page.locator('.mjl-auth-link');
  await expect(authLink).toHaveCSS('font-weight', '500');
  await authLink.hover();
  await expect(authLink).toHaveCSS('color', 'rgb(22, 50, 79)');
  await page.mouse.down();
  await expect(authLink).toHaveCSS('text-decoration-thickness', '2px');
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect(page.locator('.mjl-auth-field input').first()).toHaveCSS('border-radius', '10px');
  const authButton = page.locator('.mjl-auth-button');
  expect((await authButton.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await authButton.hover();
  await expect(authButton).toHaveCSS('background-color', 'rgb(18, 63, 98)');
  await page.mouse.down();
  expect(await authButton.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await authButton.evaluate((node) => { node.disabled = true; });
  await expect(authButton).toHaveCSS('background-color', 'rgb(227, 232, 235)');
  await expect(authButton).toHaveCSS('cursor', 'not-allowed');
  await authButton.evaluate((node) => { node.disabled = false; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(authButton).toHaveCSS('transition-duration', '0s');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'no-preference' });
  await authButton.focus();
  await page.keyboard.press('Tab');
  await expect(authLink).toBeFocused();
  await expect(authLink).toHaveCSS('outline-style', 'solid');
  await page.emulateMedia({ forcedColors: 'none' });

  await login(page, 'admin.poc');
  await expect(page.locator('.mjl-workspace h1')).toHaveCSS('font-size', '24px');
  await expect(page.locator('.mjl-workspace h1')).toHaveCSS('line-height', '32px');

  const badge = page.locator('.mjl-status-pill').first();
  await expect(badge).toHaveCSS('border-radius', '6px');
  expect((await badge.boundingBox()).height).toBeGreaterThanOrEqual(20);

  await page.emulateMedia({ forcedColors: 'active' });
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toHaveCount(1);
  await expect(page.locator(':focus-visible')).toHaveCSS('outline-style', 'solid');
  await expect(badge).toHaveCSS('border-top-style', 'solid');
  await page.emulateMedia({ forcedColors: 'none' });

  const sidebarLink = page.locator('.mjl-sidebar-link').first();
  await sidebarLink.hover();
  await expect(sidebarLink).toHaveCSS('background-color', 'rgb(234, 243, 248)');
  await page.mouse.down();
  expect(await sidebarLink.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();

  const cardLink = page.locator('.mjl-card-link').first();
  await cardLink.hover();
  await expect(cardLink).toHaveCSS('text-decoration-line', 'underline');
  await page.mouse.down();
  await expect(cardLink).toHaveCSS('color', 'rgb(22, 50, 79)');
  await page.mouse.move(0, 0);
  await page.mouse.up();

  await page.locator('.mjl-workspace').evaluate((workspace) => {
    const card = document.createElement('a');
    card.className = 'mjl-nav-card';
    card.href = '#mjl-nav-card-contract';
    card.innerHTML = '<strong>Navigation test</strong><span>Contrat d’état v3</span>';
    workspace.appendChild(card);
  });
  const navigationCard = page.locator('.mjl-nav-card').first();
  await navigationCard.hover();
  await expect(navigationCard).toHaveCSS('background-color', 'rgb(234, 243, 248)');
  await page.mouse.down();
  expect(await navigationCard.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();

  await page.setViewportSize({ width: 980, height: 844 });
  const fineTrigger = page.getByRole('button', { name: 'Ouvrir le menu principal' });
  await expect.poll(() => page.evaluate(() => window.matchMedia('(any-pointer: fine)').matches)).toBe(true);
  expect((await fineTrigger.boundingBox()).height).toBe(32);
  await fineTrigger.hover();
  await page.mouse.down();
  expect(await fineTrigger.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();

  await page.goto('/custom/mjlfinancement/projects.php');
  const interactiveRow = page.locator('.mjl-operational-table tbody tr.mjl-row-interactive').first();
  await expect(interactiveRow).toBeVisible();
  expect(await interactiveRow.evaluate((node) => ({
    role: node.getAttribute('role'),
    tabindex: node.getAttribute('tabindex'),
    onclick: node.getAttribute('onclick'),
  }))).toEqual({ role: null, tabindex: null, onclick: null });
  const interactiveStatusCell = interactiveRow.locator('td[data-label="Statut"]');
  expect((await interactiveStatusCell.boundingBox()).height).toBeGreaterThanOrEqual(44);
  const openProject = interactiveRow.getByRole('link', { name: 'Ouvrir', exact: true });
  await openProject.focus();
  await expect(openProject).toBeFocused();
  const projectActions = interactiveRow.locator('.mjl-table-action-menu > summary');
  await projectActions.focus();
  await expect(projectActions).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  expect((await interactiveStatusCell.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 980, height: 844 });

  await page.goto('/custom/mjlfinancement/activities.php');
  const dataCell = page.locator('.mjl-operational-table tbody tr').first().locator('td[data-label="Statut"]');
  expect((await dataCell.boundingBox()).height).toBeGreaterThanOrEqual(40);

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  const activityControl = page.locator('.mjl-activity-form input:not([type="hidden"]), .mjl-activity-form select').first();
  await expect(activityControl).toBeVisible();
  expect((await activityControl.boundingBox()).height).toBeGreaterThanOrEqual(40);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/reports.php');
  const reportControl = page.locator('.mjl-report-filter-bar :is(input, select), .mjl-report-selector select').first();
  expect((await reportControl.boundingBox()).height).toBeGreaterThanOrEqual(40);

  await page.goto('/custom/mjlfinancement/documents.php');
  const nativeButton = page.locator('.mjl-module-shell .button').first();
  expect((await nativeButton.boundingBox()).height).toBeGreaterThanOrEqual(40);
  await expect(nativeButton).toHaveCSS('border-radius', '10px');

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.mjl-module-sidebar')).toHaveCSS('display', 'none');

  const coarseContext = await page.context().browser().newContext({
    baseURL: process.env.MJL_BASE_URL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 980, height: 844 },
  });
  try {
    const coarsePage = await coarseContext.newPage();
    await login(coarsePage, 'admin.poc');
    await expect.poll(() => coarsePage.evaluate(() => window.matchMedia('(any-pointer: coarse)').matches)).toBe(true);
    const coarseTrigger = coarsePage.getByRole('button', { name: 'Ouvrir le menu principal' });
    expect((await coarseTrigger.boundingBox()).height).toBeGreaterThanOrEqual(44);
  } finally {
    await coarseContext.close();
  }
});
