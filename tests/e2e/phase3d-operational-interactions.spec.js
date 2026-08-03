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

function scalar(sql) {
  return dockerCompose(['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-N', '-e', sql]).trim();
}

function executeSql(sql) {
  dockerCompose(['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e', sql]);
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
  await expect(page.locator('header.mjl-page-header')).toContainText('Statut actuel');
  await expect(page.locator('header.mjl-page-header')).toContainText('Ouvert');
  await expect(page.locator('form[data-mjl-form="project-update"]')).toBeVisible();
  await expect(page.getByLabel('Référence')).toBeVisible();
  await expect(page.getByLabel('Intitulé')).toBeVisible();
  await expect(page.locator('form[data-mjl-form="project-update"]')).toHaveAttribute('data-mjl-substantive', '');
  await expect(page.locator('form[data-mjl-form="project-update"]')).toHaveAttribute('data-mjl-validate', '');
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
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
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
  await expect(form.locator('select[name="fk_soc"]')).not.toHaveValue('');
  await expect(form.locator('select[name="fk_statut"]')).toHaveValue('1');
  await expect(form).toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('Corrigez');
  await expect(form.locator('a[href="#mjl-project-update-title"]')).toBeVisible();

  await form.getByRole('link', { name: 'Annuler' }).click();
  const unsavedDialog = page.getByRole('dialog', { name: 'Modifications non enregistrées' });
  await expect(unsavedDialog).toBeVisible();
  await unsavedDialog.getByRole('button', { name: 'Continuer la saisie' }).click();

  await page.reload();
  await expect(form.locator('input[name="title"]')).toHaveValue(originalTitle);
  await expect(form.locator('textarea[name="description"]')).not.toHaveValue('Phase 3D edit recovery');
});

test('project recovery rejects injected aliases and invalid or stale selections', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  let form = page.locator('form[data-mjl-form="project-create"]');
  const partnerOptions = form.locator('select[name="fk_soc"] option:not([value=""])');
  const validPartner = await partnerOptions.first().getAttribute('value');
  const injectedPartner = await partnerOptions.nth(1).getAttribute('value');
  let response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'create',
      ref: 'P3D-ALIAS-INJECTION',
      title: '',
      fk_soc: validPartner,
      fk_statut: '0',
      partner_scope: injectedPartner,
      project_status: '1',
    },
    maxRedirects: 0,
  });
  await page.goto(response.headers().location);
  form = page.locator('form[data-mjl-form="project-create"]');
  await expect(form.locator('select[name="fk_soc"]')).toHaveValue(validPartner);
  await expect(form.locator('select[name="fk_statut"]')).toHaveValue('0');

  response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'create',
      ref: 'P3D-INVALID-ENUM',
      title: '',
      fk_soc: validPartner,
      fk_statut: '2',
    },
    maxRedirects: 0,
  });
  await page.goto(response.headers().location);
  form = page.locator('form[data-mjl-form="project-create"]');
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('Le statut sélectionné n’est pas reconnu.');
  await expect(form.locator('select[name="fk_statut"]')).toHaveValue('1');

  response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'create',
      ref: 'P3D-STALE-PARTNER',
      title: '',
      fk_soc: validPartner,
      fk_statut: '0',
    },
    maxRedirects: 0,
  });
  try {
    executeSql(`UPDATE llx_societe SET status = 0 WHERE entity = 1 AND rowid = ${Number(validPartner)}`);
    await page.goto(response.headers().location);
    form = page.locator('form[data-mjl-form="project-create"]');
    await expect(form.locator('input[name="ref"]')).toHaveValue('P3D-STALE-PARTNER');
    await expect(form.locator('select[name="fk_soc"]')).toHaveValue('');
    await expect(form.locator('select[name="fk_statut"]')).toHaveValue('0');
  } finally {
    executeSql(`UPDATE llx_societe SET status = 1 WHERE entity = 1 AND rowid = ${Number(validPartner)}`);
  }
});

