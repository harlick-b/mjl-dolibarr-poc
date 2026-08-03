const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const { verifyDisposableEnvironment } = require('../../helpers/verify-disposable-environment');
const { assertNoHorizontalOverflow } = require('../../helpers/responsive-shell');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

function renderedContrast(first, second) {
  const channels = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const luminance = (value) => {
    const rgb = channels(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]);
  };
  const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test.describe.configure({ mode: 'serial' });

function dockerCompose(args) {
  return execFileSync('docker', ['compose', ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.waitForLoadState('domcontentloaded');
}

test.beforeAll(() => {
  verifyDisposableEnvironment();
});

test('responsive navigation drawer preserves fallback, focus, and background isolation', async ({ browser, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'admin.poc');

  const trigger = page.getByRole('button', { name: 'Ouvrir le menu principal' });
  const sidebar = page.getByLabel('Menu module MJL');
  const main = page.locator('#mjl-main-content');

  const skipLink = page.getByRole('link', { name: 'Aller au contenu principal' });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(main).toBeFocused();

  await page.evaluate(() => {
    const preserved = document.createElement('button');
    preserved.id = 'mjl-preexisting-inert-control';
    preserved.setAttribute('inert', '');
    preserved.textContent = 'Contrôle déjà inerte';
    document.body.appendChild(preserved);
  });

  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-controls', 'mjl-primary-navigation');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(sidebar).toBeHidden();

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(sidebar).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/mjl-navigation-open/);
  await expect(main).toHaveAttribute('inert', '');
  await expect(main).toHaveAttribute('data-mjl-navigation-inert', '');
  await expect(trigger).toHaveAttribute('inert', '');
  await expect(page.locator('#mjl-preexisting-inert-control')).toHaveAttribute('inert', '');
  await expect(page.locator('#mjl-preexisting-inert-control')).not.toHaveAttribute('data-mjl-navigation-inert', '');
  await expect(sidebar.getByRole('link', { name: 'Tableau de bord' })).toBeFocused();
  const exposedOutsideBranches = await page.evaluate(() => {
    const sidebarElement = document.querySelector('#mjl-primary-navigation');
    const backdropElement = document.querySelector('[data-mjl-navigation-backdrop]');
    const exposed = [];
    const inspect = (root) => {
      Array.from(root.children).forEach((child) => {
        if (child === sidebarElement || child === backdropElement) return;
        if (child.contains(sidebarElement) || child.contains(backdropElement)) inspect(child);
        else if (!child.hasAttribute('inert')) exposed.push(child.tagName + (child.id ? `#${child.id}` : ''));
      });
    };
    inspect(document.body);
    return exposed;
  });
  expect(exposedOutsideBranches).toEqual([]);

  await page.evaluate(() => {
    window.mjlOutsideActivations = 0;
    const outside = document.createElement('button');
    outside.id = 'mjl-dynamic-outside-control';
    outside.textContent = 'Contrôle externe dynamique';
    outside.style.cssText = 'position: fixed; right: 8px; top: 8px; width: 44px; height: 44px; z-index: 1;';
    outside.addEventListener('click', () => { window.mjlOutsideActivations += 1; });
    document.body.appendChild(outside);
  });
  const outsideControl = page.locator('#mjl-dynamic-outside-control');
  await expect(outsideControl).toHaveAttribute('inert', '');
  await expect(outsideControl).toHaveAttribute('data-mjl-navigation-inert', '');
  await sidebar.locator('a[href]').first().evaluate((link) => link.addEventListener('click', (event) => event.preventDefault(), { once: true }));
  await outsideControl.evaluate((element) => element.focus());
  await expect(sidebar.getByRole('link', { name: 'Tableau de bord' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.mjlOutsideActivations)).toBe(0);
  await expect(sidebar).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(outsideControl).not.toHaveAttribute('inert', '');
  await expect(outsideControl).not.toHaveAttribute('data-mjl-navigation-inert', '');
  await expect(page.locator('#mjl-preexisting-inert-control')).toHaveAttribute('inert', '');

  await trigger.click();
  await expect(outsideControl).toHaveAttribute('inert', '');
  await expect(outsideControl).toHaveAttribute('data-mjl-navigation-inert', '');
  const closeButton = sidebar.getByRole('button', { name: 'Fermer le menu' });
  const lastLink = sidebar.locator('a[href]').last();
  await closeButton.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(lastLink).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();

  await closeButton.click();
  await expect(sidebar).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(outsideControl).not.toHaveAttribute('inert', '');
  await expect(page.locator('#mjl-preexisting-inert-control')).toHaveAttribute('inert', '');

  await page.evaluate(() => {
    const closedDynamic = document.createElement('button');
    closedDynamic.id = 'mjl-closed-state-dynamic-control';
    closedDynamic.textContent = 'Contrôle ajouté menu fermé';
    document.body.appendChild(closedDynamic);
    return new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  });
  const closedStateControl = page.locator('#mjl-closed-state-dynamic-control');
  await expect(closedStateControl).not.toHaveAttribute('inert', '');
  await expect(closedStateControl).not.toHaveAttribute('data-mjl-navigation-inert', '');

  await trigger.click();
  await expect(outsideControl).toHaveAttribute('inert', '');
  await expect(closedStateControl).toHaveAttribute('inert', '');
  await expect(closedStateControl).toHaveAttribute('data-mjl-navigation-inert', '');
  await page.keyboard.press('Escape');
  await expect(sidebar).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await expect(main).not.toHaveAttribute('inert', '');
  await expect(main).not.toHaveAttribute('data-mjl-navigation-inert', '');
  await expect(outsideControl).not.toHaveAttribute('inert', '');
  await expect(outsideControl).not.toHaveAttribute('data-mjl-navigation-inert', '');
  await expect(closedStateControl).not.toHaveAttribute('inert', '');
  await expect(closedStateControl).not.toHaveAttribute('data-mjl-navigation-inert', '');
  await expect(page.locator('#mjl-preexisting-inert-control')).toHaveAttribute('inert', '');

  await trigger.click();
  await expect(outsideControl).toHaveAttribute('inert', '');
  const outsideBox = await outsideControl.boundingBox();
  expect(outsideBox).not.toBeNull();
  await page.mouse.click(outsideBox.x + (outsideBox.width / 2), outsideBox.y + (outsideBox.height / 2));
  await expect(sidebar).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.mjlOutsideActivations)).toBe(0);
  await expect(outsideControl).not.toHaveAttribute('inert', '');
  await expect(page.locator('#mjl-preexisting-inert-control')).toHaveAttribute('inert', '');

  await trigger.click();
  await page.evaluate(() => {
    const dynamic = document.createElement('button');
    dynamic.id = 'mjl-second-dynamic-outside-control';
    dynamic.textContent = 'Deuxième contrôle externe';
    document.body.appendChild(dynamic);
  });
  const secondOutsideControl = page.locator('#mjl-second-dynamic-outside-control');
  await expect(secondOutsideControl).toHaveAttribute('inert', '');
  await expect(secondOutsideControl).toHaveAttribute('data-mjl-navigation-inert', '');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(trigger).toBeHidden();
  await expect(sidebar).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/mjl-navigation-open/);
  await expect(main).not.toHaveAttribute('inert', '');
  await expect(outsideControl).not.toHaveAttribute('inert', '');
  await expect(secondOutsideControl).not.toHaveAttribute('inert', '');
  await expect(secondOutsideControl).not.toHaveAttribute('data-mjl-navigation-inert', '');
  await expect(page.locator('#mjl-preexisting-inert-control')).toHaveAttribute('inert', '');

  const desktopLink = sidebar.getByRole('link', { name: 'Rapports' });
  await desktopLink.focus();
  await expect(desktopLink).toBeFocused();
  const visibleFocus = await desktopLink.evaluate((element) => {
    const link = getComputedStyle(element);
    let surfaceElement = element.parentElement;
    let surface = 'rgba(0, 0, 0, 0)';
    while (surfaceElement && surface === 'rgba(0, 0, 0, 0)') {
      surface = getComputedStyle(surfaceElement).backgroundColor;
      surfaceElement = surfaceElement.parentElement;
    }
    return {
      foreground: link.color,
      outline: link.outlineColor,
      outlineStyle: link.outlineStyle,
      outlineWidth: parseFloat(link.outlineWidth),
      surface,
    };
  });
  expect(visibleFocus.outlineStyle).not.toBe('none');
  expect(visibleFocus.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(renderedContrast(visibleFocus.outline, visibleFocus.surface)).toBeGreaterThanOrEqual(3);
  expect(renderedContrast(visibleFocus.foreground, visibleFocus.surface)).toBeGreaterThanOrEqual(4.5);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sidebar).toBeHidden();
  await expect(trigger).toBeFocused();

  await assertNoHorizontalOverflow(page, { label: 'page width' });

  for (const desktopWidth of [1024, 1366]) {
    const zoomedCssWidth = Math.floor(desktopWidth / 2);
    await page.setViewportSize({ width: zoomedCssWidth, height: 844 });
    await expect(trigger, `${desktopWidth}px supplemental half-width reflow check`).toBeVisible();
    await expect(sidebar).toBeHidden();
    await expect(page.locator('header.mjl-page-header h1')).toBeVisible();
    const reflowOverflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      reflowOverflow.scrollWidth,
      `${desktopWidth}px supplemental half-width reflow check`,
    ).toBeLessThanOrEqual(reflowOverflow.clientWidth);
  }

  const noJsContext = await browser.newContext({
    baseURL: process.env.MJL_BASE_URL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const noJsPage = await noJsContext.newPage();
  await login(noJsPage, 'admin.poc');
  await expect(noJsPage.getByRole('button', { name: 'Ouvrir le menu principal' })).toBeHidden();
  await expect(noJsPage.getByLabel('Menu module MJL')).toBeVisible();
  await noJsContext.close();

  const touchContext = await browser.newContext({
    baseURL: process.env.MJL_BASE_URL,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const touchPage = await touchContext.newPage();
  await login(touchPage, 'admin.poc');
  const touchTrigger = touchPage.getByRole('button', { name: 'Ouvrir le menu principal' });
  const touchSidebar = touchPage.getByLabel('Menu module MJL');
  await touchTrigger.tap();
  await expect(touchSidebar).toBeVisible();
  const touchTargets = await touchSidebar.locator('a, button').evaluateAll((elements) =>
    elements.filter((element) => getComputedStyle(element).display !== 'none').map((element) => element.getBoundingClientRect().height));
  expect(Math.min(...touchTargets)).toBeGreaterThanOrEqual(44);
  await touchSidebar.getByRole('button', { name: 'Fermer le menu' }).tap();
  await expect(touchSidebar).toBeHidden();
  await expect(touchTrigger).toBeFocused();
  await touchContext.close();
});

test('reduced-motion preference removes drawer transitions without breaking focus restoration', async ({ browser }) => {
  const reducedMotionContext = await browser.newContext({
    baseURL: process.env.MJL_BASE_URL,
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await reducedMotionContext.newPage();
    await login(page, 'admin.poc');
    await expect.poll(() => page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

    const trigger = page.getByRole('button', { name: 'Ouvrir le menu principal' });
    const sidebar = page.getByLabel('Menu module MJL');
    await expect(sidebar).toHaveCSS('transition-duration', '0s');
    await trigger.click();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Tableau de bord' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
    await expect(trigger).toBeFocused();
  } finally {
    await reducedMotionContext.close();
  }
});

test('navigation is role-projected and exposes one current location', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 844 });
  await login(page, 'admin.poc');

  const nav = page.getByLabel('Menu module MJL');
  await expect(nav.getByRole('heading', { name: 'Pilotage' })).toBeVisible();
  await expect(nav.getByRole('heading', { name: 'Administration' })).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php?report=audit');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);
  await expect(nav.locator('[aria-current]')).toBeVisible();

  await login(page, 'agent.mjl');
  await expect(nav.getByRole('heading', { name: 'Administration' })).toHaveCount(0);
  await expect(nav.locator('a').first()).toBeVisible();
});
