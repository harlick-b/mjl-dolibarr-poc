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

async function assertThreeRoutePages(page, baseUrl, resourceLabel) {
  const retained = new URL(baseUrl, 'http://localhost').searchParams;
  for (const current of [1, 2, 3]) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    await page.goto(`${baseUrl}${separator}page=${current}`);
    const nav = page.locator(`nav[aria-label="Pagination des ${resourceLabel}"]`);
    await expect(nav).toBeVisible();
    const rows = page.locator('table.noborder').last().locator('tr.oddeven');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThanOrEqual(50);
    const previous = nav.getByRole('link', { name: 'Page précédente' });
    const next = nav.getByRole('link', { name: 'Page suivante' });
    await expect(previous).toHaveCount(current === 1 ? 0 : 1);
    await expect(next).toHaveCount(current === 3 ? 0 : 1);
    for (const [link, expectedPage] of [[previous, current - 1], [next, current + 1]]) {
      if (expectedPage < 1 || expectedPage > 3) continue;
      const href = new URL(await link.getAttribute('href'), 'http://localhost');
      for (const [key, value] of retained.entries()) expect(href.searchParams.get(key)).toBe(value);
      expect(Number(href.searchParams.get('page') || '1')).toBe(expectedPage);
    }
  }
}

async function formValues(form) {
  return form.evaluate((node) => Object.fromEntries(new FormData(node).entries()));
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
      DELETE FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'P3V2-PAGE-%';
      DELETE FROM llx_mjlfinancement_workflow_action
        WHERE (object_type = 'mjlfinancement_convention'
          AND object_id IN (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P3V2-FEEDBACK-CONV'))
        OR (object_type = 'mjlfinancement_budget_line'
          AND object_id IN (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P3V2-FEEDBACK-BL'))
        OR (object_type = 'mjlfinancement_fund_receipt'
          AND object_id IN (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'P3V2-FEEDBACK-FR-%'));
      DELETE FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'P3V2-FEEDBACK-FR-%';
      DELETE FROM llx_mjlfinancement_budget_line WHERE ref = 'P3V2-FEEDBACK-BL';
      DELETE FROM llx_mjlfinancement_convention WHERE ref = 'P3V2-FEEDBACK-CONV';
      DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P3V2-PAGE-%';
      DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P3V2-PAGE-%';
      DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P3V2-PAGE-%';
      DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'P3V2-PAGE-%';
      DELETE FROM llx_projet WHERE ref LIKE 'P3V2-PAGE-%';
      DELETE FROM llx_societe WHERE nom LIKE 'P3V2-PAGE-PARTNER-%' AND import_key = 'P3V2PAGE';
    `,
  ], { cwd: projectRoot, stdio: 'pipe' });
}

function setupFinanceFeedbackFixtures() {
  cleanupPhase3V2Fixtures();
  execFile('docker', [
    'compose', 'exec', '-T', 'mariadb', 'mariadb',
    '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e',
    `
      SET @partner = (SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = 'UNICEF' LIMIT 1);
      SET @project = (SELECT rowid FROM llx_projet WHERE entity = 1 AND ref = 'PRJ-JE-2026' LIMIT 1);
      SET @active_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE entity = 1 AND ref = 'CONV-UNICEF-2026-001' LIMIT 1);
      INSERT INTO llx_mjlfinancement_convention
        (entity, ref, title, fk_soc, fk_project, total_amount, currency_code, date_creation, fk_user_creat, import_key, status)
      VALUES
        (1, 'P3V2-FEEDBACK-CONV', 'Feedback convention', @partner, @project, 1000, 'XOF', NOW(), 1, 'P3V2FEEDBACK', 0);
      INSERT INTO llx_mjlfinancement_budget_line
        (entity, ref, label, fk_convention, initial_budget, revised_budget, remaining_amount, fk_project, date_creation, fk_user_creat, import_key, status)
      VALUES
        (1, 'P3V2-FEEDBACK-BL', 'Feedback budget', @active_convention, 1000, 1000, 1000, @project, NOW(), 1, 'P3V2FEEDBACK', 0);
      INSERT INTO llx_mjlfinancement_fund_receipt
        (entity, ref, fk_soc, fk_project, fk_convention, amount, reception_date, comment, date_creation, fk_user_creat, import_key, status)
      VALUES
        (1, 'P3V2-FEEDBACK-FR-AMOUNT', @partner, @project, @active_convention, 0, '2026-07-30', 'Feedback amount', NOW(), 1, 'P3V2FEEDBACK', 0),
        (1, 'P3V2-FEEDBACK-FR-DATE', @partner, @project, @active_convention, 100, NULL, 'Feedback date', NOW(), 1, 'P3V2FEEDBACK', 0),
        (1, 'P3V2-FEEDBACK-FR-PROOF', @partner, @project, @active_convention, 100, '2026-07-30', 'Feedback proof', NOW(), 1, 'P3V2FEEDBACK', 0),
        (1, 'P3V2-FEEDBACK-FR-REASON', @partner, @project, @active_convention, 100, '2026-07-30', 'Feedback reason', NOW(), 1, 'P3V2FEEDBACK', 0);
    `,
  ], { cwd: projectRoot, stdio: 'pipe' });
}

function fixtureId(table, ref) {
  return Number(String(execFile('docker', [
    'compose', 'exec', '-T', 'mariadb', 'mariadb',
    '-N', '-B', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e',
    `SELECT rowid FROM ${table} WHERE entity = 1 AND ref = '${ref}' LIMIT 1`,
  ], { cwd: projectRoot, encoding: 'utf8' })).trim());
}

function financeProductionRendererFailures(route) {
  const config = {
    conventions: {
      file: 'conventions.php',
      alias: 'c',
      list: 'mjl_conventions_render_list',
      detail: 'mjl_conventions_fetch_detail',
      timeline: 'mjl_conventions_timeline_items',
      filters: "array('partner_id' => 0, 'project_id' => 0, 'status' => '', 'sort' => 'recent', 'page' => 1, 'page_size' => 50, 'fail_closed' => false)",
    },
    budgetlines: {
      file: 'budgetlines.php',
      alias: 'bl',
      list: 'mjl_budgetlines_render_list',
      detail: 'mjl_budgetlines_fetch_detail',
      timeline: 'mjl_budgetlines_timeline_items',
      filters: "array('partner_id' => 0, 'project_id' => 0, 'convention_id' => 0, 'activity_id' => 0, 'status' => '', 'sort' => 'recent', 'page' => 1, 'page_size' => 50, 'fail_closed' => false)",
    },
    fundreceipts: {
      file: 'fundreceipts.php',
      alias: 'fr',
      list: 'mjl_fundreceipts_render_list',
      detail: 'mjl_fundreceipts_fetch_detail',
      timeline: 'mjl_fundreceipts_timeline_items',
      filters: "array('partner_id' => 0, 'project_id' => 0, 'convention_id' => 0, 'status' => '', 'date_start' => '', 'date_end' => '', 'sort' => 'recent', 'page' => 1, 'page_size' => 50, 'fail_closed' => false)",
    },
  }[route];
  const code = `
    define('NOLOGIN', 1);
    define('MJL_FINANCE_RENDERERS_ONLY', true);
    chdir('/var/www/html/custom/mjlfinancement');
    require '${config.file}';
    class P3ProductionFailureAdapter {
      private $inner;
      private $mode;
      private $alias;
      public function __construct($inner, $mode, $alias) {
        $this->inner = $inner;
        $this->mode = $mode;
        $this->alias = $alias;
      }
      public function query($sql) {
        $fails = ($this->mode === 'list' && strpos($sql, ' LIMIT 51 OFFSET ') !== false)
          || ($this->mode === 'fetch_detail' && strpos($sql, 'SELECT '.$this->alias.'.rowid') === 0)
          || ($this->mode === 'timeline' && strpos($sql, 'mjlfinancement_workflow_action w') !== false);
        return $fails ? false : $this->inner->query($sql);
      }
      public function __call($name, $arguments) {
        return call_user_func_array(array($this->inner, $name), $arguments);
      }
      public function __get($name) {
        return $this->inner->$name;
      }
    }
    $realDb = $db;
    $filters = ${config.filters};
    $db = new P3ProductionFailureAdapter($realDb, 'list', '${config.alias}');
    ob_start();
    ${config.list}($filters);
    $listHtml = ob_get_clean();
    unset($_SESSION['dol_events']);
    $db = new P3ProductionFailureAdapter($realDb, 'fetch_detail', '${config.alias}');
    $detail = ${config.detail}(23);
    $detailEvents = isset($_SESSION['dol_events']) ? $_SESSION['dol_events'] : array();
    unset($_SESSION['dol_events']);
    $db = new P3ProductionFailureAdapter($realDb, 'timeline', '${config.alias}');
    $timeline = ${config.timeline}(array(
      'rowid' => 23,
      'date_creation' => '2026-07-30 12:00:00',
      'creator_login' => 'fixture.agent'
    ));
    $timelineEvents = isset($_SESSION['dol_events']) ? $_SESSION['dol_events'] : array();
    $db = $realDb;
    echo json_encode(array(
      'list_html' => $listHtml,
      'detail' => $detail,
      'detail_events' => $detailEvents,
      'timeline' => $timeline,
      'timeline_events' => $timelineEvents
    ));
  `;
  return JSON.parse(String(execFile('docker', [
    'compose', 'exec', '-T', 'dolibarr', 'php', '-r', code,
  ], { cwd: projectRoot, encoding: 'utf8' })));
}

function setupPhase3PaginationFixtures() {
  execFile('docker', [
    'compose', 'exec', '-T', 'mariadb', 'mariadb',
    '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e',
    `
      SET @partner = (SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = 'UNICEF' LIMIT 1);
      SET @project = (SELECT rowid FROM llx_projet WHERE entity = 1 AND ref = 'PRJ-JE-2026' LIMIT 1);
      SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE entity = 1 AND ref = 'CONV-UNICEF-2026-001' LIMIT 1);
      SET @budget = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE entity = 1 AND ref = 'BL-JE-001' LIMIT 1);
      SET @agent = (SELECT rowid FROM llx_user WHERE entity IN (0, 1) AND login = 'agent.mjl' LIMIT 1);
      INSERT INTO llx_societe (entity, nom, name_alias, status, client, fournisseur, fk_stcomm, datec, fk_user_creat, import_key)
      SELECT 1, CONCAT('P3V2-PAGE-PARTNER-', LPAD(seq, 3, '0')), 'P3V2_E2E', 1, 0, 0, 0, NOW(), 1, 'P3V2PAGE' FROM seq_1_to_101;
      INSERT INTO llx_projet (entity, ref, title, fk_soc, fk_statut, datec, fk_user_creat, import_key)
      SELECT 1, CONCAT('P3V2-PAGE-PROJ-', LPAD(seq, 3, '0')), 'P3V2_E2E pagination', @partner, 1, NOW(), 1, 'P3V2PAGE' FROM seq_1_to_101;
      INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, total_amount, currency_code, date_creation, fk_user_creat, import_key, status)
      SELECT 1, CONCAT('P3V2-PAGE-CONV-', LPAD(seq, 3, '0')), 'P3V2_E2E pagination', @partner, @project, 1000 + seq, 'XOF', NOW(), 1, 'P3V2PAGE', 1 FROM seq_1_to_101;
      INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_creation, fk_user_creat, import_key, status, fk_user_responsible)
      SELECT 1, CONCAT('P3V2-PAGE-ACT-', LPAD(seq, 3, '0')), 'P3V2_E2E pagination', @project, @convention, NOW(), @agent, 'P3V2PAGE', 0, @agent FROM seq_1_to_101;
      INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_convention, initial_budget, revised_budget, remaining_amount, fk_project, date_creation, fk_user_creat, import_key, status)
      SELECT 1, CONCAT('P3V2-PAGE-BL-', LPAD(seq, 3, '0')), 'P3V2_E2E pagination', @convention, 1000 + seq, 1000 + seq, 1000 + seq, @project, NOW(), 1, 'P3V2PAGE', 1 FROM seq_1_to_101;
      INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_budget_line, amount, expense_date, description, date_creation, fk_user_creat, import_key, status)
      SELECT 1, CONCAT('P3V2-PAGE-EXP-', LPAD(seq, 3, '0')), @project, @convention, @budget, 10 + seq, '2026-07-30', 'P3V2_E2E pagination', NOW(), @agent, 'P3V2PAGE', 0 FROM seq_1_to_101;
      INSERT INTO llx_mjlfinancement_fund_receipt (entity, ref, fk_soc, fk_convention, amount, reception_date, comment, date_creation, fk_user_creat, import_key, fk_project, status)
      SELECT 1, CONCAT('P3V2-PAGE-FR-', LPAD(seq, 3, '0')), @partner, @convention, 100 + seq, '2026-07-30', 'P3V2_E2E pagination', NOW(), 1, 'P3V2PAGE', @project, 0 FROM seq_1_to_101;
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
      'states' => array_map(function ($state) {
        return mjl_journey_render_document_panel([
          'state' => $state,
          'documents' => [[
            'label' => 'preuve.pdf',
            'url' => '/custom/mjlfinancement/documentdownload.php?type=activity&id=7',
          ]],
          'action' => [
            'label' => 'Ajouter',
            'url' => '/custom/mjlfinancement/activities.php?id=7',
          ],
        ]);
      }, ['missing', 'downloadable', 'unavailable', 'upload-failed', 'forbidden', 'read-only', 'invented']),
    ]);
  `);

  expect(result.summary).toContain('Synthèse &lt;script&gt;');
  expect(result.summary).toContain('&lt;b&gt;Soumise&lt;/b&gt;');
  expect(result.summary).toContain('mjl-status-warning');
  expect(result.summary).toContain('mjl-status-neutral');
  expect(result.documents).toContain('mjl-document-summary-downloadable');
  expect(result.documents).toContain('/custom/mjlfinancement/documentdownload.php?type=activity&amp;id=7');
  expect(result.documents).not.toContain('attacker.example');
  expect(result.states).toHaveLength(7);
  for (const [index, state] of ['missing', 'downloadable', 'unavailable', 'upload-failed', 'forbidden', 'read-only', 'unavailable'].entries()) {
    expect(result.states[index]).toContain(`mjl-document-summary-${state}`);
  }
  for (const index of [0, 3]) expect(result.states[index]).toContain('>Ajouter<');
  for (const index of [1, 2, 4, 5, 6]) expect(result.states[index]).not.toContain('>Ajouter<');
  for (const index of [1, 5]) expect(result.states[index]).toContain('documentdownload.php');
  for (const index of [0, 2, 3, 4, 6]) expect(result.states[index]).not.toContain('documentdownload.php');
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
      'first' => mjl_table_render_pagination('/projects.php', array_merge($filters, ['page' => 1]), 151, false, true, 'projets'),
      'middle' => mjl_table_render_pagination('/projects.php', array_merge($filters, ['page' => 2]), 151, true, true, 'projets'),
      'last' => mjl_table_render_pagination('/projects.php', array_merge($filters, ['page' => 4]), 151, true, false, 'projets'),
    ]);
  `);

  expect(result.filters.fail_closed).toBe(false);
  expect(result.query).toContain('partner=12');
  expect(result.query).toContain('status=1');
  expect(result.query).toContain('sort=recent');
  expect(result.query).toContain('page=2');
  expect(result.first).toContain('151 projets');
  expect(result.first).not.toContain('Page précédente');
  expect(result.first).toContain('Page suivante');
  expect(result.middle).toContain('Page précédente');
  expect(result.middle).toContain('Page suivante');
  expect(result.last).toContain('Page précédente');
  expect(result.last).not.toContain('Page suivante');
  expect(result.middle).toContain('aria-label="Pagination des projets"');
});

