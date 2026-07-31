const { expect } = require('@playwright/test');

const MJL_REVIEW_WIDTHS = Object.freeze([390, 768, 980, 1024, 1366]);

async function assertNoHorizontalOverflow(page, options = {}) {
  const {
    height = 844,
    scope = 'document',
    afterResize = async () => {},
    label = 'review width',
  } = options;

  for (const width of MJL_REVIEW_WIDTHS) {
    await page.setViewportSize({ width, height });
    await afterResize(width);
    const geometry = scope === 'document'
      ? await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      : await page.locator(scope).evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
    expect(geometry.scrollWidth, `${width}px ${label}`).toBeLessThanOrEqual(geometry.clientWidth);
  }
}

module.exports = { MJL_REVIEW_WIDTHS, assertNoHorizontalOverflow };
