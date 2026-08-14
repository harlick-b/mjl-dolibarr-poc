const { test, expect } = require('@playwright/test');
const os = require('os');
const { verifyDisposableEnvironment } = require('../helpers/verify-disposable-environment');
const { MJL_REVIEW_WIDTHS } = require('../helpers/responsive-shell');
const { login, sql } = require('../helpers/mjl-test-runtime');

const outerTolerance = Number(process.env.MJL_MANUAL_ZOOM_OUTER_TOLERANCE || 16);
const reviewer = (process.env.MJL_MANUAL_ACCESSIBILITY_REVIEWER || '').trim();
const assistiveTechnology = (process.env.MJL_MANUAL_ACCESSIBILITY_ASSISTIVE_TECH || '').trim();
const reviewVerdict = (process.env.MJL_MANUAL_ACCESSIBILITY_VERDICT || '').trim().toLowerCase();
const reviewNotes = (process.env.MJL_MANUAL_ACCESSIBILITY_NOTES || '').trim();
const testPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
const reviewArchetypes = Object.freeze([
  { key: 'auth', label: 'authentification hors session', route: '/index.php', user: null },
  { key: 'home', label: 'accueil Agent de saisie', route: '/custom/mjlfinancement/index.php', user: 'phase1.a11y.agent' },
  { key: 'partners', label: 'liste de partenaires', route: '/custom/mjlfinancement/partners.php', user: 'phase1.a11y.agent' },
  { key: 'projects', label: 'liste de projets', route: '/custom/mjlfinancement/projects.php', user: 'phase1.a11y.agent' },
  { key: 'operation-types', label: 'types d’opération', route: '/custom/mjlfinancement/operationtypes.php', user: 'phase1.a11y.agent' },
  { key: 'activities', label: 'projection des activités', route: '/custom/mjlfinancement/activities.php', user: 'phase1.a11y.supervisor' },
  { key: 'audit-validator', label: 'audit Validateur', route: '/custom/mjlfinancement/workflowactions.php', user: 'phase1.a11y.validator' },
  { key: 'access-admin', label: 'utilisateurs et accès', route: '/custom/mjlfinancement/admin/access.php', user: 'admin' },
  { key: 'technical-admin', label: 'administration technique', route: '/admin/modules.php', user: 'admin' },
]);

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  verifyDisposableEnvironment();
  if (!reviewer || !assistiveTechnology || !reviewNotes || !['pass', 'fail'].includes(reviewVerdict)) {
    throw new Error('A signed manual review requires reviewer, assistive technology, non-empty notes, and MJL_MANUAL_ACCESSIBILITY_VERDICT=pass|fail.');
  }
  sql("DELETE r FROM llx_mjlfinancement_user_role r INNER JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login LIKE 'phase1.a11y.%'; DELETE FROM llx_user WHERE login LIKE 'phase1.a11y.%'; INSERT INTO llx_user (entity,login,lastname,firstname,email,pass_crypted,statut,admin,datec) SELECT 1,'phase1.a11y.agent','Accessibilite','Agent','phase1.a11y.agent@example.test',pass_crypted,1,0,NOW() FROM llx_user WHERE rowid=1; SET @agent=LAST_INSERT_ID(); INSERT INTO llx_mjlfinancement_user_role (entity,fk_user,role_code,is_active,date_start,source,date_creation) VALUES (1,@agent,'AGENT_SAISIE',1,NOW(),'manual_accessibility',NOW()); INSERT INTO llx_user (entity,login,lastname,firstname,email,pass_crypted,statut,admin,datec) SELECT 1,'phase1.a11y.supervisor','Accessibilite','Superviseur','phase1.a11y.supervisor@example.test',pass_crypted,1,0,NOW() FROM llx_user WHERE rowid=1; SET @supervisor=LAST_INSERT_ID(); INSERT INTO llx_mjlfinancement_user_role (entity,fk_user,role_code,is_active,date_start,source,date_creation) VALUES (1,@supervisor,'AGENT_VERIFICATEUR',1,NOW(),'manual_accessibility',NOW()); INSERT INTO llx_user (entity,login,lastname,firstname,email,pass_crypted,statut,admin,datec) SELECT 1,'phase1.a11y.validator','Accessibilite','Validateur','phase1.a11y.validator@example.test',pass_crypted,1,0,NOW() FROM llx_user WHERE rowid=1; SET @validator=LAST_INSERT_ID(); INSERT INTO llx_mjlfinancement_user_role (entity,fk_user,role_code,is_active,date_start,source,date_creation) VALUES (1,@validator,'VALIDATEUR_DEFINITIF',1,NOW(),'manual_accessibility',NOW());");
});

