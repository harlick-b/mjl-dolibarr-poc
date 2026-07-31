const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const { verifyDisposableComposeEnvironment } = require('../helpers/phase3d-prerequisite-isolation');

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
}

test.beforeAll(() => {
  verifyDisposableComposeEnvironment();
  dockerCompose(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
  dockerCompose(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php']);
});

test('project creation uses an authorized dedicated presentation state', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');

  const listHeader = page.locator('header.mjl-page-header');
  const createAction = listHeader.getByRole('link', { name: 'Créer un projet' });
  await expect(createAction).toBeVisible();
  await expect(createAction).toHaveAttribute('href', '/custom/mjlfinancement/projects.php?action=create');
  await expect(page.locator('form[data-mjl-form="project-create"]')).toHaveCount(0);

  await createAction.click();
  await expect(page).toHaveURL(/projects\.php\?action=create$/);
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Créer un projet');
  await expect(page.locator('form[data-mjl-form="project-create"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', '/custom/mjlfinancement/projects.php');

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/projects.php');
  await expect(page.locator('header.mjl-page-header').getByRole('link', { name: 'Créer un projet' })).toHaveCount(0);
  const denied = await page.goto('/custom/mjlfinancement/projects.php?action=create');
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="project-create"]')).toHaveCount(0);
  await expect(page.locator('select[name="fk_soc"]')).toHaveCount(0);
});

test('project editing uses an authorized dedicated presentation state', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');

  const projectLink = page.getByRole('link', { name: 'PRJ-JE-2026' }).first();
  const projectHref = await projectLink.getAttribute('href');
  expect(projectHref).toMatch(/^\/custom\/mjlfinancement\/projects\.php\?id=\d+$/);
  await projectLink.click();

  const detailHeader = page.locator('header.mjl-page-header');
  const editAction = detailHeader.getByRole('link', { name: 'Modifier le projet' });
  await expect(editAction).toBeVisible();
  await expect(editAction).toHaveAttribute('href', `${projectHref}&action=edit`);
  await expect(page.locator('form[data-mjl-form="project-update"]')).toHaveCount(0);

  await editAction.click();
  await expect(page).toHaveURL(new RegExp(`${projectHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}&action=edit$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Modifier le projet PRJ-JE-2026');
  await expect(page.locator('form[data-mjl-form="project-update"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', projectHref);

  await login(page, 'agent.mjl');
  await page.goto(projectHref);
  await expect(page.locator('header.mjl-page-header').getByRole('link', { name: 'Modifier le projet' })).toHaveCount(0);
  const denied = await page.goto(`${projectHref}&action=edit`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="project-update"]')).toHaveCount(0);
  await expect(page.locator('select[name="fk_soc"]')).toHaveCount(0);
});

test('project edit recovery stays on the guarded edit state and is consumed once', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');

  const projectHref = await page.getByRole('link', { name: 'PRJ-JE-2026' }).first().getAttribute('href');
  await page.goto(`${projectHref}&action=edit`);
  const form = page.locator('form[data-mjl-form="project-update"]');
  const originalTitle = await form.locator('input[name="title"]').inputValue();
  const response = await page.request.post(projectHref, {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'update',
      id: await form.locator('input[name="id"]').inputValue(),
      ref: await form.locator('input[name="ref"]').inputValue(),
      title: '',
      fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
      fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
      description: 'Phase 3D edit recovery',
    },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toContain('action=edit');
  expect(location).toMatch(/mjl_recovery=[a-f0-9]{32}/);

  await page.goto(location);
  await expect(form.locator('textarea[name="description"]')).toHaveValue('Phase 3D edit recovery');
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('Corrigez');
  await expect(form.locator('a[href="#mjl-project-update-title"]')).toBeVisible();

  await page.reload();
  await expect(form.locator('input[name="title"]')).toHaveValue(originalTitle);
  await expect(form.locator('textarea[name="description"]')).not.toHaveValue('Phase 3D edit recovery');
});

test('project filters use the shared presentation and retain applied state', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');

  const filters = page.locator('form[data-mjl-table-filters="projects"]');
  await expect(filters).toHaveAttribute('aria-label', 'Filtres des projets');
  await expect(filters.locator('.mjl-filter-summary')).toHaveText('Aucun filtre actif.');
  await filters.getByLabel('Partenaire / Programme').selectOption({ label: 'UNICEF' });
  await filters.getByLabel('Statut').selectOption('1');
  await filters.getByLabel('Trier par').selectOption('recent');
  await filters.getByRole('button', { name: 'Appliquer' }).click();

  await expect(page).toHaveURL(/projects\.php\?partner=\d+&status=1&sort=recent$/);
  await expect(filters.getByLabel('Partenaire / Programme')).toHaveValue(/^[1-9]\d*$/);
  await expect(filters.getByLabel('Statut')).toHaveValue('1');
  await expect(filters.getByLabel('Trier par')).toHaveValue('recent');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Partenaire / Programme : UNICEF');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Statut : Ouvert');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Trier par : Plus récents');
  await expect(filters.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', '/custom/mjlfinancement/projects.php');

  await expect(page.locator('nav[aria-label="Pagination des projets"] [aria-current="page"]')).toHaveText(/Page 1/);
});

test('activity filters and pagination use the same shared presentation', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');

  const filters = page.locator('form[data-mjl-table-filters="activities"]');
  await expect(filters).toHaveAttribute('aria-label', 'Filtres des activités');
  await expect(filters.locator('.mjl-filter-summary')).toHaveText('Aucun filtre actif.');
  await filters.getByLabel('Risque échéance').selectOption('overdue');
  await filters.getByLabel('Trier par').selectOption('recent');
  await filters.getByRole('button', { name: 'Appliquer' }).click();

  const appliedUrl = new URL(page.url());
  expect(appliedUrl.searchParams.get('risk')).toBe('overdue');
  expect(appliedUrl.searchParams.get('sort')).toBe('recent');
  await expect(filters.getByLabel('Risque échéance')).toHaveValue('overdue');
  await expect(filters.getByLabel('Trier par')).toHaveValue('recent');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Risque échéance : En retard');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Trier par : Plus récentes');
  await expect(filters.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', '/custom/mjlfinancement/activities.php');

  await expect(page.locator('nav[aria-label="Pagination des activités"] [aria-current="page"]')).toHaveText(/Page 1/);
});

test('expense filters and pagination use the same shared presentation', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/expenses.php');

  const filters = page.locator('form[data-mjl-table-filters="expenses"]');
  await expect(filters).toHaveAttribute('aria-label', 'Filtres des dépenses');
  await expect(filters.locator('.mjl-filter-summary')).toHaveText('Aucun filtre actif.');
  const projectValue = await filters.getByLabel('Projet').locator('option', { hasText: 'PRJ-JE-2026' }).getAttribute('value');
  await filters.getByLabel('Projet').selectOption(projectValue);
  await filters.getByLabel('Trier par').selectOption('amount');
  await filters.getByRole('button', { name: 'Appliquer' }).click();

  const appliedUrl = new URL(page.url());
  expect(appliedUrl.searchParams.get('project')).toMatch(/^[1-9]\d*$/);
  expect(appliedUrl.searchParams.get('sort')).toBe('amount');
  await expect(filters.getByLabel('Projet')).toHaveValue(/^[1-9]\d*$/);
  await expect(filters.getByLabel('Trier par')).toHaveValue('amount');
  await expect(filters.locator('.mjl-filter-summary')).toContainText(/Projet : .*PRJ-JE-2026/);
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Trier par : Montant décroissant');
  await expect(filters.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', '/custom/mjlfinancement/expenses.php');

  await expect(page.locator('nav[aria-label="Pagination des dépenses"] [aria-current="page"]')).toHaveText(/Page 1/);
});

test('shared operational filters reflow without local overflow at review widths', async ({ page }) => {
  await login(page, 'agent.mjl');
  for (const [route, resource] of [
    ['/custom/mjlfinancement/projects.php', 'projects'],
    ['/custom/mjlfinancement/activities.php', 'activities'],
    ['/custom/mjlfinancement/expenses.php', 'expenses'],
  ]) {
    await page.goto(route);
    const filters = page.locator(`form[data-mjl-table-filters="${resource}"]`);
    for (const width of [390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(filters).toBeVisible();
      const geometry = await filters.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(geometry.scrollWidth, `${resource} filters at ${width}px`).toBeLessThanOrEqual(geometry.clientWidth);
      await expect(filters.locator('.mjl-filter-summary')).toBeVisible();
    }
  }
});
