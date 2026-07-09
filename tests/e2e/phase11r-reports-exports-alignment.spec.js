const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const zlib = require('zlib');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test.describe.configure({ mode: 'serial' });

function dockerExec(command) {
  return execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sqlScalar(query) {
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

function xlsxEntry(buffer, entryName) {
  let eocd = -1;
  const min = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd, 'xlsx end of central directory').toBeGreaterThanOrEqual(0);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  let pos = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < totalEntries; i++) {
    expect(buffer.readUInt32LE(pos), 'xlsx central directory header').toBe(0x02014b50);
    const method = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const fileNameLength = buffer.readUInt16LE(pos + 28);
    const extraLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    const name = buffer.subarray(pos + 46, pos + 46 + fileNameLength).toString('utf8');
    if (name === entryName) {
      expect(buffer.readUInt32LE(localOffset), 'xlsx local file header').toBe(0x04034b50);
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const payload = buffer.subarray(start, start + compressedSize);
      if (method === 0) return payload.toString('utf8');
      if (method === 8) return zlib.inflateRawSync(payload).toString('utf8');
      throw new Error(`Unsupported XLSX compression method ${method}`);
    }
    pos += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`Missing XLSX entry ${entryName}`);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
});

test('report center denies unauthorized users and avoids legacy wording', async ({ page }) => {
  for (const username of ['agent.mjl', 'superviseur.n1', 'lecteur.audit']) {
    await login(page, username);
    await page.goto('/custom/mjlfinancement/reports.php');
    await expectAccessDenied(page);
  }

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();
  const workspace = page.locator('.mjl-reports-workspace');
  await expect(workspace).toContainText('Partenaire / Programme');
  await expect(workspace).not.toContainText(/DPAF|PTF|Échanges|Validee legacy|Convention/);
});

test('final validator and Admin can export scoped CSV and XLSX with stable names', async ({ page }) => {
  const projectId = sqlScalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/reports.php?report=financial_execution_project&project_id=${projectId}&date_start=2026-01-01&date_end=2026-12-31`);

  const csvFilename = (await page.getByTestId('mjl-report-filename').innerText()).trim();
  const xlsxFilename = (await page.getByTestId('mjl-report-xlsx-filename').innerText()).trim();
  expect(csvFilename).toBe(`mjl_execution_financiere_projet_2026-01-01_2026-12-31_projet-${projectId}.csv`);
  expect(xlsxFilename).toBe(`mjl_execution_financiere_projet_2026-01-01_2026-12-31_projet-${projectId}.xlsx`);

  const before = Number(sqlScalar("SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action w INNER JOIN llx_mjlfinancement_report r ON r.rowid = w.object_id AND r.entity = w.entity WHERE w.object_type = 'mjlfinancement_report' AND w.action = 'export_generated' AND r.ref = 'REPORT-FINANCIAL-EXECUTION-PROJECT'"));

  let downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le CSV' }).click();
  const csvDownload = await downloadPromise;
  expect(csvDownload.suggestedFilename()).toBe(csvFilename);
  const csvBuffer = fs.readFileSync(await csvDownload.path());
  expect(csvBuffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
  const csv = csvBuffer.toString('utf8');
  expect(csv).toContain('Partenaire / Programme');
  expect(csv).toContain('Titre projet');
  expect(csv).toContain('Budget révisé');
  expect(csv).toContain('PRJ-JE-2026');
  expect(csv).toContain(';');

  downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le fichier XLSX' }).click();
  const xlsxDownload = await downloadPromise;
  expect(xlsxDownload.suggestedFilename()).toBe(xlsxFilename);
  const xlsx = fs.readFileSync(await xlsxDownload.path());
  expect(xlsx.subarray(0, 2).toString('utf8')).toBe('PK');
  const sharedStrings = xlsxEntry(xlsx, 'xl/sharedStrings.xml');
  expect(sharedStrings).toContain('Partenaire / Programme');
  expect(sharedStrings).toContain('PRJ-JE-2026');

  const after = Number(sqlScalar("SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action w INNER JOIN llx_mjlfinancement_report r ON r.rowid = w.object_id AND r.entity = w.entity WHERE w.object_type = 'mjlfinancement_report' AND w.action = 'export_generated' AND r.ref = 'REPORT-FINANCIAL-EXECUTION-PROJECT'"));
  expect(after).toBeGreaterThanOrEqual(before + 2);

  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/reports.php?report=financial_execution_project&project_id=${projectId}`);
  downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le CSV' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(`mjl_execution_financiere_projet_projet-${projectId}.csv`);
});

test('partner/project tampering fails closed and POST token is required', async ({ page }) => {
  const unicefId = sqlScalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1");
  const redProjectId = sqlScalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-RED-2026' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/reports.php?report=financial_execution_project&fk_soc=${unicefId}&project_id=${redProjectId}`);
  await expect(page.getByText('Filtre hors de votre périmètre: Projet.')).toBeVisible();
  await expect(page.locator('.mjl-report-table tr', { hasText: 'PRJ-RED-2026' })).toHaveCount(0);

  let downloadPromise = page.waitForEvent('download', { timeout: 1500 }).then(() => 'downloaded').catch(() => 'no-download');
  await page.goto('/custom/mjlfinancement/reports.php?report=financial_execution_project&action=export_csv').catch(() => {});
  await expect(page.locator('body')).toContainText(/Export POST requis|Acces refuse|Accès refusé|Forbidden/);
  expect(await downloadPromise).toBe('no-download');

  const response = await page.request.post('/custom/mjlfinancement/reports.php', {
    form: { report: 'financial_execution_project', action: 'export_csv' },
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
});

test('general audit hides generic report audit rows from scoped users but Admin can see them', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/reports.php?report=general_audit');
  await expect(page.locator('body')).not.toContainText('mjlfinancement_report');

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/reports.php?report=general_audit');
  await expect(page.locator('body')).toContainText(/Audit général|Export/);
});
