const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const cleanupActivityRefs = new Set();

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

function phpJson(code) {
  return JSON.parse(execFileSync('php', ['-r', code], {
    cwd: projectRoot,
    encoding: 'utf8',
  }));
}

function cleanupActivities() {
  for (const ref of cleanupActivityRefs) {
    if (!/^[A-Z0-9-]+$/.test(ref)) continue;
    const query = `
      SET @activity_id = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = '${ref}' LIMIT 1);
      DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = @activity_id;
      DELETE FROM llx_mjlfinancement_activity WHERE rowid = @activity_id;
    `;
    execFileSync('docker', ['compose', 'exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e', query], {
      cwd: projectRoot,
      stdio: 'pipe',
    });
  }
  cleanupActivityRefs.clear();
}

test.afterEach(() => {
  cleanupActivities();
});

test('shared UI vocabulary separates business status and renders unknown values safely', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_ui.lib.php';
    echo json_encode([
      'activity_submitted' => mjl_ui_activity_status(3),
      'expense_final' => mjl_ui_expense_status(6),
      'expense_disbursed' => mjl_ui_expense_status(7),
      'unknown' => mjl_ui_activity_status('future-state'),
      'warning' => mjl_ui_system_state('warning', 'Attention', 'Action requise.'),
    ]);
  `);

  expect(result.activity_submitted).toEqual({ label: 'Soumise', tone: 'warning' });
  expect(result.expense_final).toEqual({ label: 'Validée définitivement', tone: 'success' });
  expect(result.expense_disbursed).toEqual({ label: 'Décaissée', tone: 'success' });
  expect(result.unknown).toEqual({ label: 'Statut non reconnu', tone: 'neutral' });
  expect(result.warning).toContain('role="status"');
  expect(result.warning).toContain('mjl-system-state-warning');
  expect(result.warning).not.toContain('future-state');
});

test('partial-result aggregation preserves successful items and stable ordering', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_timeline_result.lib.php';
    echo json_encode(mjl_timeline_aggregate_sources([
      ['source' => 'workflow', 'order' => 1, 'items' => [
        ['rowid' => 8, 'sort_date' => '2026-07-01 10:00:00', 'title' => 'Deuxième'],
      ], 'errors' => []],
      ['source' => 'comments', 'order' => 2, 'items' => [
        ['rowid' => 3, 'sort_date' => '2026-07-01 10:00:00', 'title' => 'Troisième'],
      ], 'errors' => []],
      ['source' => 'documents', 'order' => 3, 'items' => [], 'errors' => ['unavailable']],
      ['source' => 'creation', 'order' => 0, 'items' => [
        ['rowid' => 1, 'sort_date' => '2026-06-30 09:00:00', 'title' => 'Première'],
      ], 'errors' => []],
    ]));
  `);

  expect(result.items.map((item) => item.title)).toEqual(['Première', 'Deuxième', 'Troisième']);
  expect(result.errors).toEqual([{ source: 'documents', category: 'unavailable' }]);
});