test('Phase 3 finance row and count queries share exact scope/filter fragments', () => {
  for (const route of ['conventions.php', 'budgetlines.php', 'fundreceipts.php']) {
    const source = String(execFile('php', ['-r', `echo file_get_contents('custom/mjlfinancement/${route}');`], {
      cwd: projectRoot,
      encoding: 'utf8',
    }));
    const fragment = route === 'conventions.php' ? '$from.$where' : '$from.$whereSql';
    expect(source).toContain(`mjl_table_count_or_null($db, 'SELECT COUNT(*) AS nb'.${fragment})`);
    expect(source).toContain(`$sql .= ${fragment};`);
    expect(source).toMatch(/ORDER BY [^;]+rowid (?:ASC|DESC)/);
    expect(source).toContain("['page_size']) + 1");
  }
});

test('Phase 3 count-query failure remains distinct from a successful row source', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_table.lib.php';
    class P3CountFailureDb {
      public function query($sql) { return false; }
      public function fetch_object($result) { return false; }
    }
    echo json_encode([
      'total' => mjl_table_count_or_null(new P3CountFailureDb(), 'SELECT COUNT(*) AS nb'),
      'rows_available' => true,
      'pagination' => mjl_table_render_pagination('/route.php', ['page' => 2, 'page_size' => 50], null, true, true, 'éléments'),
    ]);
  `);
  expect(result.total).toBeNull();
  expect(result.rows_available).toBe(true);
  expect(result.pagination).toContain('total indisponible');
  expect(result.pagination).toContain('Page précédente');
  expect(result.pagination).toContain('Page suivante');
});

test('Phase 3 dedicated evidence ledger binds every mandatory gate to an executed regression', () => {
  const evidenceFiles = [
    'phase1-v2-shell-foundation.spec.js',
    'phase2-v2-operational-components.spec.js',
    'phase05-expense-disbursement-workflow.spec.js',
    'phase11-expense-workflow.spec.js',
    'phase14-convention-management.spec.js',
    'phase15-budget-line-management.spec.js',
    'phase16-fund-receipt-management.spec.js',
    'phase18-activity-convention-documents.spec.js',
    'phase3-v2-core-journeys.spec.js',
    'phase4-auth-access.spec.js',
  ];
  const evidence = evidenceFiles.map((file) => String(execFile('php', ['-r', `echo file_get_contents('tests/e2e/${file}');`], {
    cwd: projectRoot,
    encoding: 'utf8',
  }))).join('\n');
  const requiredEvidence = [
    /initially empty scope from filtered-empty recovery/,
    /partial-result aggregation preserves successful items/,
    /unavailable, and missing labels/,
    /upload failures/,
    /without JavaScript/,
    /all four no-self decisions/,
    /invalid CSRF/,
    /wrong role and self-action direct POST/,
    /cross-entity, orphan, and path-tampered/,
    /cross-scope related rows/,
    /semantic desktop layout at 1366px\/1024px and labeled cards at 768px\/390px/,
    /stale replays/,
    /locked-field edits/,
    /computed amount tampering/,
    /stable names/,
    /public registration remains absent/,
  ];
  for (const proof of requiredEvidence) expect(evidence).toMatch(proof);
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

test('Phase 3C finance recovery registries are exact and exclude uploads, deletes, and unknown actions', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_finance_recovery.lib.php';
    echo json_encode([
      'conventions' => mjl_finance_recovery_registry('conventions'),
      'budgetlines' => mjl_finance_recovery_registry('budgetlines'),
      'fundreceipts' => mjl_finance_recovery_registry('fundreceipts'),
      'upload' => mjl_finance_recovery_config('fundreceipts', 'upload'),
      'delete' => mjl_finance_recovery_config('conventions', 'delete'),
      'unknown' => mjl_finance_recovery_config('future', 'create'),
    ]);
  `);

  expect(Object.keys(result.conventions).sort()).toEqual(['activate', 'add_exchange', 'close', 'create', 'update']);
  expect(Object.keys(result.budgetlines).sort()).toEqual(['activate', 'add_exchange', 'create', 'update']);
  expect(Object.keys(result.fundreceipts).sort()).toEqual(['add_exchange', 'create', 'not_received', 'received', 'update']);
  expect(result.upload).toBeNull();
  expect(result.delete).toBeNull();
  expect(result.unknown).toBeNull();
  expect(result.fundreceipts.create.fields).not.toContain('fk_soc');
  expect(result.budgetlines.update.fields).not.toContain('remaining_amount');
  for (const registry of [result.conventions, result.budgetlines, result.fundreceipts]) {
    for (const config of Object.values(registry)) {
      expect(config.fields.some((field) => field.startsWith('fk_'))).toBe(false);
    }
  }
});

