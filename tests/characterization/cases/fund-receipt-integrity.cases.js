const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const forbiddenResponsePattern = /Acces refuse|Accès refusé|Acc&egrave;s refus&eacute;|Access denied|Forbidden|Non autorise|Non autorisé|Non autoris&eacute;/;

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
  await expect(page.locator('body')).toContainText(forbiddenResponsePattern);
}

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

function cleanupFundReceiptFixtures() {
  sql(`
    SET @fund_receipt_receipts = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'FND-%');
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_fund_receipt' AND (FIND_IN_SET(src_object_id, COALESCE(@fund_receipt_receipts, '')) OR ref LIKE 'FND-%');
    DELETE FROM llx_ecm_files WHERE ref LIKE 'FND-%';
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_fund_receipt' AND FIND_IN_SET(object_id, COALESCE(@fund_receipt_receipts, ''));
    DELETE FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'FND-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'FND-%';
  `);
}

function seedFundReceiptSecurityFixtures() {
  sql(`
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @ptf = (SELECT fk_soc FROM llx_mjlfinancement_convention WHERE rowid = @convention);

    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, date_creation, fk_user_creat, status, import_key)
    VALUES (1, 'FND-GLOBAL-CONV', 'Programme global Fund receipt', @ptf, NULL, '2026-07-01', '2026-12-31', 5000000, 'XOF', NOW(), @admin, 1, 'FNDGLOBAL');

    INSERT INTO llx_mjlfinancement_fund_receipt (entity, ref, fk_soc, fk_project, fk_convention, amount, reception_date, supporting_document, comment, status, date_creation, fk_user_creat, import_key)
    VALUES
      (1, 'FND-DOWNLOAD-OK', @ptf, @project, @convention, 1000, '2026-07-01', 'FND-DOWNLOAD-OK.txt', 'Fixture telechargement', 1, NOW(), @admin, 'FNDOK'),
      (2, 'FND-CROSS-ENTITY', @ptf, @project, @convention, 1000, '2026-07-01', 'FND-CROSS-ENTITY.txt', 'Fixture entite', 1, NOW(), @admin, 'FNDE2');

    SET @download_ok = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-DOWNLOAD-OK' AND entity = 1);
    SET @download_cross = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-CROSS-ENTITY' AND entity = 2);
    SET @expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE entity = 1 LIMIT 1);

    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES
      ('FND-DOWNLOAD-OK', 'FND-DOWNLOAD-OK.txt', 1, 'FND-DOWNLOAD-OK.txt', 'mjlfinancement_fund_receipt', 'FND-DOWNLOAD-OK.txt', 'Preuve Fund receipt', 1, NOW(), @admin, 'mjlfinancement_fund_receipt', @download_ok),
      ('FND-CROSS-ENTITY', 'FND-CROSS-ENTITY.txt', 2, 'FND-CROSS-ENTITY.txt', 'mjlfinancement_fund_receipt', 'FND-CROSS-ENTITY.txt', 'Preuve Fund receipt entite 2', 1, NOW(), @admin, 'mjlfinancement_fund_receipt', @download_cross),
      ('FND-CROSS-OBJECT', 'FND-CROSS-OBJECT.txt', 1, 'FND-CROSS-OBJECT.txt', 'mjlfinancement_fund_receipt', 'FND-CROSS-OBJECT.txt', 'Mauvais objet', 1, NOW(), @admin, 'mjlfinancement_expense', @expense),
      ('FND-ORPHAN', 'FND-ORPHAN.txt', 1, 'FND-ORPHAN.txt', 'mjlfinancement_fund_receipt', 'FND-ORPHAN.txt', 'Objet absent', 1, NOW(), @admin, 'mjlfinancement_fund_receipt', 99999999),
      ('FND-POISON', 'FND-POISON.txt', 1, '../FND-POISON.txt', 'mjlfinancement_fund_receipt', 'FND-POISON.txt', 'Chemin refuse', 1, NOW(), @admin, 'mjlfinancement_fund_receipt', @download_ok);
  `);
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_fund_receipt && printf "%s" "Fund receipt fund proof" > /var/www/documents/ecm/mjlfinancement_fund_receipt/FND-DOWNLOAD-OK.txt && printf "%s" "Fund receipt cross entity proof" > /var/www/documents/ecm/mjlfinancement_fund_receipt/FND-CROSS-ENTITY.txt && printf "%s" "Fund receipt cross object proof" > /var/www/documents/ecm/mjlfinancement_fund_receipt/FND-CROSS-OBJECT.txt && printf "%s" "Fund receipt orphan proof" > /var/www/documents/ecm/mjlfinancement_fund_receipt/FND-ORPHAN.txt\'');
  dockerExec('dolibarr chown -R www-data:www-data /var/www/documents/ecm/mjlfinancement_fund_receipt');
}