test('substantive project forms focus invalid input, warn on dirty navigation, and lock duplicate submits', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.addInitScript(() => {
    const nativeAdd = window.addEventListener;
    const nativeRemove = window.removeEventListener;
    window.__mjlBeforeUnload = { added: 0, removed: 0 };
    window.addEventListener = function (type, listener, options) {
      if (type === 'beforeunload') window.__mjlBeforeUnload.added += 1;
      return nativeAdd.call(this, type, listener, options);
    };
    window.removeEventListener = function (type, listener, options) {
      if (type === 'beforeunload') window.__mjlBeforeUnload.removed += 1;
      return nativeRemove.call(this, type, listener, options);
    };
  });
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  const form = page.locator('form[data-mjl-form="project-create"]');
  await expect(form.getByRole('button', { name: 'Créer le projet' })).toBeVisible();

  await form.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(form.locator('[data-mjl-error-summary]')).toBeFocused();
  expect(await page.evaluate(() => window.__mjlBeforeUnload)).toEqual({ added: 0, removed: 0 });

  const title = form.getByLabel('Intitulé');
  await title.fill('Brouillon temporaire');
  await form.locator('a[href="#mjl-project-create-ref"]').click();
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toBeHidden();
  expect((await page.evaluate(() => window.__mjlBeforeUnload)).added).toBe(1);
  await form.getByRole('link', { name: 'Annuler' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifications non enregistrées' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Continuer la saisie' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Quitter sans enregistrer' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Continuer la saisie' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(form.getByRole('link', { name: 'Annuler' })).toBeFocused();

  await form.getByRole('link', { name: 'Annuler' }).click();
  await dialog.getByRole('button', { name: 'Continuer la saisie' }).click();

  await title.fill('');
  expect((await page.evaluate(() => window.__mjlBeforeUnload)).removed).toBe(1);
  await form.getByRole('link', { name: 'Annuler' }).click();
  await expect(page).toHaveURL(/projects\.php$/);

  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  const leaveForm = page.locator('form[data-mjl-form="project-create"]');
  await leaveForm.getByLabel('Intitulé').fill('Quitter explicitement');
  await leaveForm.evaluate((element) => {
    ['download', 'new-tab', 'modified'].forEach((kind) => {
      const link = document.createElement('a');
      link.href = '/custom/mjlfinancement/projects.php';
      link.textContent = kind;
      link.dataset.testLink = kind;
      if (kind === 'download') link.setAttribute('download', 'test.txt');
      if (kind === 'new-tab') link.target = '_blank';
      link.addEventListener('click', (event) => event.preventDefault());
      element.appendChild(link);
    });
  });
  await leaveForm.locator('[data-test-link="download"]').click();
  await leaveForm.locator('[data-test-link="new-tab"]').click();
  await leaveForm.locator('[data-test-link="modified"]').click({ modifiers: ['Control'] });
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toBeHidden();
  await leaveForm.getByRole('link', { name: 'Annuler' }).click();
  await dialog.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
  await expect(page).toHaveURL(/projects\.php$/);

  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  const validForm = page.locator('form[data-mjl-form="project-create"]');
  await validForm.getByLabel('Référence').fill('P3D-DUPLICATE-LOCK');
  await validForm.getByLabel('Intitulé').fill('Protection double soumission');
  await validForm.locator('select[name="fk_soc"]').selectOption({ index: 1 });
  let releasePost;
  let markPostStarted;
  const postStarted = new Promise((resolve) => { markPostStarted = resolve; });
  const heldPost = new Promise((resolve) => { releasePost = resolve; });
  let reportLockState;
  const lockObserved = new Promise((resolve) => { reportLockState = resolve; });
  await page.exposeFunction('__mjlReportSubmitLock', reportLockState);
  await validForm.evaluate((element) => {
    element.addEventListener('submit', () => {
      const submit = element.querySelector('[type="submit"]');
      window.__mjlReportSubmitLock({
        disabled: submit.disabled,
        formBusy: element.getAttribute('aria-busy'),
        submitBusy: submit.getAttribute('aria-busy'),
      });
      window.setTimeout(() => element.requestSubmit(), 0);
    });
  });
  let emittedPosts = 0;
  await page.route('**/custom/mjlfinancement/projects.php*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    emittedPosts += 1;
    markPostStarted();
    await heldPost;
    return route.abort();
  });
  const firstSubmit = validForm.getByRole('button', { name: 'Créer le projet' }).click({ noWaitAfter: true }).catch(() => {});
  const [, lockState] = await Promise.all([postStarted, lockObserved]);
  expect(lockState).toEqual({ disabled: true, formBusy: 'true', submitBusy: 'true' });
  await expect.poll(() => emittedPosts).toBe(1);
  releasePost();
  await firstSubmit;
  await page.unroute('**/custom/mjlfinancement/projects.php*');

  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.locator('form[data-mjl-substantive]')).toHaveCount(0);
  await page.goto('/custom/mjlfinancement/projects.php');
  const projectHref = await page.getByRole('link', { name: 'PRJ-JE-2026' }).first().getAttribute('href');
  await page.goto(projectHref);
  await expect(page.locator('form[data-mjl-form="contextual-comment"][data-mjl-substantive]')).toHaveCount(0);
});