test('form recovery handles are opaque, one-use, bounded, and context-bound', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_form.lib.php';
    $_SESSION = [];
    $context = [
      'user_id' => 12,
      'entity' => 1,
      'route' => 'activities',
      'form' => 'create',
      'action' => 'create',
      'object_id' => 0,
    ];
    $reason = '';
    $handle = mjl_form_recovery_store($context, [
      'ref' => 'ACT-RECOVERY',
      'label' => 'Valeur conservée',
      'token' => 'must-not-be-stored',
      'supporting_document' => '/private/path/file.pdf',
    ], ['ref', 'label'], $reason);
    $crossUser = $context;
    $crossUser['user_id'] = 99;
    $rejected = mjl_form_recovery_consume($handle, $crossUser);
    $accepted = mjl_form_recovery_consume($handle, $context);
    $replayed = mjl_form_recovery_consume($handle, $context);
    $tabOne = mjl_form_recovery_store($context, ['ref' => 'TAB-1'], ['ref'], $reason);
    $tabTwo = mjl_form_recovery_store($context, ['ref' => 'TAB-2'], ['ref'], $reason);
    $crossEntity = $context;
    $crossEntity['entity'] = 2;
    $entityRejected = mjl_form_recovery_consume($tabOne, $crossEntity);
    $tabOneAccepted = mjl_form_recovery_consume($tabOne, $context);
    $tabTwoAccepted = mjl_form_recovery_consume($tabTwo, $context);
    $expired = mjl_form_recovery_store($context, ['ref' => 'EXPIRED'], ['ref'], $reason);
    $_SESSION['mjl_form_recovery'][$expired]['expires_at'] = time();
    $expiredRejected = mjl_form_recovery_consume($expired, $context);
    $_SESSION = [];
    $pendingHandles = [];
    for ($i = 0; $i < 12; $i++) {
      $pendingHandles[] = mjl_form_recovery_store($context, ['ref' => 'PENDING-'.$i], ['ref'], $reason);
    }
    $boundedCount = mjl_form_recovery_pending_count();
    $_SESSION = [];
    $large = str_repeat('x', 16384);
    $capacityReason = '';
    $capacityHandle = mjl_form_recovery_store(
      $context,
      ['one' => $large, 'two' => $large, 'three' => $large, 'four' => $large],
      ['one', 'two', 'three', 'four'],
      $capacityReason
    );
    echo json_encode([
      'handle' => $handle,
      'reason' => $reason,
      'rejected' => $rejected,
      'accepted' => $accepted,
      'replayed' => $replayed,
      'tab_handles_differ' => $tabOne !== $tabTwo,
      'entity_rejected' => $entityRejected,
      'tab_one' => $tabOneAccepted,
      'tab_two' => $tabTwoAccepted,
      'expired_rejected' => $expiredRejected,
      'bounded_count' => $boundedCount,
      'capacity_handle' => $capacityHandle,
      'capacity_reason' => $capacityReason,
    ]);
  `);

  expect(result.handle).toMatch(/^[a-f0-9]{32}$/);
  expect(result.reason).toBe('');
  expect(result.rejected).toBeNull();
  expect(result.accepted.values).toEqual({ ref: 'ACT-RECOVERY', label: 'Valeur conservée' });
  expect(result.replayed).toBeNull();
  expect(result.tab_handles_differ).toBe(true);
  expect(result.entity_rejected).toBeNull();
  expect(result.tab_one.values.ref).toBe('TAB-1');
  expect(result.tab_two.values.ref).toBe('TAB-2');
  expect(result.expired_rejected).toBeNull();
  expect(result.bounded_count).toBe(10);
  expect(result.capacity_handle).toBe('');
  expect(result.capacity_reason).toBe('capacity');
});

test('technical logging redacts sensitive values, SQL, and paths', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_ui.lib.php';
    $log = sys_get_temp_dir().'/mjl-ui-'.bin2hex(random_bytes(6)).'.log';
    ini_set('error_log', $log);
    mjl_ui_log_error('database', [
      'route' => 'activities',
      'action' => 'create',
      'entity' => 1,
      'user_id' => 12,
      'token' => 'secret-token',
      'comment' => 'private comment',
    ], "SQLSTATE duplicate token=secret SELECT * FROM private_table /private/docs/file.pdf");
    $contents = file_get_contents($log);
    unlink($log);
    echo json_encode(['log' => $contents]);
  `);

  expect(result.log).toContain('"route":"activities"');
  expect(result.log).toContain('"category":"database"');
  expect(result.log).not.toContain('secret-token');
  expect(result.log).not.toContain('private comment');
  expect(result.log).not.toContain('private_table');
  expect(result.log).not.toContain('/private/docs');
});

