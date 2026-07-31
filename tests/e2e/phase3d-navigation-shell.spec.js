const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const { verifyDisposableComposeEnvironment } = require('../helpers/phase3d-prerequisite-isolation');
const { assertNoHorizontalOverflow } = require('../helpers/responsive-shell');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

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
  verifyDisposableComposeEnvironment();
  dockerCompose(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
  dockerCompose(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php']);
});

test('responsive navigation drawer preserves fallback, focus, and background isolation', async ({ browser, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'admin.poc');

  const trigger = page.getByRole('button', { name: 'Ouvrir le menu principal' });
  const sidebar = page.getByLabel('Menu module MJL');
  const main = page.locator('#mjl-main-content');

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

test('canonical navigation remains role-projected and exact-path active', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 844 });
  await login(page, 'admin.poc');

  const nav = page.getByLabel('Menu module MJL');
  await expect(nav.getByRole('heading', { name: 'Pilotage' })).toBeVisible();
  await expect(nav.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Rapports' })).toHaveCount(1);
  await expect(nav.locator('a[href="/custom/mjlfinancement/reports.php"]')).toHaveCount(1);
  await expect(nav.getByRole('link', { name: /Liste des|Bibliothèque|Alertes activités|Alertes dépenses/ })).toHaveCount(0);

  await page.goto('/custom/mjlfinancement/reports.php?report=audit');
  await expect(nav.getByRole('link', { name: 'Rapports' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);

  await page.goto('/custom/mjlfinancement/exchangelogs.php');
  await expect(nav.getByRole('link', { name: 'Historique / Audit' })).toHaveAttribute('aria-current', 'location');
  await expect(nav.getByRole('link', { name: 'Échanges' })).toHaveCount(0);

  await login(page, 'agent.mjl');
  await expect(nav.getByRole('heading', { name: 'Administration' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Partenaires / Programmes' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Activités' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Dépenses / Décaissements' })).toBeVisible();
});

test('migrated page headers render corrected French accents and apostrophes', async ({ page }) => {
  await login(page, 'admin.poc');
  const cases = [
    {
      route: '/custom/mjlfinancement/index.php',
      description: 'Suivre les activités, les validations, les alertes et les accès sans exposer la complexité Dolibarr.',
    },
    {
      route: '/custom/mjlfinancement/alerts.php',
      description: 'Identifier les risques de délai, les décisions attendues et les pièces manquantes dans votre périmètre.',
      context: 'Périmètre',
    },
    {
      route: '/custom/mjlfinancement/documents.php',
      description: 'Consulter les documents accessibles sans ouvrir l’ECM natif Dolibarr.',
      context: 'Bibliothèque',
    },
    {
      route: '/custom/mjlfinancement/dpafdashboard.php',
      title: 'Tableau de supervision financière',
      description: 'Suivre les risques, les revues en attente, les budgets, les fonds et les dernières décisions auditées.',
      context: 'Accès',
    },
    {
      route: '/custom/mjlfinancement/partners.php',
      description: 'Consulter les périmètres MJL représentés par les tiers Dolibarr actifs.',
    },
    {
      route: '/custom/mjlfinancement/projects.php',
      description: 'Consulter les projets suivis dans l’espace MJL sans ouvrir l’interface native Dolibarr.',
    },
    {
      route: '/custom/mjlfinancement/reports.php',
      title: 'Centre d’exports MJL',
    },
  ];

  for (const expected of cases) {
    await page.goto(expected.route);
    const header = page.locator('header.mjl-page-header');
    if (expected.title) await expect(header.locator('h1'), expected.route).toHaveText(expected.title);
    if (expected.description) await expect(header.locator('.mjl-page-header-description'), expected.route).toHaveText(expected.description);
    if (expected.context) await expect(header.locator('dt'), expected.route).toHaveText(expected.context);
  }

  const detailRoutes = [
    {
      list: '/custom/mjlfinancement/activities.php',
      link: page.getByRole('table', { name: 'Activités du périmètre' }).getByRole('link', { name: 'Ouvrir' }).first(),
    },
    {
      list: '/custom/mjlfinancement/expenses.php',
      link: page.locator('.mjl-dashboard-table a.mjl-table-link').first(),
    },
    {
      list: '/custom/mjlfinancement/budgetlines.php',
      link: page.locator('a.mjl-table-link').first(),
    },
    {
      list: '/custom/mjlfinancement/conventions.php',
      link: page.locator('a.mjl-table-link').first(),
    },
  ];
  const unaccentedHeaderWords = /\b(?:activite|depense|piece|prevalidation|definitive|verifier|budgetaire|verrouilles|recalcules|autorisees|donnees|operations|cloturee)\b|\bl (?:activite|avancement|enveloppe|historique)\b/i;
  for (const detail of detailRoutes) {
    await page.goto(detail.list);
    await detail.link.click();
    const description = await page.locator('header.mjl-page-header .mjl-page-header-description').innerText();
    expect(description, detail.list).toMatch(/[àâçéèêëîïôûùüÿœ’]/u);
    expect(description, detail.list).not.toMatch(unaccentedHeaderWords);
  }
});

test('production roles receive the exact canonical navigation leaves', async ({ page }) => {
  const expectedLeaves = {
    'agent.mjl': [
      'Tableau de bord', 'Alertes', 'Projets', 'Activités',
      'Dépenses / Décaissements', 'Documents',
    ],
    'superviseur.n1': [
      'Tableau de bord', 'Alertes', 'Projets', 'Activités',
      'Dépenses / Décaissements', 'Documents', 'Historique des validations',
    ],
    'dpaf.mjl': [
      'Tableau de bord', 'Alertes', 'Supervision financière', 'Projets',
      'Activités', 'Dépenses / Décaissements', 'Documents',
      'Enveloppes de financement', 'Lignes budgétaires', 'Fonds reçus',
      'Historique des validations', 'Rapports', 'Historique / Audit',
    ],
    'admin.poc': [
      'Tableau de bord', 'Alertes', 'Supervision financière', 'Projets',
      'Activités', 'Dépenses / Décaissements', 'Documents',
      'Enveloppes de financement', 'Lignes budgétaires', 'Fonds reçus',
      'Historique des validations', 'Rapports', 'Historique / Audit',
      'Partenaires / Programmes', 'Utilisateurs et accès',
    ],
  };

  for (const [username, labels] of Object.entries(expectedLeaves)) {
    await login(page, username);
    const links = page.getByLabel('Menu module MJL').locator('a.mjl-sidebar-link');
    await expect(links.first(), username).toBeVisible();
    const renderedLabels = await links.allTextContents();
    expect(renderedLabels.map((label) => label.trim()), username).toEqual(labels);
  }
});

test('desktop sidebar is edge-attached, stable, and fills the available workspace height', async ({ page }) => {
  await login(page, 'admin.poc');

  for (const width of [1024, 1366]) {
    await page.setViewportSize({ width, height: 768 });
    const geometry = await page.evaluate(() => {
      const shell = document.querySelector('.mjl-module-shell');
      const sidebar = document.querySelector('.mjl-module-sidebar');
      const main = document.querySelector('.mjl-module-main');
      const sidebarRect = sidebar.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const style = window.getComputedStyle(sidebar);
      return {
        sidebarLeft: Math.round(sidebarRect.left),
        sidebarWidth: Math.round(sidebarRect.width),
        sidebarBottom: Math.round(sidebarRect.bottom),
        mainLeft: Math.round(mainRect.left),
        viewportHeight: window.innerHeight,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        position: style.position,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        shellOverflow: shell.scrollWidth - shell.clientWidth,
      };
    });

    expect(Math.abs(geometry.sidebarLeft), `${width}px left edge`).toBeLessThanOrEqual(1);
    expect(geometry.sidebarWidth, `${width}px stable width`).toBe(256);
    expect(geometry.sidebarBottom, `${width}px available height`).toBeGreaterThanOrEqual(geometry.viewportHeight);
    expect(
      geometry.mainLeft - geometry.sidebarLeft - geometry.sidebarWidth,
      `${width}px sidebar-to-main gap`,
    ).toBe(24);
    expect(geometry.borderRadius).toBe('0px');
    expect(geometry.boxShadow).toBe('none');
    expect(geometry.position).toBe('sticky');
    expect(geometry.pageOverflow).toBeLessThanOrEqual(0);
    expect(geometry.shellOverflow).toBeLessThanOrEqual(0);
  }
});