test('Phase 3 remediation recovery registry leaf rejects every malformed registry as a whole', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_recovery_registry.lib.php';
    $valid = [
      'create' => ['form' => 'create', 'fields' => ['ref', 'title']],
      'add_exchange' => ['form' => 'comment', 'fields' => ['message']],
    ];
    $invalid = [
      ['Bad Action' => ['form' => 'create', 'fields' => ['ref']]],
      ['create' => 'not-an-array'],
      ['create' => ['form' => 'create', 'fields' => ['ref'], 'extra' => true]],
      ['create' => ['form' => '', 'fields' => ['ref']]],
      ['create' => ['form' => ['create'], 'fields' => ['ref']]],
      ['create' => ['form' => 'create', 'fields' => 'ref']],
      ['create' => ['form' => 'create', 'fields' => [7]]],
      ['create' => ['form' => 'create', 'fields' => [['ref']]]],
      ['create' => ['form' => 'create', 'fields' => ['ref', 'ref']]],
      ['create' => ['form' => 'create', 'fields' => ['token']]],
      ['upload' => ['form' => 'create', 'fields' => ['ref']]],
    ];
    $invalidResults = [];
    foreach ($invalid as $registry) {
      $invalidResults[] = [
        'config' => mjl_recovery_registry_config($registry, 'create'),
        'consume' => mjl_recovery_registry_consume_allowlist($registry),
      ];
    }
    echo json_encode([
      'config' => mjl_recovery_registry_config($valid, 'create'),
      'missing' => mjl_recovery_registry_config($valid, 'missing'),
      'consume' => mjl_recovery_registry_consume_allowlist($valid),
      'invalid' => $invalidResults,
    ]);
  `);

  expect(result.config).toEqual({ form: 'create', fields: ['ref', 'title'] });
  expect(result.missing).toBeNull();
  expect(result.consume).toEqual({ create: ['create'], comment: ['add_exchange'] });
  for (const invalid of result.invalid) {
    expect(invalid.config).toBeNull();
    expect(invalid.consume).toEqual([]);
  }
});

test('Phase 3 remediation recovery wrappers load standalone through the shared leaf', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_activity_recovery.lib.php';
    require 'custom/mjlfinancement/lib/mjl_project_recovery.lib.php';
    require 'custom/mjlfinancement/lib/mjl_expense_recovery.lib.php';
    require 'custom/mjlfinancement/lib/mjl_finance_recovery.lib.php';
    echo json_encode([
      'leaf' => function_exists('mjl_recovery_registry_config'),
      'activity' => mjl_activity_recovery_config('create'),
      'project' => mjl_project_recovery_config('create'),
      'expense' => mjl_expense_recovery_config('create'),
      'finance' => mjl_finance_recovery_config('conventions', 'create'),
    ]);
  `);

  expect(result.leaf).toBe(true);
  for (const config of [result.activity, result.project, result.expense, result.finance]) {
    expect(config.form).toBeTruthy();
    expect(Array.isArray(config.fields)).toBe(true);
  }
});

