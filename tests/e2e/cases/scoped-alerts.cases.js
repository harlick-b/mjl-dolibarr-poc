const { test, expect } = require('@playwright/test');
const { execFileSync, execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

function dockerExec(command) {
  return execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sql(query) {
  dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`);
}

function scalar(query) {
  return dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -N -B -e "${query.replace(/"/g, '\\"')}"`).toString().trim();
}

function feedbackRenderProbe() {
  const feedbackPath = `${process.cwd()}/custom/mjlfinancement/lib/mjl_feedback.lib.php`.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const php = `$_SESSION = array(); function setEventMessages($message, $unused = null, $style = 'mesgs') { if (!isset($_SESSION['dol_events'])) $_SESSION['dol_events'] = array(); $_SESSION['dol_events'][] = array('type' => $style, 'mesg' => $message); } require '${feedbackPath}'; mjl_feedback_reset_request_state(); mjl_feedback_add('browser:one', 'activity.created'); mjl_feedback_add('browser:one', 'activity.created'); mjl_feedback_add('browser:two', 'activity.created'); echo json_encode(array(mjl_feedback_render_and_clear(), mjl_feedback_render_and_clear()));`;
  return JSON.parse(execFileSync('php', ['-r', php], { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

function cleanupScopedAlertsFixtures() {
  sql(`
    SET @ids = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'ALT-%');
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@ids, ''));
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'ALT-%');
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'ALT-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'ALT-%';
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'ALT-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'ALT-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'ALT-%';
  `);
}

function seedScopedAlertsFixtures() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @verifier = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' LIMIT 1);
    SET @final = (SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' LIMIT 1);
    SET @unicef = (SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1);
    SET @redev = (SELECT rowid FROM llx_societe WHERE nom LIKE 'Programme Redev%' AND entity = 1 LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @red_project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-RED-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);

    UPDATE llx_mjlfinancement_user_role SET is_active = 0 WHERE entity = 1 AND fk_user IN (@agent, @verifier, @final);
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @agent, 'AGENT_SAISIE', 1, CURDATE(), 'scoped_alerts', 'Scoped alerts alerts', NOW(), @agent),
           (1, @verifier, 'AGENT_VERIFICATEUR', 1, CURDATE(), 'scoped_alerts', 'Scoped alerts alerts', NOW(), @agent),
           (1, @final, 'VALIDATEUR_DEFINITIF', 1, CURDATE(), 'scoped_alerts', 'Scoped alerts alerts', NOW(), @agent);
    UPDATE llx_mjlfinancement_user_soc_scope SET is_active = 0 WHERE entity = 1 AND fk_user IN (@agent, @verifier, @final);
    INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @agent, @unicef, 1, CURDATE(), 'scoped_alerts', 'Scoped alerts alerts', NOW(), @agent),
           (1, @verifier, @unicef, 1, CURDATE(), 'scoped_alerts', 'Scoped alerts alerts', NOW(), @agent),
           (1, @final, @unicef, 1, CURDATE(), 'scoped_alerts', 'Scoped alerts alerts', NOW(), @agent);

    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, status, date_creation, fk_user_creat, import_key)
    VALUES
      (1, 'ALT-CONV-SOON', 'Scoped alerts enveloppe proche', @unicef, @project, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 5000000, 'XOF', 1, NOW(), @final, 'ALTCONVSOON'),
      (1, 'ALT-CONV-RED', 'Scoped alerts enveloppe autre partenaire', @redev, @red_project, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 5000000, 'XOF', 1, NOW(), @final, 'ALTCONVRED');
    SET @soon_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'ALT-CONV-SOON' AND entity = 1);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, fk_user_responsible, import_key, status)
    VALUES
      (1, 'ALT-ACT-OVERDUE', 'Activite Scoped alerts en retard', @project, @convention, DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), NOW(), @agent, @agent, 'ALTACTOVER', 1),
      (1, 'ALT-ACT-SOON', 'Activite Scoped alerts echeance proche', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 4 DAY), NOW(), @agent, @agent, 'ALTACTSOON', 1),
      (1, 'ALT-ACT-SUB', 'Activite Scoped alerts a prevalider', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), NOW(), @agent, NULL, 'ALTACTSUB', 3),
      (1, 'ALT-ACT-PRE', 'Activite Scoped alerts a valider definitivement', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), NOW(), @agent, NULL, 'ALTACTPRE', 7),
      (1, 'ALT-ACT-CORR', 'Activite Scoped alerts retour correction', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 DAY), NOW(), @agent, @agent, 'ALTACTCORR', 4),
      (1, 'ALT-ACT-STALE', 'Activite Scoped alerts execution a actualiser', @project, @convention, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), @agent, @agent, 'ALTACTSTALE', 1),
      (1, 'ALT-ACT-RED', 'Activite Scoped alerts autre partenaire', @red_project, (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'ALT-CONV-RED' AND entity = 1), CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), NOW(), @agent, @agent, 'ALTACTRED', 1);
    INSERT INTO llx_mjlfinancement_workflow_action (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat, import_key)
    SELECT 1, 'ALT-WFA-STALE', 'mjlfinancement_activity', rowid, 'execution_updated', 'En cours', 'En cours', @agent, 'AGENT_SAISIE', DATE_SUB(NOW(), INTERVAL 20 DAY), 'Ancienne execution Scoped alerts', '{}', NOW(), @agent, 'ALTWFASTALE'
    FROM llx_mjlfinancement_activity WHERE ref = 'ALT-ACT-STALE' AND entity = 1;

    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, initial_budget, revised_budget, category, status, date_creation, fk_user_creat, import_key)
    VALUES
      (1, 'ALT-BL-WARN', 'Budget Scoped alerts surveillance', @project, @convention, 1000, 1000, 'scoped_alerts', 1, NOW(), @final, 'ALTBLWARN'),
      (1, 'ALT-BL-CRIT', 'Budget Scoped alerts critique', @project, @convention, 1000, 1000, 'scoped_alerts', 1, NOW(), @final, 'ALTBLCRIT'),
      (1, 'ALT-BL-OVER', 'Budget Scoped alerts depassement', @project, @convention, 1000, 1000, 'scoped_alerts', 1, NOW(), @final, 'ALTBLOVER'),
      (1, 'ALT-BL-ALLOC', 'Budget Scoped alerts surallocation partenaire', @project, @convention, 999999999, 999999999, 'scoped_alerts', 1, NOW(), @final, 'ALTBLALLOC');
    SET @bl_warn = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'ALT-BL-WARN' AND entity = 1);
    SET @bl_crit = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'ALT-BL-CRIT' AND entity = 1);
    SET @bl_over = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'ALT-BL-OVER' AND entity = 1);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_budget_line, amount, prevalidated_amount, final_validated_amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'ALT-EXP-SUB', @project, @convention, @bl_over, 100, NULL, NULL, CURDATE(), 'Depense Scoped alerts a prevalider', NULL, NOW(), NOW(), @agent, 'ALTEXPSUB', 1),
      (1, 'ALT-EXP-PRE', @project, @convention, @bl_over, 100, 100, NULL, CURDATE(), 'Depense Scoped alerts a valider definitivement', NULL, NOW(), NOW(), @agent, 'ALTEXPPRE', 4),
      (1, 'ALT-EXP-MISSING', @project, @convention, @bl_over, 50, NULL, NULL, CURDATE(), 'Depense Scoped alerts piece manquante', NULL, NULL, NOW(), @agent, 'ALTEXPMISS', 0),
      (1, 'ALT-EXP-UNAVAILABLE', @project, @convention, @bl_over, 50, NULL, NULL, CURDATE(), 'Depense Scoped alerts piece indisponible', 'ALT-missing.pdf', NULL, NOW(), @agent, 'ALTEXPUNAV', 3),
      (1, 'ALT-EXP-REJECTED', @project, @convention, @bl_over, 75, NULL, NULL, CURDATE(), 'Depense Scoped alerts retour correction', NULL, NULL, NOW(), @agent, 'ALTEXPREJ', 8),
      (1, 'ALT-EXP-OVER', @project, @convention, @bl_over, 1200, NULL, NULL, CURDATE(), 'Depense Scoped alerts depasse budget', NULL, NULL, NOW(), @agent, 'ALTEXPOVER', 1),
      (1, 'ALT-EXP-NOT-DISB', @project, @convention, @bl_crit, 100, NULL, 100, CURDATE(), 'Depense Scoped alerts validee non decaissee', 'ALT-ok.pdf', NOW(), NOW(), @agent, 'ALTEXPND', 6),
      (1, 'ALT-EXP-WARN-CONS', @project, @convention, @bl_warn, 850, NULL, 850, CURDATE(), 'Depense Scoped alerts consommation 85', 'ALT-ok.pdf', NOW(), NOW(), @agent, 'ALTEXPWARN', 6),
      (1, 'ALT-EXP-CRIT-CONS', @project, @convention, @bl_crit, 860, NULL, 860, CURDATE(), 'Depense Scoped alerts consommation 96', 'ALT-ok.pdf', NOW(), NOW(), @agent, 'ALTEXPCRIT', 6);
  `);
}

test.beforeAll(() => {
  cleanupScopedAlertsFixtures();
  seedScopedAlertsFixtures();
});

test.afterAll(() => {
  cleanupScopedAlertsFixtures();
});

test('agent sees operational activity and expense alerts only in assigned partner scope', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php');

  await expect(page.locator('body')).toContainText('ALT-ACT-OVERDUE');
  await expect(page.locator('body')).toContainText('ALT-ACT-SOON');
  await expect(page.locator('body')).toContainText('ALT-ACT-CORR');
  await expect(page.locator('body')).toContainText('ALT-ACT-STALE');
  await expect(page.locator('body')).toContainText('ALT-EXP-MISSING');
  await expect(page.locator('body')).toContainText('ALT-EXP-UNAVAILABLE');
  await expect(page.locator('body')).toContainText('ALT-EXP-REJECTED');
  await expect(page.locator('body')).toContainText('ALT-EXP-OVER');
  await expect(page.locator('article', { hasText: 'ALT-EXP-OVER' }).filter({ has: page.getByText('Budget dépassé', { exact: true }) })).toContainText('Agent vérificateur et prévalidateur');
  await expect(page.locator('body')).not.toContainText('ALT-ACT-RED');
  await expect(page.locator('body')).not.toContainText('ALT-EXP-NOT-DISB');
});

test('validation queues are role-specific', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.locator('body')).toContainText('ALT-ACT-SUB');
  await expect(page.locator('body')).toContainText('ALT-EXP-SUB');
  await expect(page.locator('article', { hasText: 'ALT-EXP-OVER' }).filter({ has: page.getByText('Budget dépassé', { exact: true }) })).toContainText('Agent vérificateur et prévalidateur');
  await expect(page.locator('body')).not.toContainText('ALT-ACT-PRE');
  await expect(page.locator('body')).not.toContainText('ALT-EXP-PRE');

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.locator('body')).toContainText('ALT-ACT-PRE');
  await expect(page.locator('body')).toContainText('ALT-EXP-PRE');
  await expect(page.locator('body')).toContainText('ALT-EXP-NOT-DISB');
  await expect(page.locator('body')).not.toContainText('ALT-ACT-RED');
});

test('partner detail reuses scoped alert cards and remains overflow-free at 390px', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  const partnerId = scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}`);
  const alertSection = page.getByRole('heading', { name: 'Alertes', exact: true }).locator('xpath=ancestor::section[1]');
  await expect(alertSection.locator('article.mjl-alert-card').first()).toBeVisible();
  await expect(alertSection).toContainText('Budget suralloué');
  await expect(alertSection).not.toContainText('ALT-ACT-RED');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  sql("UPDATE llx_mjlfinancement_budget_line SET revised_budget = -999999999 WHERE ref = 'ALT-BL-ALLOC' AND entity = 1");
  try {
    await page.reload();
    await expect(alertSection).not.toContainText('Budget suralloué');
  } finally {
    sql("UPDATE llx_mjlfinancement_budget_line SET revised_budget = 999999999 WHERE ref = 'ALT-BL-ALLOC' AND entity = 1");
  }
});