test.beforeAll(() => {
  cleanupFundReceiptFixtures();
  seedFundReceiptSecurityFixtures();
});

test.afterAll(() => {
  cleanupFundReceiptFixtures();
});

test('Current final-validator fixture receives fund-receipt write without native ECM or routine operation rights', async () => {
	expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_user u
    INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity = 1
    INNER JOIN llx_usergroup_rights ugr ON ugr.fk_usergroup = ugu.fk_usergroup AND ugr.entity = 1
    INNER JOIN llx_rights_def rd ON rd.id = ugr.fk_id
    WHERE u.login = 'dpaf.mjl' AND rd.module = 'mjlfinancement' AND rd.perms = 'fundreceipt' AND rd.subperms = 'write'
  `))).toBe(1);
	expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_user u
    INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity = 1
    INNER JOIN llx_usergroup_rights ugr ON ugr.fk_usergroup = ugu.fk_usergroup AND ugr.entity = 1
    INNER JOIN llx_rights_def rd ON rd.id = ugr.fk_id
    WHERE u.login = 'dpaf.mjl' AND rd.module = 'ecm' AND rd.perms IN ('read', 'upload')
  `))).toBe(0);
  expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_user u
    INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity = 1
    INNER JOIN llx_usergroup_rights ugr ON ugr.fk_usergroup = ugu.fk_usergroup AND ugr.entity = 1
    INNER JOIN llx_rights_def rd ON rd.id = ugr.fk_id
    WHERE u.login = 'dpaf.mjl' AND rd.module = 'mjlfinancement' AND ((rd.perms = 'activity' AND rd.subperms IN ('write', 'validate')) OR (rd.perms = 'expense' AND rd.subperms = 'write'))
  `))).toBe(0);
});

test('Current final-validator fixture creates, edits, uploads proof, marks received, and sees report/dashboard impact', async ({ page }) => {
  const conventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1");
  const tmpFile = path.join(os.tmpdir(), `fund-proof-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Fund receipt uploaded proof');

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/fundreceipts.php');
  await expect(page.getByRole('heading', { name: 'Gestion des réceptions de fonds' })).toBeVisible();
  await expect(page.locator('form input[name="action"][value="create"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Créer une réception' }).click();
  await expect(page.locator('form[data-mjl-form="fundreceipt-create"]')).toHaveAttribute('data-mjl-substantive', '');

  await page.getByLabel('Référence').fill('FND-UI-FR');
  await page.locator('select[name="fk_convention"]').selectOption(conventionId);
  await page.getByLabel('Montant').fill('123456');
  await page.getByLabel('Date de réception').fill('2026-07-01');
  await page.getByLabel('Commentaire').fill('Reception Fund receipt');
  await page.getByRole('button', { name: 'Créer la réception' }).click();

  await expect(page).toHaveURL(/fundreceipts\.php\?id=\d+/);
  await expect(page.getByRole('heading', { name: 'FND-UI-FR' })).toBeVisible();
  await expect(page.getByText('Brouillon').first()).toBeVisible();
  let timeline = page.getByRole('heading', { name: 'Historique réception de fonds' }).locator('xpath=ancestor::section[1]');
  await expect(timeline.getByText('Réception de fonds créée')).toHaveCount(1);
  await expect(timeline).not.toContainText(/vers Brouillon/);
  await expect(page.locator('form input[name="action"][value="update"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Modifier la réception' }).click();
  await expect(page.locator('form[data-mjl-form="fundreceipt-edit"]')).toHaveAttribute('data-mjl-substantive', '');
  await page.getByLabel('Montant').fill('234567');
  await page.getByLabel('Motif de modification').fill('Correction montant Fund receipt');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Correction montant Fund receipt')).toBeVisible();
  timeline = page.getByRole('heading', { name: 'Historique réception de fonds' }).locator('xpath=ancestor::section[1]');
  await expect(timeline.locator('strong').filter({ hasText: 'Modification' })).toBeVisible();
  await expect(timeline).not.toContainText('Brouillon vers Brouillon');

  await page.getByRole('link', { name: 'Ajouter une preuve' }).click();
  await expect(page.locator('form[data-mjl-form="fundreceipt-upload"]')).toHaveAttribute('data-mjl-substantive', '');
  await page.setInputFiles('input[name="supporting_document"]', tmpFile);
  await page.getByRole('button', { name: 'Ajouter la preuve' }).click();
  await expect(page.getByText('Disponible').first()).toBeVisible();
  timeline = page.getByRole('heading', { name: 'Historique réception de fonds' }).locator('xpath=ancestor::section[1]');
  await expect(timeline.locator('strong').filter({ hasText: 'Preuve ajoutée' })).toBeVisible();
  await expect(timeline).not.toContainText('Brouillon vers Brouillon');

  await page.getByRole('link', { name: 'Marquer comme reçu' }).click();
  await expect(page.locator('form[data-mjl-form="fundreceipt-received"]')).toHaveAttribute('data-mjl-substantive', '');
  await page.getByRole('button', { name: 'Marquer comme reçu' }).click();
  await expect(page.getByText('Reçu').first()).toBeVisible();
  await expect(page.getByText('Réception', { exact: true })).toBeVisible();

  expect(scalar("SELECT status FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-UI-FR' AND entity = 1")).toBe('1');
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_fund_receipt' AND object_id = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-UI-FR' AND entity = 1) AND action IN ('created', 'field_changed', 'proof_uploaded', 'received')"))).toBeGreaterThanOrEqual(4);

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  const recentFunds = page.getByRole('heading', { name: 'Dernières réceptions de fonds' }).locator('xpath=ancestor::section[1]');
  await expect(recentFunds.locator('tr', { hasText: 'FND-UI-FR' })).toContainText('Disponible');

  await page.goto(`/custom/mjlfinancement/reports.php?report=fund_receipts&convention_id=${conventionId}&status=1`);
  await expect(page.locator('tr', { hasText: 'FND-UI-FR' })).toContainText('Oui');
});