test('project submission tokens prevent replay and unchanged updates create no audit', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  let form = page.locator('form[data-mjl-form="project-create"]');
  const createRef = `P3D-NONCE-${Date.now()}`;
  const createPayload = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'create',
    ref: createRef,
    title: 'Création protégée contre le rejeu',
    fk_soc: await form.locator('select[name="fk_soc"] option:not([value=""])').first().getAttribute('value'),
    fk_statut: '1',
  };
  const created = await page.request.post('/custom/mjlfinancement/projects.php', { form: createPayload, maxRedirects: 0 });
  expect(created.status()).toBe(302);
  const createdId = new URL(created.headers().location, 'http://localhost').searchParams.get('id');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity = 1 AND ref = '${createRef}'`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${createdId} AND action = 'created'`))).toBe(1);
  const createReplay = await page.request.post('/custom/mjlfinancement/projects.php', { form: createPayload, maxRedirects: 0 });
  expect(createReplay.status()).toBe(302);
  expect(createReplay.headers().location || '').toMatch(/action=create.*mjl_recovery=/);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity = 1 AND ref = '${createRef}'`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${createdId} AND action = 'created'`))).toBe(1);

  await page.goto('/custom/mjlfinancement/projects.php');
  const projectHref = await page.getByRole('link', { name: 'PRJ-JE-2026' }).first().getAttribute('href');
  const projectId = new URL(projectHref, 'http://localhost').searchParams.get('id');
  await page.goto(`${projectHref}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const payload = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'update',
    id: projectId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: await form.locator('input[name="title"]').inputValue(),
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
    date_start: await form.locator('input[name="date_start"]').inputValue(),
    date_end: await form.locator('input[name="date_end"]').inputValue(),
    description: `Nonce replay ${Date.now()}`,
  };
  const auditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed'`));
  const accepted = await page.request.post(projectHref, { form: payload, maxRedirects: 0 });
  expect(accepted.status()).toBe(302);
  const auditAfterAccepted = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed'`));
  expect(auditAfterAccepted).toBe(auditBefore + 1);

  const replayed = await page.request.post(projectHref, { form: payload, maxRedirects: 0 });
  expect(replayed.status()).toBe(302);
  expect(replayed.headers().location || '').toMatch(/action=edit.*mjl_recovery=/);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed'`))).toBe(auditAfterAccepted);
  await page.goto(replayed.headers().location);
  await expect(page.locator('[data-mjl-form-errors]')).toContainText('Ce formulaire n’est plus valide');

  await page.goto(`${projectHref}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const unchanged = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'update',
    id: projectId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: await form.locator('input[name="title"]').inputValue(),
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
    date_start: await form.locator('input[name="date_start"]').inputValue(),
    date_end: await form.locator('input[name="date_end"]').inputValue(),
    description: await form.locator('textarea[name="description"]').inputValue(),
  };
  const noOpResponse = await page.request.post(projectHref, { form: unchanged, maxRedirects: 0 });
  expect(noOpResponse.status()).toBe(302);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed'`))).toBe(auditAfterAccepted);
});