test('distinct feedback operations retain identical copy once and do not replay', async ({ page }) => {
  const [firstRender, replayRender] = feedbackRenderProbe();
  await page.setContent(firstRender);
  await expect(page.getByText('Activité créée en brouillon.')).toHaveCount(2);
  await page.setContent(replayRender || '<main></main>');
  await expect(page.getByText('Activité créée en brouillon.')).toHaveCount(0);
});

test('scope filter separates activities, expenses, and finance alerts', async ({ page }) => {
  await login(page, 'admin.poc');

  await page.goto('/custom/mjlfinancement/alerts.php?scope=activities');
  await expect(page.locator('body')).toContainText('ALT-ACT-OVERDUE');
  await expect(page.locator('body')).not.toContainText('ALT-EXP-MISSING');
  await expect(page.locator('body')).not.toContainText('ALT-BL-WARN');

  await page.goto('/custom/mjlfinancement/alerts.php?scope=expenses');
  await expect(page.locator('body')).toContainText('ALT-EXP-MISSING');
  await expect(page.locator('body')).toContainText('ALT-EXP-NOT-DISB');
  await expect(page.locator('body')).not.toContainText('ALT-ACT-OVERDUE');
  await expect(page.locator('body')).not.toContainText('ALT-BL-WARN');

  await page.goto('/custom/mjlfinancement/alerts.php?scope=finance');
  await expect(page.locator('body')).toContainText('ALT-BL-WARN');
  await expect(page.locator('body')).toContainText('ALT-BL-CRIT');
  await expect(page.locator('body')).toContainText('ALT-CONV-SOON');
  await expect(page.locator('body')).not.toContainText('ALT-ACT-OVERDUE');

  await page.goto('/custom/mjlfinancement/alerts.php?scope=bogus');
  await expect(page.locator('body')).toContainText('ALT-ACT-OVERDUE');
  await expect(page.locator('body')).toContainText('ALT-EXP-MISSING');
});

test('finance alerts are suppressed when the user cannot open finance routes', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php?scope=finance');
  await expect(page.getByText('Aucune alerte active dans votre périmètre.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('ALT-BL-WARN');
  await expect(page.locator('body')).not.toContainText('ALT-CONV-SOON');
});
