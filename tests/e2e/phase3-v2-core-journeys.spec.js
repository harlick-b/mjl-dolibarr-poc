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

function cleanupPhase3V2Fixtures() {
  execFile('docker', [
    'compose', 'exec', '-T', 'mariadb', 'mariadb',
    '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e',
    `
      SET @expense_id = (SELECT rowid FROM llx_mjlfinancement_expense WHERE entity = 1 AND ref = 'P3V2-E2E-EXPENSE-RECOVERY' LIMIT 1);
      DELETE FROM llx_mjlfinancement_exchange_log WHERE object_type = 'mjlfinancement_expense' AND object_id = @expense_id;
      DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_expense' AND object_id = @expense_id;
      DELETE FROM llx_mjlfinancement_validation WHERE fk_expense = @expense_id;
      DELETE FROM llx_ecm_files WHERE entity = 1 AND src_object_type = 'mjlfinancement_expense' AND src_object_id = @expense_id;
      DELETE FROM llx_mjlfinancement_expense WHERE rowid = @expense_id;
    `,
  ], { cwd: projectRoot, stdio: 'pipe' });
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
  cleanupPhase3V2Fixtures();
});

test.afterAll(() => {
  cleanupPhase3V2Fixtures();
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

test('Phase 3B expense recovery registry is exact and excludes security or upload failures', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_expense_recovery.lib.php';
    echo json_encode([
      'registry' => mjl_expense_recovery_registry(),
      'consume' => mjl_expense_recovery_consume_allowlist(),
      'upload' => mjl_expense_recovery_config('upload'),
      'unknown' => mjl_expense_recovery_config('future_action'),
    ]);
  `);

  expect(Object.keys(result.registry).sort()).toEqual([
    'add_exchange', 'correct', 'create', 'disburse', 'final_validate',
    'prevalidate', 'reject', 'submit', 'update', 'validate',
  ]);
  expect(result.consume.create).toEqual(['create']);
  expect(result.consume.correction).toEqual(['update', 'correct']);
  expect(result.consume.decision).toEqual(['submit', 'validate', 'prevalidate', 'final_validate', 'disburse', 'reject']);
  expect(result.upload).toBeNull();
  expect(result.unknown).toBeNull();
});

test('Phase 3B recovery handles stay isolated by route and remain one-use', () => {
  const result = phpJson(`
    session_id('phase3-recovery-isolation');
    session_start();
    $_SESSION = [];
    require 'custom/mjlfinancement/lib/mjl_form.lib.php';
    $reason = '';
    $projectContext = ['user_id' => 7, 'entity' => 1, 'route' => 'projects', 'form' => 'create', 'action' => 'create', 'object_id' => 0];
    $expenseContext = ['user_id' => 7, 'entity' => 1, 'route' => 'expenses', 'form' => 'create', 'action' => 'create', 'object_id' => 0];
    $project = mjl_form_recovery_store($projectContext, ['ref' => 'PRJ'], ['ref'], $reason);
    $expense = mjl_form_recovery_store($expenseContext, ['ref' => 'EXP'], ['ref'], $reason);
    $wrong = mjl_form_recovery_consume_route($project, ['user_id' => 7, 'entity' => 1, 'route' => 'expenses', 'object_id' => 0], ['create' => ['create']]);
    $projectEntry = mjl_form_recovery_consume_route($project, ['user_id' => 7, 'entity' => 1, 'route' => 'projects', 'object_id' => 0], ['create' => ['create']]);
    $expenseEntry = mjl_form_recovery_consume_route($expense, ['user_id' => 7, 'entity' => 1, 'route' => 'expenses', 'object_id' => 0], ['create' => ['create']]);
    $second = mjl_form_recovery_consume_route($expense, ['user_id' => 7, 'entity' => 1, 'route' => 'expenses', 'object_id' => 0], ['create' => ['create']]);
    echo json_encode([
      'distinct' => $project !== $expense,
      'wrong' => $wrong,
      'project' => $projectEntry['values']['ref'] ?? null,
      'expense' => $expenseEntry['values']['ref'] ?? null,
      'second' => $second,
    ]);
  `);

  expect(result).toEqual({
    distinct: true,
    wrong: null,
    project: 'PRJ',
    expense: 'EXP',
    second: null,
  });
});

test('Phase 3B expense list retains scoped filters and exposes resource-aware pagination', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/expenses.php');

  const partnerOption = page.locator('select[name="partner"] option:not([value=""])').first();
  const partnerId = await partnerOption.getAttribute('value');
  const projectOption = page.locator('select[name="project"] option:not([value=""])').first();
  const projectId = await projectOption.getAttribute('value');
  await page.goto(`/custom/mjlfinancement/expenses.php?partner=${partnerId}&project=${projectId}&status=1&sort=amount`);

  await expect(page.locator('select[name="partner"]')).toHaveValue(partnerId);
  await expect(page.locator('select[name="project"]')).toHaveValue(projectId);
  await expect(page.locator('select[name="status"]')).toHaveValue('1');
  await expect(page.locator('select[name="sort"]')).toHaveValue('amount');
  await expect(page.locator('nav[aria-label="Pagination des dépenses"]')).toBeVisible();
});

test('Phase 3B expense and global document surfaces use guarded shared presentation states', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/expenses.php');
  const expenseHref = await page.locator('a[href*="expenses.php?id="]').first().getAttribute('href');
  await page.goto(expenseHref);
  await expect(page.locator('.mjl-journey-documents')).toBeVisible();
  await expect(page.locator('.mjl-journey-documents a')).not.toHaveAttribute('href', /\/document\.php|\/ecm\//);

  await page.goto('/custom/mjlfinancement/documents.php');
  await expect(page.locator('.mjl-document-summary-read-only')).toContainText('Consultation uniquement');
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator('a[href*="documentdownload.php"]').first()).toBeVisible();
  await expect(page.locator('a[href*="/document.php"]')).toHaveCount(0);
});

test('Phase 3B expense create recovery is exact, one-use, and keeps linked safe values', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/expenses.php');
  const form = page.locator('form[data-mjl-form="expense-create"]');
  const response = await page.request.post('/custom/mjlfinancement/expenses.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: 'P3V2-E2E-EXPENSE-RECOVERY',
      fk_project: await form.locator('select[name="fk_project"] option', { hasText: 'PRJ-JE-2026' }).getAttribute('value'),
      fk_convention: await form.locator('select[name="fk_convention"] option', { hasText: 'CONV-UNICEF-2026-001' }).getAttribute('value'),
      fk_mjl_activity: '',
      fk_budget_line: await form.locator('select[name="fk_budget_line"] option', { hasText: 'BL-JE-001' }).getAttribute('value'),
      amount: '0',
      expense_date: '2026-08-03',
      description: 'P3V2_E2E expense recovery',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toMatch(/mjl_recovery=[a-f0-9]{32}/);

  await page.goto(location);
  await expect(form.locator('input[name="ref"]')).toHaveValue('P3V2-E2E-EXPENSE-RECOVERY');
  await expect(form.locator('input[name="description"]')).toHaveValue('P3V2_E2E expense recovery');
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('montant');
  await expect(form.locator('a[href="#mjl-expense-create-amount"]')).toBeVisible();
  await page.reload();
  await expect(form.locator('input[name="ref"]')).toHaveValue('');
});