test('project tokens reject missing and mismatched contexts while concurrent effects stay singular', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  let form = page.locator('form[data-mjl-form="project-create"]');
  const missingRef = `P3D-MISSING-${Date.now()}`;
  const partner = await form.locator('select[name="fk_soc"] option:not([value=""])').first().getAttribute('value');
  const missingResponse = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: missingRef,
      title: 'Nonce absent',
      fk_soc: partner,
      fk_statut: '1',
    },
    maxRedirects: 0,
  });
  expect(missingResponse.headers().location || '').toMatch(/action=create.*mjl_recovery=/);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity = 1 AND ref = '${missingRef}'`))).toBe(0);
  const createContextNonce = await form.locator('input[name="mjl_submission"]').inputValue();

  await page.goto('/custom/mjlfinancement/projects.php');
  const projectHrefs = await page.locator('a.mjl-table-link[href*="projects.php?id="]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))].slice(0, 2));
  expect(projectHrefs).toHaveLength(2);
  const firstId = new URL(projectHrefs[0], 'http://localhost').searchParams.get('id');
  await page.goto(`${projectHrefs[0]}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const firstTitle = await form.locator('input[name="title"]').inputValue();
  const crossActionPayload = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: createContextNonce,
    action: 'update',
    id: firstId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: 'CROSS-ACTION-MUST-NOT-WRITE',
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
  };
  const crossAction = await page.request.post(projectHrefs[0], { form: crossActionPayload, maxRedirects: 0 });
  expect(crossAction.headers().location || '').toMatch(/action=edit.*mjl_recovery=/);
  expect(scalar(`SELECT title FROM llx_projet WHERE entity = 1 AND rowid = ${firstId}`)).toBe(firstTitle);

  const firstObjectNonce = await form.locator('input[name="mjl_submission"]').inputValue();
  const secondId = new URL(projectHrefs[1], 'http://localhost').searchParams.get('id');
  await page.goto(`${projectHrefs[1]}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const secondTitle = await form.locator('input[name="title"]').inputValue();
  const crossObjectPayload = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: firstObjectNonce,
    action: 'update',
    id: secondId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: 'CROSS-OBJECT-MUST-NOT-WRITE',
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
  };
  const crossObject = await page.request.post(projectHrefs[1], { form: crossObjectPayload, maxRedirects: 0 });
  expect(crossObject.headers().location || '').toMatch(/action=edit.*mjl_recovery=/);
  expect(scalar(`SELECT title FROM llx_projet WHERE entity = 1 AND rowid = ${secondId}`)).toBe(secondTitle);

  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  form = page.locator('form[data-mjl-form="project-create"]');
  const concurrentRef = `P3D-CONCURRENT-${Date.now()}`;
  const concurrentCreate = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'create',
    ref: concurrentRef,
    title: 'Création concurrente unique',
    fk_soc: partner,
    fk_statut: '1',
  };
  const createResponses = await Promise.all([
    page.request.post('/custom/mjlfinancement/projects.php', { form: concurrentCreate, maxRedirects: 0 }),
    page.request.post('/custom/mjlfinancement/projects.php', { form: concurrentCreate, maxRedirects: 0 }),
  ]);
  expect(createResponses.every((response) => response.status() === 302)).toBeTruthy();
  const concurrentId = scalar(`SELECT rowid FROM llx_projet WHERE entity = 1 AND ref = '${concurrentRef}'`);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity = 1 AND ref = '${concurrentRef}'`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${concurrentId} AND action = 'created'`))).toBe(1);

  await page.goto(`${projectHrefs[0]}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const concurrentDescription = `Concurrent update ${Date.now()}`;
  const concurrentUpdate = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'update',
    id: firstId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: await form.locator('input[name="title"]').inputValue(),
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
    date_start: await form.locator('input[name="date_start"]').inputValue(),
    date_end: await form.locator('input[name="date_end"]').inputValue(),
    description: concurrentDescription,
  };
  const updateAuditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${firstId} AND action = 'field_changed'`));
  const updateResponses = await Promise.all([
    page.request.post(projectHrefs[0], { form: concurrentUpdate, maxRedirects: 0 }),
    page.request.post(projectHrefs[0], { form: concurrentUpdate, maxRedirects: 0 }),
  ]);
  expect(updateResponses.every((response) => response.status() === 302)).toBeTruthy();
  expect(scalar(`SELECT description FROM llx_projet WHERE entity = 1 AND rowid = ${firstId}`)).toBe(concurrentDescription);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${firstId} AND action = 'field_changed'`))).toBe(updateAuditBefore + 1);
});

test('recovered project error summary receives focus without JavaScript', async ({ page, browser }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  const form = page.locator('form[data-mjl-form="project-create"]');
  const response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'create',
      ref: 'P3D-NOSCRIPT-FOCUS',
      title: '',
      fk_soc: await form.locator('select[name="fk_soc"] option:not([value=""])').first().getAttribute('value'),
      fk_statut: '1',
    },
    maxRedirects: 0,
  });
  const noScriptContext = await browser.newContext({
    baseURL: process.env.MJL_BASE_URL,
    javaScriptEnabled: false,
  });
  await noScriptContext.addCookies(await page.context().cookies());
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto(response.headers().location);
  await expect(noScriptPage.locator('[data-mjl-error-summary]')).toBeFocused();
  await noScriptContext.close();
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
