const { test, expect } = require('@playwright/test');
const os = require('os');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test('headed User/QA calibration and partial-result harness', async ({ page, browser }) => {
  test.skip(process.env.MJL_PHASE2_MANUAL !== '1', 'Set MJL_PHASE2_MANUAL=1 for the signed manual gate.');

  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill('admin.poc');
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.goto('/custom/mjlfinancement/alerts.php');

  await page.locator('main, [role="main"], body').first().evaluate((container) => {
    const harness = document.createElement('div');
    harness.id = 'mjl-phase2-manual-partial-result';
    harness.className = 'mjl-system-state mjl-system-state-partial-error';
    harness.setAttribute('role', 'alert');
    harness.innerHTML = '<strong>Résultats partiels</strong><p>Certaines sources ne sont pas disponibles. Les résultats chargés restent consultables.</p>';
    container.prepend(harness);
  });

  const calibration = {
    browser: browser.version(),
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    innerWidth: await page.evaluate(() => window.innerWidth),
    innerHeight: await page.evaluate(() => window.innerHeight),
    outerWidth: await page.evaluate(() => window.outerWidth),
    outerHeight: await page.evaluate(() => window.outerHeight),
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
  };
  console.log(`PHASE2_MANUAL_CALIBRATION ${JSON.stringify(calibration)}`);
  console.log('Record this window with browser chrome. Use the evidence sheet, real browser zoom, and Playwright Inspector to navigate the complete matrix.');

  await expect(page.locator('#mjl-phase2-manual-partial-result')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#mjl-phase2-manual-partial-result')).toContainText('Résultats partiels');
  await page.pause();
});
