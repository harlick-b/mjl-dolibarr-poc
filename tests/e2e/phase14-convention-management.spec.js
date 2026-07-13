const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test.describe.configure({ mode: 'serial' });

function dockerExec(command) {
  return execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sql(query) {
  dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`);
}

function scalar(query) {
  return dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -N -B -e "${query.replace(/"/g, '\\"')}"`).toString().trim();
}

async function login(page, username, userPassword = password) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(userPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

async function expectAccessDenied(page) {
  await expect(page.locator('body')).toContainText(/Acces refuse|Accès refusé|Access denied|Forbidden|Non autorise|Non autorisé/);
}

const forbiddenResponsePattern = /Acces refuse|Accès refusé|Acc&egrave;s refus&eacute;|Access denied|Forbidden|Non autorise|Non autorisé|Non autoris&eacute;/;

async function sessionToken(page) {
  const tokenInput = page.locator('input[name="token"]').first();
  if (await tokenInput.count()) {
    const token = await tokenInput.getAttribute('value');
    if (token) return token;
  }
  const metaToken = await page.locator('meta[name="anti-csrf-newtoken"]').getAttribute('content');
  expect(metaToken).toBeTruthy();
  return metaToken;
}

function cleanupPhase14Fixtures() {
  sql(`
    SET @phase14_conventions = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_convention WHERE ref LIKE 'P14-%');
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_convention' AND FIND_IN_SET(object_id, COALESCE(@phase14_conventions, ''));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P14-%';
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P14-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'P14-%';
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase14Fixtures();
});

test.afterAll(() => {
  cleanupPhase14Fixtures();
});

test('DPAF receives convention write without routine operation rights', async () => {
  expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_user u
    INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity = 1
    INNER JOIN llx_usergroup_rights ugr ON ugr.fk_usergroup = ugu.fk_usergroup AND ugr.entity = 1
    INNER JOIN llx_rights_def rd ON rd.id = ugr.fk_id
    WHERE u.login = 'dpaf.mjl' AND rd.module = 'mjlfinancement' AND rd.perms = 'convention' AND rd.subperms = 'write'
  `))).toBe(1);
  expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_user u
    INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity = 1
    INNER JOIN llx_usergroup_rights ugr ON ugr.fk_usergroup = ugu.fk_usergroup AND ugr.entity = 1
    INNER JOIN llx_rights_def rd ON rd.id = ugr.fk_id
    WHERE u.login = 'dpaf.mjl' AND rd.module = 'mjlfinancement' AND ((rd.perms = 'activity' AND rd.subperms IN ('write', 'validate')) OR (rd.perms = 'expense' AND rd.subperms = 'write'))
  `))).toBe(0);
});

test('DPAF creates, edits, activates, closes, and views convention history', async ({ page }) => {
  const ptfId = scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1");
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/conventions.php');
  await expect(page.getByRole('heading', { name: 'Gestion des enveloppes de financement' })).toBeVisible();

  await page.getByLabel('Reference').fill('P14-UI-CONV');
  await page.getByLabel('Intitule').fill('Convention Phase 14 UI');
  await page.locator('select[name="fk_soc"]').selectOption(ptfId);
  await page.locator('select[name="fk_project"]').selectOption(projectId);
  await page.getByLabel('Debut').fill('2026-07-01');
  await page.getByLabel('Fin').fill('2026-12-31');
  await page.getByLabel('Montant total').fill('1234567');
  await page.getByLabel('Devise').fill('XOF');
  await page.getByRole('button', { name: 'Creer l enveloppe' }).click();

  await expect(page).toHaveURL(/conventions\.php\?id=\d+/);
  await expect(page.getByRole('heading', { name: /P14-UI-CONV/ })).toBeVisible();
  await expect(page.getByText('Brouillon').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historique enveloppe' })).toBeVisible();

  await page.getByLabel('Intitule').fill('Convention Phase 14 modifiee');
  await page.getByLabel('Motif de modification').fill('Correction libelle Phase 14');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: /Convention Phase 14 modifiee/ })).toBeVisible();
  await expect(page.getByText('Correction libelle Phase 14')).toBeVisible();

  await page.getByRole('button', { name: 'Activer l enveloppe' }).click();
  await expect(page.getByText('Active').first()).toBeVisible();
  await expect(page.getByText('Activation', { exact: true })).toBeVisible();

  await page.getByLabel('Motif de cloture').fill('Cloture test Phase 14');
  await page.getByRole('button', { name: 'Cloturer l enveloppe' }).click();
  await expect(page.getByText('Cloturee').first()).toBeVisible();
  await expect(page.getByText('Cloture test Phase 14')).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php?report=convention_budget');
  await expect(page.locator('select[name="convention_id"] option', { hasText: 'P14-UI-CONV' })).toHaveCount(1);
});

test('Admin can open convention management, while non-DPAF direct access and POST are blocked', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/conventions.php');
  await expect(page.getByRole('heading', { name: 'Gestion des enveloppes de financement' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Creer l enveloppe' })).toBeVisible();

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/conventions.php');
  await expectAccessDenied(page);

  await page.goto('/custom/mjlfinancement/index.php');
  const token = await sessionToken(page);
  const before = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE ref = 'P14-FORBIDDEN' AND entity = 1"));
  const response = await page.request.post('/custom/mjlfinancement/conventions.php', {
    form: {
      token,
      action: 'create',
      ref: 'P14-FORBIDDEN',
      title: 'Convention interdite',
      fk_soc: scalar("SELECT rowid FROM llx_societe WHERE entity = 1 LIMIT 1"),
      currency_code: 'XOF'
    },
    maxRedirects: 0
  });
  expect(await response.text()).toMatch(forbiddenResponsePattern);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE ref = 'P14-FORBIDDEN' AND entity = 1"))).toBe(before);
});

test('Linked conventions reject locked-field edits and store sanitized unsafe history', async ({ page }) => {
  const conventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1");
  const currentTitle = scalar("SELECT title FROM llx_mjlfinancement_convention WHERE rowid = " + conventionId);
  const currentPtf = scalar("SELECT fk_soc FROM llx_mjlfinancement_convention WHERE rowid = " + conventionId);
  const currentProject = scalar("SELECT fk_project FROM llx_mjlfinancement_convention WHERE rowid = " + conventionId);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/conventions.php?id=${conventionId}`);
  const token = await sessionToken(page);
  const response = await page.request.post(`/custom/mjlfinancement/conventions.php?id=${conventionId}`, {
    form: {
      token,
      action: 'update',
      id: conventionId,
      ref: 'P14-TAMPER-LOCKED',
      title: currentTitle,
      fk_soc: currentPtf,
      fk_project: currentProject,
      total_amount: '999999999',
      currency_code: 'EUR',
      note_public: 'Note autorisee',
      note_private: '',
      comment: 'Tentative verrouillee Phase 14'
    },
    maxRedirects: 0
  });

  expect([302, 403]).toContain(response.status());
  expect(scalar(`SELECT ref FROM llx_mjlfinancement_convention WHERE rowid = ${conventionId}`)).toBe('CONV-UNICEF-2026-001');
  expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action
    WHERE object_type = 'mjlfinancement_convention'
    AND object_id = ${conventionId}
    AND action = 'unsafe_edit_rejected'
    AND changes_json LIKE '%rejected_fields%'
    AND changes_json NOT LIKE '%999999999%'
    AND changes_json NOT LIKE '%P14-TAMPER-LOCKED%'
  `))).toBeGreaterThan(0);
});

test('Unlinked draft deletion works but linked deletion is blocked', async ({ page }) => {
  const ptfId = scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1");
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/conventions.php');
  await page.getByLabel('Reference').fill('P14-DELETE-DRAFT');
  await page.getByLabel('Intitule').fill('Convention Phase 14 suppression');
  await page.locator('select[name="fk_soc"]').selectOption(ptfId);
  await page.locator('select[name="fk_project"]').selectOption(projectId);
  await page.getByLabel('Montant total').fill('500000');
  await page.getByLabel('Devise').fill('XOF');
  await page.getByRole('button', { name: 'Creer l enveloppe' }).click();
  const draftId = new URL(page.url()).searchParams.get('id');
  await page.getByRole('button', { name: 'Supprimer le brouillon' }).click();
  await expect(page).toHaveURL(/conventions\.php$/);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE rowid = ${draftId}`))).toBe(0);

  const linkedId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1");
  await page.goto(`/custom/mjlfinancement/conventions.php?id=${linkedId}`);
  const token = await sessionToken(page);
  const response = await page.request.post(`/custom/mjlfinancement/conventions.php?id=${linkedId}`, {
    form: { token, action: 'delete', id: linkedId },
    maxRedirects: 0
  });
  expect([302, 403]).toContain(response.status());
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE rowid = ${linkedId}`))).toBe(1);
});

test('Only active conventions can be selected or posted for new activities and expenses', async ({ page }) => {
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-EXT-2026' AND entity = 1 LIMIT 1");
  const draftConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-TEST-2026-001' AND entity = 1 LIMIT 1");
  const budgetLineId = scalar("SELECT rowid FROM llx_mjlfinancement_budget_line WHERE entity = 1 LIMIT 1");

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.locator('select[name="fk_convention"] option', { hasText: 'CONV-TEST-2026-001' })).toHaveCount(0);
  let token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  let response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token,
      action: 'create',
      ref: 'P14-DRAFT-CONV-ACT',
      label: 'Activite convention brouillon',
      fk_project: projectId,
      fk_convention: draftConventionId,
      fk_task: '',
      date_start: '2026-07-01',
      date_end: '2026-07-31'
    },
    maxRedirects: 0
  });
  expect(response.status()).toBe(302);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE ref = 'P14-DRAFT-CONV-ACT' AND entity = 1"))).toBe(0);

  await page.goto('/custom/mjlfinancement/expenses.php');
  await expect(page.locator('select[name="fk_convention"] option', { hasText: 'CONV-TEST-2026-001' })).toHaveCount(0);
  token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  response = await page.request.post('/custom/mjlfinancement/expenses.php', {
    form: {
      token,
      action: 'create',
      ref: 'P14-DRAFT-CONV-EXP',
      fk_project: projectId,
      fk_convention: draftConventionId,
      fk_mjl_activity: '',
      fk_budget_line: budgetLineId,
      amount: '1000',
      expense_date: '2026-07-15',
      description: 'Depense convention brouillon'
    },
    maxRedirects: 0
  });
  expect([302, 403]).toContain(response.status());
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE ref = 'P14-DRAFT-CONV-EXP' AND entity = 1"))).toBe(0);
});
