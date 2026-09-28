const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const host = process.env.MJL_BASE_URL || 'http://127.0.0.1:8080';

test('shared controls keep field identity, modal focus and native submitter data', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(host + '/index.php');
    await page.setContent('<form id="form"><dialog id="modal"><label for="start">Date</label><input id="start" data-mjl-date name="date_start" type="date" required><label for="partner">Partenaire</label><select id="partner" data-mjl-select name="partner_id"><option value="">Choisir</option><option value="1">Test</option></select><button type="submit" name="action" value="create_submit">Soumettre</button></dialog></form>');
    const libs = [
      '/includes/jquery/js/jquery.min.js',
      '/includes/jquery/js/jquery-ui.min.js',
      '/includes/jquery/plugins/select2/dist/js/select2.full.min.js'
    ];
    for (const lib of libs) await page.addScriptTag({ url: host + lib });
    await page.addScriptTag({ path: path.join(root, 'custom/mjlfinancement/js/mjl_form_controls.js') });
    await page.evaluate(() => { document.querySelector('#modal').showModal(); window.MjlUi.init(document); });
    assert.equal(await page.locator('#start').count(), 1);
    assert.equal(await page.locator('[name=date_start]').count(), 1);
    assert.equal(await page.locator('#start').getAttribute('type'), 'text');
    await page.locator('#start').fill('31/02/2032');
    assert.equal(await page.locator('[name=date_start]').inputValue(), '');
    assert.equal(await page.locator('#start').evaluate((node) => node.validity.customError), true);
    await page.locator('#start').fill('29/02/2032');
    assert.equal(await page.locator('[name=date_start]').inputValue(), '2032-02-29');
    await page.getByRole('button', { name: 'Choisir une date dans le calendrier' }).click();
    assert.equal(await page.locator('#modal .ui-datepicker').isVisible(), true);
    await page.locator('#modal .ui-datepicker-calendar td[data-handler="selectDay"] a').first().click();
    assert.match(await page.locator('[name=date_start]').inputValue(), /^2032-02-\d{2}$/);
    await page.getByRole('button', { name: 'Choisir une date dans le calendrier' }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#modal .ui-datepicker').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Choisir une date dans le calendrier' }).evaluate((node) => document.activeElement === node), true);
    await page.locator('#partner + .select2').click();
    assert.equal(await page.locator('#modal .select2-dropdown').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.MjlUi.init(document));
    assert.equal(await page.locator('#modal .select2-container').count(), 1);
    const formData = await page.evaluate(() => {
      const form = document.querySelector('#form');
      const submitter = form.querySelector('[name=action]');
      return [...new FormData(form, submitter).entries()];
    });
    assert.match(formData[0][1], /^2032-02-\d{2}$/);
    assert.deepEqual(formData.slice(1), [['partner_id', ''], ['action', 'create_submit']]);
    await page.evaluate(() => window.MjlUi.destroy(document.querySelector('#modal')));
    assert.equal(await page.locator('#start').getAttribute('type'), 'date');
    assert.equal(await page.locator('#modal .select2-container').count(), 0);
  } finally {
    await browser.close();
  }
});

