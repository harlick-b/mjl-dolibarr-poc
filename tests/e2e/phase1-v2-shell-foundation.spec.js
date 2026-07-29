const { test, expect } = require('@playwright/test');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

function contrastRatio(firstHex, secondHex) {
  const luminance = (hex) => {
    const channels = hex.replace('#', '').match(/.{2}/g).map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  };
  const values = [luminance(firstHex), luminance(secondHex)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('workspace exposes skip access and the exact current navigation location', async ({ page }) => {
  await login(page, 'admin.poc');

  const skipLink = page.getByRole('link', { name: 'Aller au contenu principal' });
  await expect(skipLink).toHaveAttribute('href', '#mjl-main-content');
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.locator('#mjl-main-content')).toBeFocused();

  await expect(page.getByRole('link', { name: /Tableau de bord/ })).toHaveAttribute('aria-current', 'page');

  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('link', { name: 'Rapports / Exports' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: /Supervision/ }).first()).not.toHaveAttribute('aria-current', 'page');
});

test('role dashboards retain one exact current location and unresolved access fails closed', async ({ page }) => {
  for (const username of ['agent.mjl', 'superviseur.n1', 'dpaf.mjl', 'admin.poc']) {
    await login(page, username);
    const currentLinks = page.getByLabel('Menu module MJL').locator('[aria-current="page"]');
    await expect(currentLinks, username).toHaveCount(1);
    await expect(currentLinks, username).toHaveText(/Tableau de bord/);
  }

  await login(page, 'lecteur.audit');
  await expect(page.getByLabel('Menu module MJL')).toHaveCount(0);
  await expect(page.locator('body')).toContainText(/Accès refusé|Non autorisé|Forbidden/);
});

test('workspace keeps focus visible and navigation usable across review widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/reports.php');

  const currentLink = page.getByRole('link', { name: 'Rapports / Exports' });
  await currentLink.focus();
  await expect(currentLink).toBeFocused();

  const focusStyle = await currentLink.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(focusStyle).toEqual({
    color: 'rgb(22, 79, 122)',
    style: 'solid',
    width: '2px',
  });

  const navigationTargets = await page.getByLabel('Menu module MJL').locator('a').evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
  expect(Math.min(...navigationTargets)).toBeGreaterThanOrEqual(44);

  for (const width of [390, 768, 1024, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.locator('.mjl-module-shell').evaluate((shell) => ({
      clientWidth: shell.clientWidth,
      scrollWidth: shell.scrollWidth,
    }));
    expect(overflow.scrollWidth, `${width}px review width`).toBeLessThanOrEqual(overflow.clientWidth);
    if (width <= 768) {
      const targetHeights = await page.getByLabel('Menu module MJL').locator('a').evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
      expect(Math.min(...targetHeights), `${width}px touch targets`).toBeGreaterThanOrEqual(44);
    }
  }
});

test('semantic action and focus tokens resolve to approved contrast pairs', async ({ page }) => {
  await login(page, 'admin.poc');
  const tokens = await page.locator('.mjl-module-shell').evaluate((shell) => {
    const style = window.getComputedStyle(shell);
    return {
      action: style.getPropertyValue('--mjl-color-action').trim(),
      focus: style.getPropertyValue('--mjl-focus-ring').trim(),
      inverse: style.getPropertyValue('--mjl-color-text-inverse').trim(),
      surface: style.getPropertyValue('--mjl-color-surface').trim(),
    };
  });

  expect(tokens).toEqual({
    action: '#164f7a',
    focus: '#164f7a',
    inverse: '#ffffff',
    surface: '#ffffff',
  });
  expect(contrastRatio(tokens.action, tokens.inverse)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(tokens.focus, tokens.surface)).toBeGreaterThanOrEqual(3);
});

test('shared page headers and touched shell labels use consistent French semantics', async ({ page }) => {
  await login(page, 'admin.poc');

  const dashboardHeader = page.locator('header.mjl-workspace-header');
  await expect(dashboardHeader).toBeVisible();
  await expect(dashboardHeader.locator('#mjl-page-title')).toHaveText('Tableau de bord MJL');

  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByLabel('Menu module MJL').getByRole('link', { name: 'Accès utilisateurs' })).toBeVisible();

  await page.goto('/custom/mjlfinancement/activities.php');
  const activityHeader = page.locator('header.mjl-workspace-header');
  await expect(activityHeader).toBeVisible();
  await expect(activityHeader.locator('#mjl-page-title')).toHaveText('Suivi des activités et décisions');
  await expect(activityHeader).toContainText('Périmètre');
});

test('primary sections share the page-header contract and contextual audit location', async ({ page }) => {
  await login(page, 'admin.poc');

  const representativeRoutes = [
    '/custom/mjlfinancement/index.php',
    '/custom/mjlfinancement/partners.php',
    '/custom/mjlfinancement/projects.php',
    '/custom/mjlfinancement/activities.php',
    '/custom/mjlfinancement/expenses.php',
    '/custom/mjlfinancement/documents.php',
    '/custom/mjlfinancement/conventions.php',
    '/custom/mjlfinancement/dpafdashboard.php',
    '/custom/mjlfinancement/admin/access.php',
  ];
  for (const route of representativeRoutes) {
    await page.goto(route);
    const header = page.locator('header.mjl-workspace-header');
    await expect(header, route).toHaveCount(1);
    await expect(header.locator('h1'), route).toBeVisible();
  }

  await page.goto('/custom/mjlfinancement/exchangelogs.php');
  await expect(page.getByRole('link', { name: /Supervision/ }).first()).toHaveAttribute('aria-current', 'location');
  await expect(page.getByLabel('Menu module MJL').getByRole('link', { name: /Échanges/ })).toHaveCount(0);
});

test('forbidden shell presents one clear and keyboard-visible safe return action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'admin.poc');
  const response = await page.goto('/projet/index.php');
  expect(response.status()).toBe(403);

  const returnAction = page.getByRole('link', { name: 'Retour au tableau de bord' });
  await expect(returnAction).toBeVisible();
  await returnAction.focus();

  const actionStyle = await returnAction.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      minHeight: style.minHeight,
      outlineColor: style.outlineColor,
    };
  });
  expect(actionStyle).toEqual({
    backgroundColor: 'rgb(22, 79, 122)',
    color: 'rgb(255, 255, 255)',
    minHeight: '44px',
    outlineColor: 'rgb(22, 79, 122)',
  });

  await returnAction.click();
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expect(page.getByLabel('Menu module MJL')).toBeVisible();
});