test('Seeded fund receipt proof labels prefer public ECM filenames over stored document ids', async ({ page }) => {
  const receiptId = scalar("SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FR-UNICEF-001' AND entity = 1 LIMIT 1");
  const conventionId = scalar("SELECT fk_convention FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FR-UNICEF-001' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/fundreceipts.php?id=${receiptId}`);
  const proofPanel = page.getByRole('heading', { name: 'Preuve documentaire' }).locator('xpath=ancestor::section[1]');
  await expect(proofPanel).toContainText('FR-UNICEF-001_avis-credit.txt');
  await expect(proofPanel).not.toContainText('DOC-FR-UNICEF-001');

  await page.goto(`/custom/mjlfinancement/reports.php?report=fund_receipts&convention_id=${conventionId}&status=1`);
  const reportRow = page.locator('tr', { hasText: 'FR-UNICEF-001' });
  await expect(reportRow).toContainText('FR-UNICEF-001_avis-credit.txt');
  await expect(reportRow).not.toContainText('DOC-FR-UNICEF-001');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le CSV' }).click();
  const download = await downloadPromise;
  const csv = fs.readFileSync(await download.path(), 'utf8');
  expect(csv).toContain('FR-UNICEF-001_avis-credit.txt');
  expect(csv).not.toContain('DOC-FR-UNICEF-001');
});

test('Global programme envelope can create a fund receipt without project', async ({ page }) => {
  const globalConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'FND-GLOBAL-CONV' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/fundreceipts.php?action=create');
  await expect(page.locator('select[name="fk_convention"] option', { hasText: 'FND-GLOBAL-CONV' })).toHaveCount(1);

  await page.getByLabel('Référence').fill('FND-GLOBAL-FR');
  await page.locator('select[name="fk_convention"]').selectOption(globalConventionId);
  await page.getByLabel('Montant').fill('345678');
  await page.getByLabel('Date de réception').fill('2026-07-05');
  await page.getByLabel('Commentaire').fill('Reception globale Fund receipt');
  await page.getByRole('button', { name: 'Créer la réception' }).click();

  await expect(page).toHaveURL(/fundreceipts\.php\?id=\d+/);
  await expect(page.getByRole('heading', { name: 'FND-GLOBAL-FR' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Enveloppe globale');
  expect(scalar("SELECT COALESCE(CAST(fk_project AS CHAR), 'NULL') FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-GLOBAL-FR' AND entity = 1")).toBe('NULL');
});

test('Fund proof label resolution ignores path-tampered rows when a valid download exists', async ({ page }) => {
  const receiptId = scalar("SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-DOWNLOAD-OK' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/fundreceipts.php?id=${receiptId}`);
  const proofPanel = page.getByRole('heading', { name: 'Preuve documentaire' }).locator('xpath=ancestor::section[1]');
  const summary = proofPanel.locator('.mjl-document-summary');
  await expect(summary).toContainText('FND-DOWNLOAD-OK.txt');
  await expect(summary).not.toContainText('FND-POISON.txt');
});

test('Received transition is blocked without proof and draft conventions are rejected', async ({ page }) => {
  const activeConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1");
  const draftConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-TEST-2026-001' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/fundreceipts.php?action=create');
  await expect(page.locator('select[name="fk_convention"] option', { hasText: 'CONV-TEST-2026-001' })).toHaveCount(0);

  await page.getByLabel('Référence').fill('FND-NO-PROOF');
  await page.locator('select[name="fk_convention"]').selectOption(activeConventionId);
  await page.getByLabel('Montant').fill('5000');
  await page.getByLabel('Date de réception').fill('2026-07-02');
  await page.getByRole('button', { name: 'Créer la réception' }).click();
  await expect(page).toHaveURL(/fundreceipts\.php\?id=\d+/);
  await page.getByRole('link', { name: 'Marquer comme reçu' }).click();
  await page.getByRole('button', { name: 'Marquer comme reçu' }).click();
  await expect(page.locator('body')).toContainText(/preuve/i);
  expect(scalar("SELECT status FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-NO-PROOF' AND entity = 1")).toBe('0');

  await page.goto('/custom/mjlfinancement/fundreceipts.php?action=create');
  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const response = await page.request.post('/custom/mjlfinancement/fundreceipts.php', {
    form: {
      token,
      action: 'create',
      ref: 'FND-DRAFT-CONV',
      fk_convention: draftConventionId,
      amount: '1000',
      reception_date: '2026-07-03'
    },
    maxRedirects: 0
  });
  expect([302, 403]).toContain(response.status());
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-DRAFT-CONV' AND entity = 1"))).toBe(0);
});

test('Not-received receipts are finalized, zeroed, and excluded from totals', async ({ page }) => {
  const conventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/fundreceipts.php?action=create');
  await page.getByLabel('Référence').fill('FND-NOT-RECEIVED');
  await page.locator('select[name="fk_convention"]').selectOption(conventionId);
  await page.getByLabel('Montant').fill('987654');
  await page.getByLabel('Date de réception').fill('2026-07-04');
  await page.getByRole('button', { name: 'Créer la réception' }).click();

  await expect(page).toHaveURL(/fundreceipts\.php\?id=\d+/);
  await page.getByRole('link', { name: 'Marquer non reçu' }).click();
  await page.getByLabel('Motif obligatoire').fill('Fonds non verses Fund receipt');
  await page.getByRole('button', { name: 'Marquer non reçu' }).click();
  await expect(page.getByText('Non reçu').first()).toBeVisible();
  expect(scalar("SELECT status FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-NOT-RECEIVED' AND entity = 1")).toBe('8');
  expect(Number(scalar("SELECT amount FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-NOT-RECEIVED' AND entity = 1"))).toBe(0);

  await page.goto(`/custom/mjlfinancement/reports.php?report=fund_receipts&convention_id=${conventionId}&status=8`);
  await expect(page.locator('tr', { hasText: 'FND-NOT-RECEIVED' })).toContainText('Non reçu');
});

test('Agent and read-only users are blocked from mutations and fund proof downloads', async ({ page }) => {
  const fileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'FND-DOWNLOAD-OK' AND entity = 1 LIMIT 1");

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/fundreceipts.php');
  await expectAccessDenied(page);

  await page.goto('/custom/mjlfinancement/index.php');
  const token = await sessionToken(page);
  const response = await page.request.post('/custom/mjlfinancement/fundreceipts.php', {
    form: { token, action: 'create', ref: 'FND-FORBIDDEN', fk_convention: '1', amount: '1000' },
    maxRedirects: 0
  });
  expect(await response.text()).toMatch(forbiddenResponsePattern);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-FORBIDDEN' AND entity = 1"))).toBe(0);

  await login(page, 'lecteur.audit');
  const download = await page.request.get(`/custom/mjlfinancement/documentdownload.php?type=fundreceipt&id=${fileId}`);
  expect(download.status()).toBe(403);
});

test('Fund proof downloads allow valid authorized rows and deny cross-object, cross-entity, orphan, and path-tampered rows', async ({ page }) => {
  await login(page, 'dpaf.mjl');

  const validId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'FND-DOWNLOAD-OK' AND entity = 1 LIMIT 1");
  const valid = await page.request.get(`/custom/mjlfinancement/documentdownload.php?type=fundreceipt&id=${validId}`);
  expect(valid.status()).toBe(200);
  expect(await valid.text()).toContain('Fund receipt fund proof');
  const receiptId = scalar("SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'FND-DOWNLOAD-OK' AND entity = 1 LIMIT 1");
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_fund_receipt' AND object_id = ${receiptId} AND action = 'document_downloaded' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBeGreaterThanOrEqual(1);

  for (const ref of ['FND-CROSS-ENTITY', 'FND-CROSS-OBJECT', 'FND-ORPHAN', 'FND-POISON']) {
    const id = scalar(`SELECT rowid FROM llx_ecm_files WHERE ref = '${ref}' ORDER BY entity ASC LIMIT 1`);
    const response = await page.request.get(`/custom/mjlfinancement/documentdownload.php?type=fundreceipt&id=${id}`);
    expect(response.status(), ref).toBe(403);
  }
});
