const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

const baseURL = process.env.MJL_BASE_URL || 'http://127.0.0.1:8080';
const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const stylesheet = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

async function platformFonts(page, selector) {
  const session = await page.context().newCDPSession(page);
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument');
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  await session.detach();
  return fonts.map((font) => font.familyName);
}

async function login(page) {
  await page.goto(`${baseURL}/index.php`);
  await page.getByLabel('Identifiant').fill('admin.poc');
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

async function main() {
  const browser = await chromium.launch();
  try {
    const livePage = await browser.newPage();
    await livePage.goto(`${baseURL}/index.php`);
    assert.equal(await livePage.locator(`link[href="${stylesheet}"]`).count(), 1);
    await livePage.evaluate(() => document.fonts.ready);

    const weightSelectors = {
      '.mjl-auth-brand p': '400',
      '.mjl-auth-link': '500',
      '.mjl-auth-field label': '600',
      '.mjl-auth-brand h1': '700',
    };
    for (const [selector, weight] of Object.entries(weightSelectors)) {
      assert.equal(await livePage.locator(selector).first().evaluate((node) => getComputedStyle(node).fontWeight), weight);
      assert.ok((await platformFonts(livePage, selector)).includes('Inter'), `${selector} did not render with Inter`);
    }
    await livePage.locator('.mjl-auth-button').focus();
    const focusStyle = await livePage.locator('.mjl-auth-button').evaluate((node) => ({
      boxShadow: getComputedStyle(node).boxShadow,
      outlineColor: getComputedStyle(node).outlineColor,
    }));
    assert.notEqual(focusStyle.boxShadow, 'none');
    assert.equal(focusStyle.outlineColor, 'rgb(255, 255, 255)');

    await login(livePage);
    await livePage.goto(`${baseURL}/custom/mjlfinancement/projects.php`);
    const fineSummary = livePage.locator('.mjl-table-action-menu > summary').first();
    assert.ok((await fineSummary.boundingBox()).height >= 32);

    const fallbackPage = await browser.newPage();
    await fallbackPage.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());
    await fallbackPage.goto(`${baseURL}/index.php`);
    await fallbackPage.evaluate(() => document.fonts.ready);
    assert.ok(!(await platformFonts(fallbackPage, '.mjl-auth-brand h1')).includes('Inter'));
    await login(fallbackPage);
    await fallbackPage.getByRole('heading', { level: 1 }).waitFor();

    const touchContext = await browser.newContext({
      baseURL,
      hasTouch: true,
      viewport: { width: 1024, height: 900 },
    });
    const touchPage = await touchContext.newPage();
    await touchPage.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());
    await login(touchPage);
    await touchPage.goto('/custom/mjlfinancement/projects.php');
    assert.ok((await touchPage.locator('.mjl-table-action-menu > summary').first().boundingBox()).height >= 44);
    await touchPage.goto('/custom/mjlfinancement/documents.php');
    assert.ok((await touchPage.locator('.mjl-module-shell .button').first().boundingBox()).height >= 44);
    await touchContext.close();

    process.stdout.write('MJL Inter live font and blocked-CDN fallback evidence: OK\n');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
