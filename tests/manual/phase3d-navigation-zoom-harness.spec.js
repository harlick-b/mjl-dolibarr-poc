const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const os = require('os');
const { verifyDisposableComposeEnvironment } = require('../helpers/phase3d-prerequisite-isolation');
const { MJL_REVIEW_WIDTHS } = require('../helpers/responsive-shell');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const outerTolerance = Number(process.env.MJL_PHASE3D_ZOOM_OUTER_TOLERANCE || 16);

test.skip(process.env.MJL_PHASE3D_ZOOM_MANUAL !== '1', 'Set MJL_PHASE3D_ZOOM_MANUAL=1 for the real browser-zoom gate.');
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  verifyDisposableComposeEnvironment();
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'],
    { cwd: process.cwd(), env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
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
  console.log(`PHASE3D_ZOOM_EVIDENCE ${JSON.stringify(evidence)}`);
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

test('real Chromium 100% and 200% zoom reflow across Phase 3D review widths', async ({ page, browser }) => {
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill('admin.poc');
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();

  for (const targetWidth of MJL_REVIEW_WIDTHS) {
    console.log(`PHASE3D_ZOOM_ACTION Set real browser zoom to 100% (Ctrl+0), resize the browser OUTER width to ${targetWidth}px, then resume.`);
    await page.pause();
    const baseline = await recordCalibration(page, browser, targetWidth, 100, true);
    await assertNavigationReflow(page, targetWidth, 100);

    console.log(`PHASE3D_ZOOM_ACTION Keep the physical browser-window size unchanged from the ${targetWidth}px 100% calibration, set real browser zoom to 200% with browser chrome, then resume.`);
    await page.pause();
    const zoomed = await recordCalibration(page, browser, targetWidth, 200, false);
    expect(zoomed.devicePixelRatio, `${targetWidth}px real zoom DPR change`).toBeGreaterThanOrEqual(baseline.devicePixelRatio * 1.8);
    const innerWidthRatio = zoomed.innerWidth / baseline.innerWidth;
    expect(Math.abs(innerWidthRatio - 0.5), `${targetWidth}px real 200% zoom half-width calibration`).toBeLessThanOrEqual(0.05);
    const physicalOuterRatio = (zoomed.outerWidth * zoomed.devicePixelRatio) / (baseline.outerWidth * baseline.devicePixelRatio);
    expect(physicalOuterRatio, `${targetWidth}px physical outer-width preservation`).toBeGreaterThanOrEqual(0.85);
    expect(physicalOuterRatio, `${targetWidth}px physical outer-width preservation`).toBeLessThanOrEqual(1.15);
    await assertNavigationReflow(page, targetWidth, 200);
  }
});