test.afterAll(() => {
  sql("DELETE r FROM llx_mjlfinancement_user_role r INNER JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login LIKE 'phase1.a11y.%'; DELETE FROM llx_user WHERE login LIKE 'phase1.a11y.%';");
});

async function recordCalibration(page, browser, targetWidth, zoomPercent, assertTargetOuterWidth) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    devicePixelRatio: window.devicePixelRatio,
    visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
  }));
  const evidence = {
    browser: browser.version(),
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    targetOuterWidth: targetWidth,
    zoomPercent,
    ...dimensions,
  };
  console.log(`MJL_ZOOM_EVIDENCE ${JSON.stringify(evidence)}`);
  if (assertTargetOuterWidth) {
    expect(Math.abs(dimensions.outerWidth - targetWidth), `100% outer-width calibration for ${targetWidth}px`).toBeLessThanOrEqual(outerTolerance);
  }
  return dimensions;
}

async function assertNavigationReflow(page, targetWidth, zoomPercent) {
  await expect(page.locator('header.mjl-page-header h1'), `${targetWidth}px at ${zoomPercent}%`).toBeVisible();
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${targetWidth}px outer width at real ${zoomPercent}% browser zoom`).toBeLessThanOrEqual(geometry.clientWidth);

  const trigger = page.getByRole('button', { name: 'Ouvrir le menu principal' });
  const sidebar = page.getByLabel('Menu module MJL');
  const isDrawerLayout = await page.evaluate(() => window.matchMedia('(max-width: 980px)').matches);
  if (isDrawerLayout) {
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(sidebar).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
    await expect(trigger).toBeFocused();
  } else {
    await expect(trigger).toBeHidden();
    await expect(sidebar).toBeVisible();
  }
}

async function openArchetype(page, archetype) {
  if (!archetype.user) {
    await page.goto('/user/logout.php').catch(() => {});
    await page.goto(archetype.route);
    return archetype.route;
  }
  await login(page, archetype.user, testPassword);
  await page.goto(archetype.route);
  return archetype.route;
}

async function recordCombination(page, archetype, route, targetWidth, zoomPercent) {
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  console.log(`MJL_ACCESSIBILITY_ACTION Review geometry, keyboard order, visible focus, announcements, and non-color meaning for ${archetype.label}; leave a visible focus target, then resume.`);
  await page.pause();
  const evidence = await page.evaluate(() => {
    const focus = document.activeElement;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      focusTag: focus ? focus.tagName : '',
      focusName: focus ? (focus.getAttribute('aria-label') || focus.textContent || focus.getAttribute('name') || '').trim().slice(0, 120) : '',
      focusVisible: Boolean(focus && focus.matches(':focus-visible')),
    };
  });
  const result = {
    archetype: archetype.key,
    label: archetype.label,
    route,
    targetWidth,
    zoomPercent,
    overflow: evidence.scrollWidth > evidence.clientWidth,
    result: reviewVerdict,
    reviewer,
    assistiveTechnology,
    notes: reviewNotes,
    ...evidence,
  };
  console.log(`MJL_ACCESSIBILITY_COMBINATION ${JSON.stringify(result)}`);
  expect(result.overflow, `${archetype.key} ${targetWidth}px ${zoomPercent}% overflow`).toBe(false);
  expect(result.focusVisible, `${archetype.key} ${targetWidth}px ${zoomPercent}% visible focus`).toBe(true);
  return result;
}

test('real application keyboard, focus, reflow, and Chromium zoom gate', async ({ page, browser }) => {
  await page.goto('/index.php');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await page.getByLabel('Identifiant').fill('mjl.accessibility.invalid');
  await page.getByLabel('Mot de passe').fill('invalid-password');
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.locator('[role="alert"][aria-live="assertive"]')).toBeVisible();
  await expect(page.getByLabel('Identifiant')).toBeFocused();
  console.log('MJL_AUTH_ERROR_ACTION Review the real neutral login error announcement and focus recovery, then resume.');
  await page.pause();

  let combinationCount = 0;
  const combinationResults = [];

  for (const targetWidth of MJL_REVIEW_WIDTHS) {
    await login(page, 'admin', testPassword);
    await page.goto('/custom/mjlfinancement/index.php');
    console.log(`MJL_ZOOM_ACTION Set real browser zoom to 100% (Ctrl+0), resize the browser OUTER width to ${targetWidth}px, then resume.`);
    await page.pause();
    const baseline = await recordCalibration(page, browser, targetWidth, 100, true);
    for (const archetype of reviewArchetypes) {
      const route = await openArchetype(page, archetype);
      if (archetype.key !== 'auth') await assertNavigationReflow(page, targetWidth, 100);
      combinationResults.push(await recordCombination(page, archetype, route, targetWidth, 100));
      combinationCount++;
    }

    await login(page, 'admin', testPassword);
    await page.goto('/custom/mjlfinancement/index.php');
    console.log(`MJL_ZOOM_ACTION Keep the physical browser-window size unchanged from the ${targetWidth}px 100% calibration, set real browser zoom to 200% with browser chrome, then resume.`);
    await page.pause();
    const zoomed = await recordCalibration(page, browser, targetWidth, 200, false);
    expect(zoomed.devicePixelRatio, `${targetWidth}px real zoom DPR change`).toBeGreaterThanOrEqual(baseline.devicePixelRatio * 1.8);
    const innerWidthRatio = zoomed.innerWidth / baseline.innerWidth;
    expect(Math.abs(innerWidthRatio - 0.5), `${targetWidth}px real 200% zoom half-width calibration`).toBeLessThanOrEqual(0.05);
    const physicalOuterRatio = (zoomed.outerWidth * zoomed.devicePixelRatio) / (baseline.outerWidth * baseline.devicePixelRatio);
    expect(physicalOuterRatio, `${targetWidth}px physical outer-width preservation`).toBeGreaterThanOrEqual(0.85);
    expect(physicalOuterRatio, `${targetWidth}px physical outer-width preservation`).toBeLessThanOrEqual(1.15);
    for (const archetype of reviewArchetypes) {
      const route = await openArchetype(page, archetype);
      if (archetype.key !== 'auth') await assertNavigationReflow(page, targetWidth, 200);
      combinationResults.push(await recordCombination(page, archetype, route, targetWidth, 200));
      combinationCount++;
    }
  }

  expect(combinationCount).toBe(90);

  const evidence = {
    status: reviewVerdict === 'pass' ? 'signed_pass' : 'signed_fail',
    reviewer,
    reviewedAt: new Date().toISOString(),
    browser: browser.version(),
    assistiveTechnology,
    notes: reviewNotes,
    archetypes: reviewArchetypes.map(({ key, label }) => ({ key, label })),
    zoomWidths: MJL_REVIEW_WIDTHS,
    zoomLevels: [100, 200],
    combinations: combinationResults,
  };
  console.log(`MJL_MANUAL_ACCESSIBILITY_EVIDENCE ${JSON.stringify(evidence)}`);
  expect(reviewVerdict, 'Le verdict humain signé doit être pass pour franchir le gate.').toBe('pass');
});
