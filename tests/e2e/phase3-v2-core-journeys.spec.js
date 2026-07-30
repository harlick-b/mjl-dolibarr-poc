const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test.describe.configure({ mode: 'serial' });

function execFile(command, args, options = {}) {
  try {
    return execFileSync(command, args, options);
  } catch (error) {
    if (error && error.code === 'EPERM' && error.status === 0) {
      return error.stdout || '';
    }
    throw error;
  }
}

function phpJson(code) {
  return JSON.parse(String(execFile('php', ['-r', code], {
    cwd: projectRoot,
    encoding: 'utf8',
  })));
}

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

test.beforeAll(() => {
  execFile('docker', ['compose', 'exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
  execFile('docker', ['compose', 'exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
});

test('Phase 3A journey presentation escapes content and accepts only controlled states', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_journey.lib.php';
    echo json_encode([
      'summary' => mjl_journey_render_summary([
        'title' => 'Synthèse <script>',
        'description' => 'Hiérarchie de décision',
        'items' => [
          ['label' => 'Statut', 'value' => '<b>Soumise</b>', 'tone' => 'warning'],
          ['label' => 'Périmètre', 'value' => 'UNICEF', 'tone' => 'invented'],
        ],
      ]),
      'documents' => mjl_journey_render_document_panel([
        'title' => 'Pièces justificatives',
        'description' => 'Téléchargements gardés',
        'state' => 'downloadable',
        'state_label' => 'Disponible',
        'documents' => [
          ['label' => 'preuve.pdf', 'url' => '/custom/mjlfinancement/documentdownload.php?type=activity&id=7'],
          ['label' => 'interdit', 'url' => 'https://attacker.example/file'],
        ],
      ]),
    ]);
  `);

  expect(result.summary).toContain('Synthèse &lt;script&gt;');
  expect(result.summary).toContain('&lt;b&gt;Soumise&lt;/b&gt;');
  expect(result.summary).toContain('mjl-status-warning');
  expect(result.summary).toContain('mjl-status-neutral');
  expect(result.documents).toContain('mjl-document-summary-downloadable');
  expect(result.documents).toContain('/custom/mjlfinancement/documentdownload.php?type=activity&amp;id=7');
  expect(result.documents).not.toContain('attacker.example');
});

test('Phase 3A table contract retains additive filters and uses resource-aware labels', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_table.lib.php';
    $filters = mjl_table_normalize_generic(
      ['partner' => '12', 'status' => '1', 'sort' => 'recent', 'page' => '3'],
      [
        'partner' => ['type' => 'id', 'allowed' => [12, 13], 'default' => 0],
        'status' => ['type' => 'enum', 'allowed' => ['0', '1'], 'default' => ''],
        'sort' => ['type' => 'enum', 'allowed' => ['ref', 'recent'], 'default' => 'ref'],
        'page' => ['type' => 'page', 'default' => 1],
      ],
      50
    );
    echo json_encode([
      'filters' => $filters,
      'query' => mjl_table_retained_query($filters, ['page' => 2]),
      'pagination' => mjl_table_render_pagination('/projects.php', $filters, 151, true, true, 'projets'),
    ]);
  `);

  expect(result.filters.fail_closed).toBe(false);
  expect(result.query).toContain('partner=12');
  expect(result.query).toContain('status=1');
  expect(result.query).toContain('sort=recent');
  expect(result.query).toContain('page=2');
  expect(result.pagination).toContain('151 projets');
  expect(result.pagination).toContain('aria-label="Pagination des projets"');
});

test('Phase 3A project recovery registry is exact and excludes uploads or unknown actions', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_project_recovery.lib.php';
    echo json_encode([
      'registry' => mjl_project_recovery_registry(),
      'consume' => mjl_project_recovery_consume_allowlist(),
      'upload' => mjl_project_recovery_config('upload'),
      'unknown' => mjl_project_recovery_config('future_action'),
    ]);
  `);

  expect(Object.keys(result.registry).sort()).toEqual(['add_exchange', 'add_note', 'create', 'update']);
  expect(result.consume.project).toEqual(['create', 'update']);
  expect(result.consume.comment).toEqual(['add_note', 'add_exchange']);
  expect(result.upload).toBeNull();
  expect(result.unknown).toBeNull();
});

test('Phase 3A portfolio routes expose scoped filters, deterministic sorts, and retained drill-down context', async ({ page }) => {
  await login(page, 'admin.poc');

  await page.goto('/custom/mjlfinancement/partners.php?sort=risk');
  await expect(page.locator('select[name="sort"]')).toHaveValue('risk');
  await expect(page.locator('nav[aria-label="Pagination des partenaires"]')).toBeVisible();

  const partnerLink = page.locator('a[href*="partners.php?id="]').first();
  const partnerId = new URL(await partnerLink.getAttribute('href'), 'http://localhost').searchParams.get('id');
  await partnerLink.click();
  await expect(page.locator(`a[href*="projects.php?partner=${partnerId}"]`).first()).toBeVisible();
  await expect(page.locator(`a[href*="activities.php?partner=${partnerId}"]`).first()).toBeVisible();

  await page.goto(`/custom/mjlfinancement/projects.php?partner=${partnerId}&status=1&sort=recent`);
  await expect(page.locator('select[name="partner"]')).toHaveValue(partnerId);
  await expect(page.locator('select[name="status"]')).toHaveValue('1');
  await expect(page.locator('select[name="sort"]')).toHaveValue('recent');
  await expect(page.locator('nav[aria-label="Pagination des projets"]')).toBeVisible();

  await page.goto(`/custom/mjlfinancement/activities.php?partner=${partnerId}`);
  await expect(page.locator('select[name="partner"]')).toHaveValue(partnerId);
  await expect(page.locator('nav[aria-label="Pagination des activités"]')).toBeVisible();
});

test('Phase 3A project create recovery preserves allowlisted fields once with linked errors', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');
  const form = page.locator('form[data-mjl-form="project-create"]');
  const response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: 'P3V2-E2E-PROJECT-RECOVERY',
      title: '',
      fk_soc: await form.locator('select[name="fk_soc"] option:not([value=""])').first().getAttribute('value'),
      date_start: '2026-08-02',
      date_end: '2026-08-01',
      fk_statut: '1',
      description: 'P3V2_E2E recovery',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toMatch(/mjl_recovery=[a-f0-9]{32}/);

  await page.goto(location);
  await expect(page.locator('form[data-mjl-form="project-create"] input[name="ref"]')).toHaveValue('P3V2-E2E-PROJECT-RECOVERY');
  await expect(page.locator('form[data-mjl-form="project-create"] textarea[name="description"]')).toHaveValue('P3V2_E2E recovery');
  await expect(page.locator('form[data-mjl-form="project-create"] [data-mjl-form-errors]')).toContainText('Corrigez');
  await expect(page.locator('form[data-mjl-form="project-create"] a[href="#mjl-project-create-title"]')).toBeVisible();

  await page.reload();
  await expect(page.locator('form[data-mjl-form="project-create"] input[name="ref"]')).toHaveValue('');
});