test('Phase 3C finance failures keep technical diagnostics out of browser messages', () => {
  const routes = ['conventions.php', 'budgetlines.php', 'fundreceipts.php'];
  for (const route of routes) {
    const source = String(execFile('php', ['-r', `echo file_get_contents('custom/mjlfinancement/${route}');`], {
      cwd: projectRoot,
      encoding: 'utf8',
    }));
    expect(source).toContain('mjl_finance_feedback_domain(');
    expect(source).toContain('mjl_finance_source_query(');
    expect(source).not.toMatch(/setEventMessages\(\$[A-Za-z]+->error/);
    expect(source).not.toMatch(/setEventMessages\(\$db->lasterror/);
    expect(source).not.toMatch(/mjl_finance_feedback_domain\([^;]*,\s*\$action\s*,/);
  }
});

test('Phase 3 remediation finance feedback classifies only exact allowlisted domain failures', () => {
  const result = phpJson(`
    function mjl_ui_safe_error_message($category = 'unknown') {
      $messages = [
        'database' => 'database-safe',
        'timeline' => 'timeline-safe',
        'validation' => 'validation-safe',
      ];
      return $messages[$category] ?? 'unknown-safe';
    }
    function mjl_ui_log_error($category, $context = [], $driverMessage = '') {}
    require 'custom/mjlfinancement/lib/mjl_finance_feedback.lib.php';
    echo json_encode([
      'field' => mjl_finance_feedback_domain('conventions', 'update', 7, 'Convention title is required'),
      'composite' => mjl_finance_feedback_domain('conventions', 'create', 0, 'Convention reference and title are required'),
      'database' => mjl_finance_feedback_domain('conventions', 'update', 7, 'SQLSTATE raw sentinel'),
      'wrong_action' => mjl_finance_feedback_domain('conventions', 'activate', 7, 'Convention title is required'),
      'case_changed' => mjl_finance_feedback_domain('conventions', 'update', 7, 'convention title is required'),
    ]);
  `);

  expect(result.field).toEqual({
    category: 'validation',
    public_message: 'validation-safe',
    errors: { title: 'L’intitulé est obligatoire.' },
  });
  expect(result.composite).toEqual({
    category: 'validation',
    public_message: 'validation-safe',
    errors: { _form: 'La référence et l’intitulé sont obligatoires.' },
  });
  for (const feedback of [result.database, result.wrong_action, result.case_changed]) {
    expect(feedback).toEqual({
      category: 'unknown',
      public_message: 'unknown-safe',
      errors: {},
    });
  }
});

test('Phase 3 remediation finance source queries expose canonical feedback without raw diagnostics', () => {
  const result = phpJson(`
    $GLOBALS['finance_logs'] = [];
    function mjl_ui_safe_error_message($category = 'unknown') {
      $messages = ['database' => 'database-safe', 'timeline' => 'timeline-safe'];
      return $messages[$category] ?? 'unknown-safe';
    }
    function mjl_ui_log_error($category, $context = [], $driverMessage = '') {
      $GLOBALS['finance_logs'][] = [
        'category' => $category,
        'context' => $context,
        'argument_count' => func_num_args(),
        'driver' => $driverMessage,
      ];
    }
    class P3FinanceFailureDb {
      public $queries = [];
      public function query($sql) {
        $this->queries[] = $sql;
        return false;
      }
      public function lasterror() {
        return 'SQLSTATE raw sentinel /private/path token=secret';
      }
    }
    require 'custom/mjlfinancement/lib/mjl_finance_feedback.lib.php';
    $db = new P3FinanceFailureDb();
    $cases = [];
    foreach (['conventions', 'budgetlines', 'fundreceipts'] as $route) {
      foreach (['list', 'fetch_detail', 'timeline'] as $source) {
        $cases[] = mjl_finance_source_query($db, 'SELECT '.$route.' '.$source.' sentinel', $route, $source, 23);
      }
    }
    $cases[] = mjl_finance_source_query($db, 'SELECT invalid sentinel', 'Conventions', 'LIST', 99);
    $tampered = $cases[0]['feedback'];
    $tampered['public_message'] = 'Injected raw sentinel';
    echo json_encode([
      'cases' => $cases,
      'queries' => $db->queries,
      'logs' => $GLOBALS['finance_logs'],
      'validated_timeline' => mjl_finance_feedback_validate_source('fundreceipts', 'timeline', $cases[8]['feedback']),
      'tampered' => mjl_finance_feedback_validate_source('conventions', 'list', $tampered),
    ]);
  `);

  for (let index = 0; index < 9; index += 1) {
    const category = index % 3 === 2 ? 'timeline' : 'database';
    const publicMessage = category === 'timeline' ? 'timeline-safe' : 'database-safe';
    expect(result.cases[index].feedback).toEqual({ category, public_message: publicMessage, errors: {} });
  }
  expect(result.cases[9].feedback).toEqual({ category: 'unknown', public_message: 'unknown-safe', errors: {} });
  expect(result.validated_timeline).toEqual({ category: 'timeline', public_message: 'timeline-safe', errors: {} });
  expect(result.tampered).toEqual({ category: 'unknown', public_message: 'unknown-safe', errors: {} });
  expect(result.cases.every((entry) => entry.result === false)).toBe(true);
  expect(result.queries).toEqual([
    'SELECT conventions list sentinel',
    'SELECT conventions fetch_detail sentinel',
    'SELECT conventions timeline sentinel',
    'SELECT budgetlines list sentinel',
    'SELECT budgetlines fetch_detail sentinel',
    'SELECT budgetlines timeline sentinel',
    'SELECT fundreceipts list sentinel',
    'SELECT fundreceipts fetch_detail sentinel',
    'SELECT fundreceipts timeline sentinel',
    'SELECT invalid sentinel',
  ]);
  expect(result.logs).toHaveLength(10);
  for (const log of result.logs) {
    expect(log.argument_count).toBe(2);
    expect(log.driver).toBe('');
    expect(JSON.stringify(log)).not.toContain('raw sentinel');
    expect(JSON.stringify(log)).not.toContain('/private/path');
    expect(JSON.stringify(log)).not.toContain('secret');
  }
  expect(result.logs[8]).toMatchObject({
    category: 'database',
    context: {
      route: 'fundreceipts',
      action: 'timeline',
      object_type: 'mjlfinancement_fund_receipt',
      object_id: 23,
    },
  });
  expect(result.logs[9]).toMatchObject({
    category: 'unknown',
    context: {
      route: 'finance',
      action: 'unknown',
      object_type: 'mjlfinancement_unknown',
      object_id: 0,
    },
  });
});

test('Phase 3 remediation production renderers preserve honest states for all nine finance source failures', () => {
  for (const route of ['conventions', 'budgetlines', 'fundreceipts']) {
    const result = financeProductionRendererFailures(route);
    expect(result.list_html).toContain('Le service de donn&eacute;es est temporairement indisponible. Veuillez r&eacute;essayer.');
    expect(result.list_html).toContain('mjl-empty-state-warning');
    expect(result.list_html).not.toContain('<tr class="oddeven">');
    expect(result.list_html).not.toContain('SQLSTATE');
    expect(result.list_html).not.toContain('token=');

    expect(result.detail).toEqual([]);
    expect(result.detail_events.errors).toContain('Le service de données est temporairement indisponible. Veuillez réessayer.');
    expect(JSON.stringify(result.detail_events)).not.toContain('SQLSTATE');

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0]).toMatchObject({ meta: expect.stringContaining('fixture.agent') });
    expect(result.timeline_events.errors).toContain('Une partie de l’historique ne peut pas être chargée pour le moment.');
    expect(JSON.stringify(result.timeline_events)).not.toContain('SQLSTATE');
  }
});

test('Phase 3 remediation finance feedback rejects tampering and filters recovery errors exactly', () => {
  const result = phpJson(`
    function mjl_ui_safe_error_message($category = 'unknown') {
      return $category === 'validation' ? 'validation-safe' : 'unknown-safe';
    }
    function mjl_ui_log_error($category, $context = [], $driverMessage = '') {}
    require 'custom/mjlfinancement/lib/mjl_finance_feedback.lib.php';
    $valid = mjl_finance_feedback_domain('fundreceipts', 'not_received', 17, 'Un motif est obligatoire pour marquer les fonds comme non reçus');
    $changedMessage = $valid;
    $changedMessage['errors']['status_comment'] = 'Injected';
    $extraKey = $valid;
    $extraKey['diagnostic'] = 'SQLSTATE raw sentinel';
    $foreignField = $valid;
    $foreignField['errors']['token'] = 'secret';
    $receivedAmount = mjl_finance_feedback_domain(
      'fundreceipts',
      'received',
      18,
      'Le montant doit être supérieur à zéro avant de marquer les fonds comme reçus'
    );
    $receivedDate = mjl_finance_feedback_domain(
      'fundreceipts',
      'received',
      18,
      'La date de réception est obligatoire avant de marquer les fonds comme reçus'
    );
    $receivedProof = mjl_finance_feedback_domain(
      'fundreceipts',
      'received',
      18,
      'Une preuve documentaire téléchargeable est obligatoire avant de marquer les fonds comme reçus'
    );
    echo json_encode([
      'valid' => mjl_finance_feedback_validate_domain('fundreceipts', 'not_received', $valid),
      'valid_errors' => mjl_finance_feedback_recovery_errors('fundreceipts', 'not_received', $valid, ['status_comment']),
      'changed' => mjl_finance_feedback_validate_domain('fundreceipts', 'not_received', $changedMessage),
      'extra' => mjl_finance_feedback_validate_domain('fundreceipts', 'not_received', $extraKey),
      'foreign' => mjl_finance_feedback_recovery_errors('fundreceipts', 'not_received', $foreignField, ['status_comment']),
      'received_amount' => mjl_finance_feedback_recovery_errors('fundreceipts', 'received', $receivedAmount, ['status_comment']),
      'received_date' => mjl_finance_feedback_recovery_errors('fundreceipts', 'received', $receivedDate, ['status_comment']),
      'received_proof' => mjl_finance_feedback_recovery_errors('fundreceipts', 'received', $receivedProof, ['status_comment']),
      'unknown' => mjl_finance_feedback_recovery_errors(
        'conventions',
        'create',
        mjl_finance_feedback_domain('conventions', 'create', 0, 'Duplicate key raw sentinel'),
        ['ref', 'title']
      ),
    ]);
  `);

  expect(result.valid).toEqual({
    category: 'validation',
    public_message: 'validation-safe',
    errors: { status_comment: 'Le motif est obligatoire.' },
  });
  expect(result.valid_errors).toEqual({ status_comment: 'Le motif est obligatoire.' });
  for (const feedback of [result.changed, result.extra]) {
    expect(feedback).toEqual({ category: 'unknown', public_message: 'unknown-safe', errors: {} });
  }
  expect(result.foreign).toEqual({ _form: 'unknown-safe' });
  expect(result.received_amount).toEqual({ _form: 'Le montant doit être supérieur à zéro.' });
  expect(result.received_date).toEqual({ _form: 'La date de réception est obligatoire.' });
  expect(result.received_proof).toEqual({ _form: 'Une preuve documentaire téléchargeable est obligatoire.' });
  expect(result.unknown).toEqual({ _form: 'unknown-safe' });
});

test('Phase 3C integrity registry resolves valid report anchors and preserves missing-target detection', () => {
  const output = String(execFile('docker', [
    'compose', 'exec', '-T', 'dolibarr', 'php',
    '/var/www/html/custom/mjlfinancement/scripts/smoke_integrity_targets.php',
  ], { cwd: projectRoot, encoding: 'utf8' }));
  expect(output).toContain('MJL integrity target smoke: OK');
});

test('Phase 3C dashboard source failure stays local while successful cards survive', () => {
  const output = String(execFile('docker', [
    'compose', 'exec', '-T', 'dolibarr', 'php',
    '/var/www/html/custom/mjlfinancement/scripts/smoke_dashboard_partial_failure.php',
  ], { cwd: projectRoot, encoding: 'utf8' }));
  expect(output).toContain('MJL dashboard partial failure smoke: OK');
});

test('Phase 3 shared form summaries do not link form-level errors to missing controls', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_form.lib.php';
    echo json_encode([
      'form' => mjl_form_error_summary(['_form' => 'Erreur générale'], 'Corrigez', 'p3-'),
      'field' => mjl_form_error_summary(['ref' => 'Référence requise'], 'Corrigez', 'p3-'),
    ]);
  `);
  expect(result.form).toContain('<span>Erreur générale</span>');
  expect(result.form).not.toContain('href=');
  expect(result.field).toContain('href="#p3-ref"');
});

test('Phase 3C finance recovery is opaque, one-use, and keeps only registered values', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/conventions.php');
  const form = page.locator('form.mjl-activity-form').first();
  const partnerId = await form.locator('select[name="fk_soc"] option', { hasText: 'UNICEF' }).getAttribute('value');
  const projectId = await form.locator('select[name="fk_project"] option', { hasText: 'PRJ-JE-2026' }).getAttribute('value');
  const response = await page.request.post('/custom/mjlfinancement/conventions.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: 'CONV-UNICEF-2026-001',
      title: 'P3V2_E2E duplicate recovery',
      fk_soc: partnerId,
      fk_project: projectId,
      date_start: '2026-01-01',
      date_end: '2026-12-31',
      total_amount: '1000',
      currency_code: 'XOF',
      note_public: 'P3V2_E2E public',
      note_private: '',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toMatch(/mjl_recovery=[a-f0-9]{32}/);
  expect(location).not.toContain('token=');

  await page.goto(location);
  await expect(page.locator('body')).toContainText('L’action n’a pas pu être réalisée. Veuillez réessayer.');
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('L’action n’a pas pu être réalisée. Veuillez réessayer.');
  await expect(form.locator('[data-mjl-form-errors] a')).toHaveCount(0);
  await expect(form.locator('input[name="ref"]')).toHaveValue('CONV-UNICEF-2026-001');
  await expect(form.locator('input[name="title"]')).toHaveValue('P3V2_E2E duplicate recovery');
  await page.reload();
  await expect(form.locator('input[name="ref"]')).toHaveValue('');
});

test('Phase 3 remediation links only exact finance field errors and keeps composite failures form-level', async ({ page }) => {
  await login(page, 'admin.poc');

  await page.goto('/custom/mjlfinancement/conventions.php');
  let form = page.locator('form.mjl-activity-form').first();
  let response = await page.request.post('/custom/mjlfinancement/conventions.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: 'P3V2-E2E-CONV-INVALID',
      title: '',
      fk_soc: await form.locator('select[name="fk_soc"] option', { hasText: 'UNICEF' }).getAttribute('value'),
      fk_project: await form.locator('select[name="fk_project"] option', { hasText: 'PRJ-JE-2026' }).getAttribute('value'),
      total_amount: '1200',
      currency_code: 'XOF',
      note_public: 'P3V2_E2E valeur valide conservée',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  await page.goto(response.headers().location);
  form = page.locator('form.mjl-activity-form').first();
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('La référence et l’intitulé sont obligatoires.');
  await expect(form.locator('[data-mjl-form-errors] a')).toHaveCount(0);
  await expect(form.locator('input[name="ref"]')).toHaveValue('P3V2-E2E-CONV-INVALID');
  await expect(form.locator('textarea[name="note_public"]')).toHaveValue('P3V2_E2E valeur valide conservée');

  await page.goto('/custom/mjlfinancement/budgetlines.php');
  form = page.locator('form.mjl-activity-form').first();
  response = await page.request.post('/custom/mjlfinancement/budgetlines.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: 'P3V2-E2E-BL-INVALID',
      label: '',
      fk_project: await form.locator('select[name="fk_project"] option', { hasText: 'PRJ-JE-2026' }).getAttribute('value'),
      fk_convention: await form.locator('select[name="fk_convention"] option', { hasText: 'CONV-UNICEF-2026-001' }).getAttribute('value'),
      initial_budget: '900',
      revised_budget: '900',
      category: 'P3V2_E2E',
      note_public: 'P3V2_E2E budget valide conservé',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  await page.goto(response.headers().location);
  form = page.locator('form.mjl-activity-form').first();
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('La référence et le libellé sont obligatoires.');
  await expect(form.locator('[data-mjl-form-errors] a')).toHaveCount(0);
  await expect(form.locator('input[name="ref"]')).toHaveValue('P3V2-E2E-BL-INVALID');

  await page.goto('/custom/mjlfinancement/fundreceipts.php');
  form = page.locator('form.mjl-activity-form').first();
  response = await page.request.post('/custom/mjlfinancement/fundreceipts.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: '',
      fk_convention: await form.locator('select[name="fk_convention"] option', { hasText: 'CONV-UNICEF-2026-001' }).getAttribute('value'),
      amount: '700',
      reception_date: '2026-07-30',
      comment: 'P3V2_E2E commentaire valide',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  await page.goto(response.headers().location);
  form = page.locator('form.mjl-activity-form').first();
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('La référence est obligatoire.');
  await expect(form.locator('a[href="#mjl-fundreceipt-create-ref"]')).toBeVisible();
  await expect(form.locator('textarea[name="comment"]')).toHaveValue('P3V2_E2E commentaire valide');
});

test('Phase 3 remediation renders every finance decision precondition in its recoverable production form', async ({ page }) => {
  setupFinanceFeedbackFixtures();
  try {
    await login(page, 'admin.poc');

    const conventionId = fixtureId('llx_mjlfinancement_convention', 'P3V2-FEEDBACK-CONV');
    await page.goto(`/custom/mjlfinancement/conventions.php?id=${conventionId}`);
    let form = page.locator('form.mjl-activity-form').filter({ has: page.locator('input[name="action"][value="update"]') });
    let values = await formValues(form);
    let response = await page.request.post(`/custom/mjlfinancement/conventions.php?id=${conventionId}`, {
      form: { ...values, currency_code: 'XX', comment: 'Devise invalide contrôlée' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    await page.goto(response.headers().location);
    form = page.locator('form.mjl-activity-form').filter({ has: page.locator('input[name="action"][value="update"]') });
    await expect(form.locator('[data-mjl-form-errors]')).toContainText('La devise doit comporter exactement trois lettres.');
    await expect(form.locator('a[href="#mjl-convention-edit-currency_code"]')).toBeVisible();
    await expect(form.locator('input[name="title"]')).toHaveValue('Feedback convention');

    values = await formValues(form);
    response = await page.request.post(`/custom/mjlfinancement/conventions.php?id=${conventionId}`, {
      form: { ...values, currency_code: 'XOF', title: 'Feedback convention modifiée', comment: '' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    await page.goto(response.headers().location);
    form = page.locator('form.mjl-activity-form').filter({ has: page.locator('input[name="action"][value="update"]') });
    await expect(form.locator('[data-mjl-form-errors]')).toContainText('Le motif de modification est obligatoire.');
    await expect(form.locator('a[href="#mjl-convention-edit-comment"]')).toBeVisible();
    await expect(form.locator('input[name="title"]')).toHaveValue('Feedback convention modifiée');

    const budgetId = fixtureId('llx_mjlfinancement_budget_line', 'P3V2-FEEDBACK-BL');
    await page.goto(`/custom/mjlfinancement/budgetlines.php?id=${budgetId}`);
    form = page.locator('form.mjl-activity-form').filter({ has: page.locator('input[name="action"][value="update"]') });
    values = await formValues(form);
    response = await page.request.post(`/custom/mjlfinancement/budgetlines.php?id=${budgetId}`, {
      form: { ...values, label: 'Feedback budget modifié', comment: '' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    await page.goto(response.headers().location);
    form = page.locator('form.mjl-activity-form').filter({ has: page.locator('input[name="action"][value="update"]') });
    await expect(form.locator('[data-mjl-form-errors]')).toContainText('Le motif de modification est obligatoire.');
    await expect(form.locator('a[href="#mjl-budgetline-edit-comment"]')).toBeVisible();
    await expect(form.locator('input[name="label"]')).toHaveValue('Feedback budget modifié');

    const receivedCases = [
      ['P3V2-FEEDBACK-FR-AMOUNT', 'Le montant doit être supérieur à zéro.'],
      ['P3V2-FEEDBACK-FR-DATE', 'La date de réception est obligatoire.'],
      ['P3V2-FEEDBACK-FR-PROOF', 'Une preuve documentaire téléchargeable est obligatoire.'],
    ];
    for (const [ref, message] of receivedCases) {
      const receiptId = fixtureId('llx_mjlfinancement_fund_receipt', ref);
      await page.goto(`/custom/mjlfinancement/fundreceipts.php?id=${receiptId}`);
      form = page.locator('form.mjl-activity-action-form').filter({ has: page.locator('input[name="action"][value="received"]') });
      values = await formValues(form);
      response = await page.request.post(`/custom/mjlfinancement/fundreceipts.php?id=${receiptId}`, {
        form: values,
        maxRedirects: 0,
      });
      expect(response.status()).toBe(302);
      await page.goto(response.headers().location);
      form = page.locator('form.mjl-activity-action-form').filter({ has: page.locator('input[name="action"][value="received"]') });
      await expect(form.locator('.mjl-form-error-summary')).toContainText(message);
      await expect(form.locator('.mjl-form-error-summary a')).toHaveCount(0);
      await expect(form.locator('input[name="status_comment"]')).toHaveValue('');
    }

    const reasonId = fixtureId('llx_mjlfinancement_fund_receipt', 'P3V2-FEEDBACK-FR-REASON');
    await page.goto(`/custom/mjlfinancement/fundreceipts.php?id=${reasonId}`);
    form = page.locator('form.mjl-activity-action-form').filter({ has: page.locator('input[name="action"][value="not_received"]') });
    values = await formValues(form);
    response = await page.request.post(`/custom/mjlfinancement/fundreceipts.php?id=${reasonId}`, {
      form: { ...values, status_comment: '' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    await page.goto(response.headers().location);
    form = page.locator('form.mjl-activity-action-form').filter({ has: page.locator('input[name="action"][value="not_received"]') });
    await expect(form.locator('.mjl-form-error-summary')).toContainText('Le motif est obligatoire.');
    await expect(form.locator('a[href="#mjl-fundreceipt-decision-not_received-status_comment"]')).toBeVisible();
  } finally {
    cleanupPhase3V2Fixtures();
  }
});

test('Phase 3C finance lists retain partner filters, deterministic sorts, and resource pagination', async ({ page }) => {
  await login(page, 'admin.poc');

  await page.goto('/custom/mjlfinancement/conventions.php');
  const conventionPartner = await page.locator('select[name="partner_id"] option:not([value=""])').first().getAttribute('value');
  await page.goto(`/custom/mjlfinancement/conventions.php?partner_id=${conventionPartner}&status=1&sort=ref`);
  await expect(page.locator('select[name="partner_id"]')).toHaveValue(conventionPartner);
  await expect(page.locator('select[name="sort"]')).toHaveValue('ref');
  await expect(page.locator('nav[aria-label="Pagination des enveloppes"]')).toBeVisible();

  await page.goto('/custom/mjlfinancement/budgetlines.php');
  const budgetPartner = await page.locator('select[name="partner_id"] option:not([value=""])').first().getAttribute('value');
  await page.goto(`/custom/mjlfinancement/budgetlines.php?partner_id=${budgetPartner}&status=1&sort=remaining`);
  await expect(page.locator('select[name="partner_id"]')).toHaveValue(budgetPartner);
  await expect(page.locator('select[name="sort"]')).toHaveValue('remaining');
  await expect(page.locator('nav[aria-label="Pagination des lignes budgétaires"]')).toBeVisible();

  await page.goto('/custom/mjlfinancement/fundreceipts.php');
  const receiptPartner = await page.locator('select[name="partner_id"] option:not([value=""])').first().getAttribute('value');
  await page.goto(`/custom/mjlfinancement/fundreceipts.php?partner_id=${receiptPartner}&sort=amount`);
  await expect(page.locator('select[name="partner_id"]')).toHaveValue(receiptPartner);
  await expect(page.locator('select[name="sort"]')).toHaveValue('amount');
  await expect(page.locator('nav[aria-label="Pagination des réceptions de fonds"]')).toBeVisible();
});

test('Phase 3 real 51+ lists expose first, middle, and last 50-row pages with retained scope', async ({ page }) => {
  setupPhase3PaginationFixtures();
  try {
    await login(page, 'admin.poc');
    await page.goto('/custom/mjlfinancement/projects.php');
    const partnerId = await page.locator('select[name="partner"] option', { hasText: 'UNICEF' }).getAttribute('value');

    await assertThreeRoutePages(page, '/custom/mjlfinancement/partners.php?sort=name', 'partenaires');
    await assertThreeRoutePages(page, `/custom/mjlfinancement/projects.php?partner=${partnerId}&sort=ref`, 'projets');

    await page.goto(`/custom/mjlfinancement/activities.php?partner=${partnerId}`);
    const activityProjectId = await page.locator('select[name="project"] option', { hasText: 'PRJ-JE-2026' }).getAttribute('value');
    await assertThreeRoutePages(page, `/custom/mjlfinancement/activities.php?partner=${partnerId}&project=${activityProjectId}&sort=recent`, 'activités');
    await assertThreeRoutePages(page, `/custom/mjlfinancement/expenses.php?partner=${partnerId}&project=${activityProjectId}&sort=recent`, 'dépenses');
    await assertThreeRoutePages(page, `/custom/mjlfinancement/conventions.php?partner_id=${partnerId}&project_id=${activityProjectId}&sort=ref`, 'enveloppes');
    await assertThreeRoutePages(page, `/custom/mjlfinancement/budgetlines.php?partner_id=${partnerId}&project_id=${activityProjectId}&sort=ref`, 'lignes budgétaires');
    await assertThreeRoutePages(page, `/custom/mjlfinancement/fundreceipts.php?partner_id=${partnerId}&project_id=${activityProjectId}&sort=ref`, 'réceptions de fonds');
  } finally {
    cleanupPhase3V2Fixtures();
  }
});

test('Phase 3C dashboards and reports expose richer local context without changing export actions', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  const firstCard = page.locator('.mjl-dashboard-card').first();
  await expect(firstCard.locator('dt')).toContainText(['Définition', 'Périmètre', 'Période', 'Actualisation', 'Destination']);

  await page.goto('/custom/mjlfinancement/reports.php?report=financial_execution_project');
  await expect(page.getByText(/Prévisualisation prête — \d+ ligne/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historique des générations' })).toBeVisible();
  await expect(page.locator('button[name="action"][value="export_csv"]')).toBeVisible();
  await expect(page.locator('button[name="action"][value="export_xlsx"]')).toBeVisible();
  await expect(page.locator('a[href*="/ecm/"], a[href*="/document.php"]')).toHaveCount(0);
});

test('Phase 3 combined partner-to-report journey keeps scope and guarded destinations visible', async ({ page }) => {
  await login(page, 'admin.poc');

  await page.goto('/custom/mjlfinancement/partners.php');
  const partnerRow = page.locator('tr', { hasText: 'UNICEF' }).first();
  const partnerHref = await partnerRow.locator('a[href*="partners.php?id="]').first().getAttribute('href');
  const partnerId = new URL(partnerHref, 'http://localhost').searchParams.get('id');
  await page.goto(partnerHref);
  await expect(page.getByRole('heading', { name: /Partenaire \/ Programme UNICEF/ })).toBeVisible();

  await page.goto(`/custom/mjlfinancement/projects.php?partner=${partnerId}`);
  const projectRow = page.locator('tr', { hasText: 'PRJ-JE-2026' }).first();
  const projectHref = await projectRow.locator('a[href*="projects.php?id="]').first().getAttribute('href');
  const projectId = new URL(projectHref, 'http://localhost').searchParams.get('id');
  await page.goto(projectHref);
  await expect(page.getByRole('heading', { name: 'Projet PRJ-JE-2026' })).toBeVisible();
  await expect(page.locator(`a[href*="activities.php"][href*="project=${projectId}"]`).first()).toBeVisible();

  await page.goto(`/custom/mjlfinancement/activities.php?partner=${partnerId}&project=${projectId}`);
  const activityHref = await page.locator('a[href*="activities.php?id="]').first().getAttribute('href');
  await page.goto(activityHref);
  await expect(page.locator('.mjl-journey-summary')).toContainText('PRJ-JE-2026');

  await page.goto(`/custom/mjlfinancement/expenses.php?partner=${partnerId}&project=${projectId}`);
  const expenseHref = await page.locator('a[href*="expenses.php?id="]').first().getAttribute('href');
  await page.goto(expenseHref);
  await expect(page.locator('.mjl-journey-summary')).toContainText('PRJ-JE-2026');
  await expect(page.locator('.mjl-journey-documents')).toBeVisible();
  await expect(page.locator('a[href*="/ecm/"], a[href*="/document.php"]')).toHaveCount(0);

  await page.goto(`/custom/mjlfinancement/conventions.php?partner_id=${partnerId}&project_id=${projectId}`);
  const conventionHref = await page.locator('a[href*="conventions.php?id="]').first().getAttribute('href');
  await page.goto(conventionHref);
  await expect(page.locator('.mjl-journey-summary')).toContainText('PRJ-JE-2026');
  await expect(page.locator('.mjl-journey-documents')).toBeVisible();
  await expect(page.locator('a[href*="/ecm/"], a[href*="/document.php"]')).toHaveCount(0);

  await page.goto(`/custom/mjlfinancement/budgetlines.php?partner_id=${partnerId}&project_id=${projectId}`);
  await expect(page.locator('select[name="partner_id"]')).toHaveValue(partnerId);
  await expect(page.locator('select[name="project_id"]')).toHaveValue(projectId);
  await expect(page.locator('a[href*="budgetlines.php?id="]').first()).toBeVisible();

  await page.goto(`/custom/mjlfinancement/fundreceipts.php?partner_id=${partnerId}&project_id=${projectId}`);
  await expect(page.locator('select[name="partner_id"]')).toHaveValue(partnerId);
  await expect(page.locator('select[name="project_id"]')).toHaveValue(projectId);
  await expect(page.locator('a[href*="fundreceipts.php?id="]').first()).toBeVisible();

  await page.goto(`/custom/mjlfinancement/documents.php?partner_id=${partnerId}&project_id=${projectId}`);
  await expect(page.locator('select[name="partner_id"]')).toHaveValue(partnerId);
  await expect(page.locator('select[name="project_id"]')).toHaveValue(projectId);

  await page.goto('/custom/mjlfinancement/reports.php?report=financial_execution_project');
  await expect(page.getByText(/Prévisualisation prête — \d+ ligne/)).toBeVisible();
  await expect(page.getByText(/Les fichiers sont générés à la demande/)).toBeVisible();
  await expect(page.locator('a[href*="/ecm/"], a[href*="/document.php"]')).toHaveCount(0);
});