test('table request normalization fails closed and clamps safe pages', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_table.lib.php';
    echo json_encode([
      'defaults' => mjl_table_normalize_request(
        ['status' => '', 'project' => '', 'risk' => '', 'sort' => '', 'page' => ''],
        ['0', '3', '7'],
        [42, 43],
        0,
        50
      ),
      'valid' => mjl_table_normalize_request(
        ['status' => '3', 'project' => '42', 'risk' => 'overdue', 'sort' => 'deadline', 'page' => '999'],
        ['0', '3', '7'],
        [42, 43],
        120,
        50
      ),
      'invalid_status' => mjl_table_normalize_request(
        ['status' => 'DROP TABLE', 'page' => '-2'],
        ['0', '3', '7'],
        [42],
        120,
        50
      ),
      'inaccessible_project' => mjl_table_normalize_request(
        ['project' => '999'],
        ['0', '3', '7'],
        [42],
        120,
        50
      ),
    ]);
  `);

  expect(result.defaults).toMatchObject({
    status: '',
    project: 0,
    risk: 'all',
    sort: 'priority',
    page: 1,
    fail_closed: false,
  });
  expect(result.valid).toMatchObject({
    status: '3',
    project: 42,
    risk: 'overdue',
    sort: 'deadline',
    page: 3,
    page_size: 50,
    fail_closed: false,
  });
  expect(result.invalid_status).toMatchObject({ page: 1, fail_closed: true });
  expect(result.inaccessible_project).toMatchObject({ project: 999, fail_closed: true });
});

test('activity form progressively enhances linked French validation errors', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');

  const form = page.locator('form[data-mjl-validate][data-mjl-form="activity-create"]');
  await expect(form).toHaveAttribute('novalidate', '');
  await form.getByRole('button', { name: 'Créer l’activité' }).click();

  const summary = form.locator('[data-mjl-error-summary]');
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('link', { name: 'La référence est obligatoire.' })).toHaveAttribute('href', '#mjl-field-ref');
  await expect(form.locator('#mjl-field-ref')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.locator('#mjl-field-ref-error')).toHaveText('La référence est obligatoire.');
});

test('activity server recovery retains safe values once and rejects invalid security context', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');

  const form = page.locator('form[data-mjl-form="activity-create"]');
  const token = await form.locator('input[name="token"]').inputValue();
  const project = await form.locator('select[name="fk_project"] option:not([value=""])').first().getAttribute('value');
  const convention = await form.locator('select[name="fk_convention"] option:not([value=""])').first().getAttribute('value');
  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token,
      action: 'create',
      ref: 'PHASE2-RECOVERY',
      label: 'Valeur sûre conservée',
      fk_project: project,
      fk_convention: convention,
      date_start: '2026-08-02',
      date_end: '2026-08-01',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const location = response.headers().location;
  expect(location).toMatch(/mjl_recovery=[a-f0-9]{32}/);

  await page.goto(location);
  await expect(page.locator('#mjl-field-ref')).toHaveValue('PHASE2-RECOVERY');
  await expect(page.locator('#mjl-field-label')).toHaveValue('Valeur sûre conservée');
  await expect(page.locator('#mjl-field-date_end-error')).toContainText('postérieure');

  await page.goto(location);
  await expect(page.locator('#mjl-field-ref')).toHaveValue('');

  const invalidCsrf = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token: 'invalid',
      action: 'create',
      ref: '',
      label: '',
      fk_project: project,
      fk_convention: convention,
    },
    maxRedirects: 0,
  });
  expect(invalidCsrf.status()).toBe(403);
  expect(invalidCsrf.headers().location || '').not.toContain('mjl_recovery');

  const refreshedToken = await form.locator('input[name="token"]').inputValue();
  const outOfScope = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token: refreshedToken,
      action: 'create',
      ref: '',
      label: '',
      fk_project: '999999999',
      fk_convention: convention,
    },
    maxRedirects: 0,
  });
  expect(outOfScope.status()).toBe(403);
  expect(outOfScope.headers().location || '').not.toContain('mjl_recovery');
});

test('activity form keeps native validation without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');
  const form = page.locator('form[data-mjl-form="activity-create"]');
  await expect(form).not.toHaveAttribute('novalidate', '');
  await expect(form.locator('#mjl-field-ref')).toHaveAttribute('required', '');
  await form.getByRole('button', { name: 'Créer l’activité' }).click();
  await expect(page).toHaveURL(/activities\.php$/);
  await expect(form.locator('#mjl-field-ref')).toBeFocused();
  await context.close();
});

test('activity list exposes normalized filters, eight columns, and fail-closed empty state', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');

  const filters = page.locator('form[data-mjl-table-filters="activities"]');
  await expect(filters.getByLabel('Statut')).toBeVisible();
  await expect(filters.getByLabel('Projet')).toBeVisible();
  await expect(filters.getByLabel('Risque échéance')).toBeVisible();
  await expect(filters.getByLabel('Trier par')).toBeVisible();

  const table = page.getByRole('table', { name: 'Activités du périmètre' });
  await expect(table.getByRole('columnheader')).toHaveCount(8);
  await expect(table.getByRole('columnheader').first()).toHaveText('Activité');
  await expect(table.getByRole('columnheader').nth(1)).toHaveText('Statut');
  await expect(table.getByRole('columnheader').last()).toHaveText('Ouvrir');

  await page.goto('/custom/mjlfinancement/activities.php?status=not-a-status&page=-2');
  await expect(page.getByText('Aucune activité ne correspond aux filtres appliqués.')).toBeVisible();
  await expect(page.locator('[data-mjl-scoped-count]')).toHaveText('0');
  await expect(page.locator('body')).not.toContainText(/SELECT |SQLSTATE|Unknown column|syntax error/i);
});

test('activity table retains semantic desktop layout and labeled cards at 768px and 390px', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/custom/mjlfinancement/activities.php');
  const createForm = page.locator('form[data-mjl-form="activity-create"]');
  const ref = `P2-CARD-${Date.now()}`;
  cleanupActivityRefs.add(ref);
  const createResponse = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token: await createForm.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref,
      label: 'Activité responsive Phase 2',
      fk_project: await createForm.locator('select[name="fk_project"] option', { hasText: 'PRJ-JE-2026' }).getAttribute('value'),
      fk_convention: await createForm.locator('select[name="fk_convention"] option', { hasText: 'CONV-UNICEF-2026-001' }).getAttribute('value'),
    },
    maxRedirects: 0,
  });
  expect(createResponse.status()).toBe(302);
  expect(createResponse.headers().location).toMatch(/activities\.php\?id=\d+$/);
  await page.goto('/custom/mjlfinancement/activities.php');
  const table = page.getByRole('table', { name: 'Activités du périmètre' });
  await expect(table.locator('thead')).toHaveCSS('position', 'static');

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const firstCard = table.locator('tbody tr:not(.mjl-table-empty-row)').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator('td[data-label="Activité"]')).toHaveCSS('display', 'grid');
    await expect(firstCard.locator('td[data-label="Statut"]')).toBeVisible();
    await expect(firstCard.locator('td[data-label="Ouvrir"] a')).toHaveText('Ouvrir');
  }
});

test('expense consequences are present without JavaScript and enhanced to a keyboard modal', async ({ browser, page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/expenses.php?id=13');

  const form = page.locator('form[data-mjl-confirm="disburse"]');
  await expect(form.locator('[data-mjl-consequence]')).toContainText('Le décaissement confirme que les fonds ont effectivement été versés.');
  await form.getByLabel('Beneficiaire').fill('Bénéficiaire Phase 2');
  await form.getByLabel('Date decaissement').fill('2026-07-29');
  const trigger = form.getByRole('button', { name: 'Enregistrer le decaissement' });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Confirmer la décision' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Bénéficiaire Phase 2');
  await expect(dialog).toContainText('29/07/2026');
  await dialog.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJsContext.newPage();
  await login(noJsPage, 'dpaf.mjl');
  await noJsPage.goto('/custom/mjlfinancement/expenses.php?id=13');
  const noJsForm = noJsPage.locator('form[action*="expenses.php"][data-mjl-confirm="disburse"]');
  await expect(noJsForm.locator('[data-mjl-consequence]')).toBeVisible();
  await expect(noJsForm.getByRole('button', { name: 'Enregistrer le decaissement' })).toBeEnabled();
  await noJsContext.close();

  await login(page, 'superviseur.n1');
  await page.goto('/custom/mjlfinancement/expenses.php?id=14');
  await expect(page.locator('form input[name="action"][value="prevalidate"]')).toHaveCount(1);
  await expect(page.locator('form[data-mjl-confirm="prevalidate"]')).toHaveCount(0);
});
