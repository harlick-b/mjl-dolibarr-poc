const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { verifyDisposableEnvironment } = require('../helpers/verify-disposable-environment');
const { MJL_REVIEW_WIDTHS } = require('../helpers/responsive-shell');
const { login } = require('../helpers/mjl-test-runtime');
const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { createPhase2FixtureSet } = require('../helpers/phase2-fixture');

const outerTolerance = Number(process.env.MJL_MANUAL_ZOOM_OUTER_TOLERANCE || 16);
const reviewer = (process.env.MJL_MANUAL_ACCESSIBILITY_REVIEWER || '').trim();
const assistiveTechnology = (process.env.MJL_MANUAL_ACCESSIBILITY_ASSISTIVE_TECH || '').trim();
const reviewVerdict = (process.env.MJL_MANUAL_ACCESSIBILITY_VERDICT || '').trim().toLowerCase();
const reviewNotes = (process.env.MJL_MANUAL_ACCESSIBILITY_NOTES || '').trim();
const keyboardFindings = (process.env.MJL_MANUAL_ACCESSIBILITY_KEYBOARD_FINDINGS || '').trim();
const screenReaderFindings = (process.env.MJL_MANUAL_ACCESSIBILITY_SCREEN_READER_FINDINGS || '').trim();
const frenchReview = (process.env.MJL_MANUAL_ACCESSIBILITY_FRENCH_REVIEW || '').trim().toLowerCase();
const testPassword = process.env.MJL_TEST_USER_PASSWORD;
const adminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
let activityDraftId = 0;
let activityReviewId = 0;
const reviewArchetypes = Object.freeze([
  { key: 'auth', label: 'authentification hors session', route: '/index.php', user: null },
  { key: 'home', label: 'accueil Agent de saisie', route: '/custom/mjlfinancement/index.php', user: 'phase1.a11y.agent' },
  { key: 'partners', label: 'liste de partenaires', route: '/custom/mjlfinancement/partners.php', user: 'phase1.a11y.agent' },
  { key: 'projects', label: 'liste de projets', route: '/custom/mjlfinancement/projects.php', user: 'phase1.a11y.agent' },
  { key: 'operation-types', label: 'types d’opération', route: '/custom/mjlfinancement/operationtypes.php', user: 'phase1.a11y.agent' },
  { key: 'activity-list', label: 'liste des Activités', route: '/custom/mjlfinancement/activities.php', user: 'rst006a.a11y.agent' },
  { key: 'activity-create', label: 'création d’Activité', route: '/custom/mjlfinancement/activities.php?action=create', user: 'rst006a.a11y.agent' },
  { key: 'activity-detail', label: 'détail d’Activité', route: () => `/custom/mjlfinancement/activities.php?id=${activityDraftId}`, user: 'rst006a.a11y.agent' },
  { key: 'activity-edit', label: 'modification d’Activité', route: () => `/custom/mjlfinancement/activities.php?id=${activityDraftId}&action=edit`, user: 'rst006a.a11y.agent' },
  { key: 'activity-review', label: 'examen d’une révision d’Activité', route: () => `/custom/mjlfinancement/activities.php?id=${activityReviewId}&action=review`, user: 'rst006a.a11y.supervisor' },
  { key: 'operations', label: 'liste des Opérations', route: '/custom/mjlfinancement/operations.php', user: 'rst006a.a11y.agent' },
  { key: 'audit-validator', label: 'audit Validateur', route: '/custom/mjlfinancement/workflowactions.php', user: 'phase1.a11y.validator' },
  { key: 'access-admin', label: 'utilisateurs et accès', route: '/custom/mjlfinancement/admin/access.php', user: 'admin' },
  { key: 'technical-admin', label: 'administration technique', route: '/admin/modules.php', user: 'admin' },
]);

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  verifyDisposableEnvironment();
  if (!reviewer || !assistiveTechnology || !reviewNotes || !keyboardFindings || !screenReaderFindings || frenchReview !== 'pass' || !['pass', 'fail'].includes(reviewVerdict)) {
    throw new Error('A signed manual review requires reviewer, assistive technology, keyboard and screen-reader findings, French review=pass, notes, and verdict=pass|fail.');
  }
  createPhase1FixtureSet({
    namespace: 'phase1.a11y', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: { partners: [], projects: [], operationTypes: [] },
  });
  const planningFixture = createPhase2FixtureSet({
    namespace: 'rst006a.a11y', entity: 1,
    users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'agent2', role: 'AGENT_SAISIE' }, { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire accessibilité' }],
      projects: [{ key: 'project', label: 'Projet accessibilité', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type accessibilité' }],
    },
    activities: [
      { key: 'draft', agentKey: 'agent', additionalAgentKeys: ['agent2'], submit: false, partnerKey: 'partner', projectKey: 'project', name: 'Activité accessibilité', description: 'Vérification manuelle complète', dateStart: '2032-01-01', dateEnd: '2032-12-31', authorizedAmount: '1000', operations: [{ name: 'Opération accessible', typeKey: 'type', authorizedAmount: '1000' }] },
      { key: 'review', agentKey: 'agent', submit: true, partnerKey: 'partner', projectKey: 'project', name: 'Activité accessibilité soumise', description: 'Vérification manuelle complète', dateStart: '2032-01-01', dateEnd: '2032-12-31', authorizedAmount: '1000', operations: [{ name: 'Opération accessible soumise', typeKey: 'type', authorizedAmount: '1000' }] },
    ],
  });
  activityDraftId = Number(planningFixture.activities.draft?.activity_id || 0);
  activityReviewId = Number(planningFixture.activities.review?.activity_id || 0);
  if (!activityDraftId || !activityReviewId) throw new Error('Phase 2 manual fixture creation failed.');
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
  const targetRoute = typeof archetype.route === 'function' ? archetype.route() : archetype.route;
  if (!archetype.user) {
    await page.goto('/user/logout.php').catch(() => {});
    await page.goto(targetRoute);
    return targetRoute;
  }
  await login(page, archetype.user, archetype.user === 'admin' ? adminPassword : testPassword);
  await page.goto(targetRoute);
  return targetRoute;
}