test('Activity rows clone before enhancement and preview exact amounts', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(host + '/index.php');
    await page.setContent('<form><select id="partner" data-mjl-select name="partner_id"><option value="">Choisir</option><option value="1">Partenaire un</option></select><select name="project_id"><option value="">Choisir</option><option value="2" data-partner-id="1">Projet un</option></select><input id="activity-start" data-mjl-date type="date" name="date_start" value="2032-01-01"><input id="activity-end" data-mjl-date type="date" name="date_end" value="2032-12-31"><p data-budget-guidance></p><button type="submit" name="action" value="create_draft">Brouillon</button><button type="submit" name="action" value="create_submit">Soumettre</button><input name="authorized_amount" value="9007199254740993"><div data-operation-list><div data-operation-row><h3 data-operation-number></h3><input type="hidden" name="operation_key[]" value="op-0"><input type="hidden" name="operation_id[]" value="7"><input type="hidden" name="operation_version[]" value="3"><input name="operation_name[]" value="Initial"><select data-mjl-select name="operation_type_id[]"><option value="">Choisir</option><option value="1">Type</option></select><input name="operation_amount[]" value="9007199254740992"><button type="button" data-remove-operation>Retirer</button></div></div><button type="button" data-add-operation>Ajouter</button><dd data-activity-total></dd><dd data-operation-total></dd><dd data-difference></dd></form>');
    for (const lib of ['/includes/jquery/js/jquery.min.js', '/includes/jquery/js/jquery-ui.min.js', '/includes/jquery/plugins/select2/dist/js/select2.full.min.js']) await page.addScriptTag({ url: host + lib });
    for (const script of ['mjl_financial_preview.js', 'mjl_form_controls.js', 'activities.js']) await page.addScriptTag({ path: path.join(root, 'custom/mjlfinancement/js', script) });
    await page.evaluate(() => window.MjlUi.init(document));
    assert.equal(await page.locator('[data-difference]').textContent(), '1 F CFA');
    await page.locator('#partner + .select2').click();
    await page.getByRole('option', { name: 'Partenaire un', exact: true }).click();
    assert.equal(await page.locator('[name=project_id] option[value="2"]').count(), 1);
    await page.evaluate(() => document.querySelector('form').addEventListener('submit', (event) => {
      window.blocked = event.defaultPrevented;
      event.preventDefault();
    }));
    await page.getByRole('button', { name: 'Brouillon', exact: true }).click();
    assert.equal(await page.evaluate(() => window.blocked), false);
    await page.getByRole('button', { name: 'Soumettre', exact: true }).click();
    assert.equal(await page.evaluate(() => window.blocked), true);
    await page.locator('#activity-end').fill('01/01/2031');
    await page.getByRole('button', { name: 'Brouillon', exact: true }).click();
    assert.equal(await page.locator('#activity-end').evaluate((node) => node === document.activeElement), true);
    await page.locator('#activity-end').fill('31/02/2032');
    assert.equal(await page.locator('#activity-end').evaluate((node) => node.validity.customError), true);
    await page.locator('#activity-end').fill('31/12/2032');
    await page.locator('[data-add-operation]').click();
    assert.equal(await page.locator('[data-operation-row]').count(), 2);
    assert.equal(await page.locator('[data-operation-row] .select2-container').count(), 2);
    assert.equal(await page.locator('[data-operation-row]').last().locator('[name="operation_id[]"]').inputValue(), '');
    await page.locator('[data-operation-row]').last().locator('[name="operation_amount[]"]').fill('0');
    assert.equal(await page.locator('[data-difference]').textContent(), '1 F CFA');
    await page.locator('[data-operation-row]').last().locator('[data-remove-operation]').click();
    assert.equal(await page.locator('[data-operation-row]').count(), 1);
    assert.equal(await page.locator('[data-operation-row] .select2-container').count(), 1);
    await page.locator('[data-operation-row] [name="operation_amount[]"]').fill('');
    assert.equal(await page.locator('[data-difference]').textContent(), 'Non renseigné');
  } finally {
    await browser.close();
  }
});

test('existing submit guard preserves the clicked action during serialization', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<form data-mjl-substantive><input name="name" value="Test"><button type="submit" name="action" value="create_draft">Brouillon</button><button type="submit" name="action" value="create_submit">Soumettre</button></form>');
    await page.addScriptTag({ path: path.join(root, 'custom/mjlfinancement/js/mjl_components.js') });
    await page.evaluate(() => {
      document.dispatchEvent(new Event('DOMContentLoaded'));
      const form = document.querySelector('form');
      form.addEventListener('submit', (event) => {
        window.submitted = [...new FormData(form, event.submitter).entries()];
        window.selectedDisabled = event.submitter.disabled;
        event.preventDefault();
      });
    });
    await page.getByRole('button', { name: 'Soumettre' }).click();
    assert.deepEqual(await page.evaluate(() => window.submitted), [['name', 'Test'], ['action', 'create_submit']]);
    assert.equal(await page.evaluate(() => window.selectedDisabled), false);
  } finally {
    await browser.close();
  }
});