async function recordCombination(page, archetype, route, targetWidth, zoomPercent) {
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  console.log(`MJL_ACCESSIBILITY_ACTION Review geometry, keyboard order, visible focus, announcements, forced colors, reduced motion, and non-color meaning for ${archetype.label}; leave a visible focus target, then resume.`);
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
  let forcedColors = false;
  let reducedMotion = false;
  if (archetype.key.startsWith('activity-') || archetype.key === 'operations') {
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    forcedColors = await page.evaluate(() => window.matchMedia('(forced-colors: active)').matches);
    reducedMotion = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
  }
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
    keyboardFindings,
    screenReaderFindings,
    frenchReview,
    notes: reviewNotes,
    forcedColors,
    reducedMotion,
    ...evidence,
  };
  console.log(`MJL_ACCESSIBILITY_COMBINATION ${JSON.stringify(result)}`);
  expect(result.overflow, `${archetype.key} ${targetWidth}px ${zoomPercent}% overflow`).toBe(false);
  expect(result.focusVisible, `${archetype.key} ${targetWidth}px ${zoomPercent}% visible focus`).toBe(true);
  if (archetype.key.startsWith('activity-') || archetype.key === 'operations') {
    expect(result.forcedColors, `${archetype.key} forced-colors`).toBe(true);
    expect(result.reducedMotion, `${archetype.key} reduced-motion`).toBe(true);
  }
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
    await login(page, 'admin', adminPassword);
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

    await login(page, 'admin', adminPassword);
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

  expect(reviewArchetypes).toHaveLength(14);
  expect(combinationCount).toBe(140);

  const evidence = {
    status: reviewVerdict === 'pass' ? 'signed_pass' : 'signed_fail',
    reviewer,
    reviewedAt: new Date().toISOString(),
    browser: browser.version(),
    assistiveTechnology,
    keyboardFindings,
    screenReaderFindings,
    frenchReview,
    notes: reviewNotes,
    archetypes: reviewArchetypes.map(({ key, label }) => ({ key, label })),
    zoomWidths: MJL_REVIEW_WIDTHS,
    zoomLevels: [100, 200],
    combinations: combinationResults,
  };
  const canonical = `${JSON.stringify(evidence)}\n`;
  const payloadSha256 = crypto.createHash('sha256').update(canonical).digest('hex');
  const signedArtifact = { version: 1, unit: 'PHASE-2', reviewer, payload_sha256: payloadSha256, evidence };
  if (!process.env.MJL_EVIDENCE_ROOT) throw new Error('Private accessibility evidence root is missing.');
  const evidenceRoot = path.resolve(process.env.MJL_EVIDENCE_ROOT);
  fs.mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  const rootStat = fs.lstatSync(evidenceRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (rootStat.mode & 0o777) !== 0o700) throw new Error('Private accessibility evidence root custody is invalid.');
  const evidencePath = path.join(evidenceRoot, `phase2-manual-accessibility-${payloadSha256}.json`);
  fs.writeFileSync(evidencePath, `${JSON.stringify(signedArtifact, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  expect(fs.statSync(evidencePath).mode & 0o777).toBe(0o600);
  console.log(`MJL_MANUAL_ACCESSIBILITY_ARTIFACT ${JSON.stringify({ evidencePath, payloadSha256, reviewer })}`);
  expect(reviewVerdict, 'Le verdict humain signé doit être pass pour franchir le gate.').toBe('pass');
});
