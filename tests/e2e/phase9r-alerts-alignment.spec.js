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

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

function cleanupPhase9RFixtures() {
  sql(`
    SET @ids = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P9R-%');
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@ids, ''));
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P9R-%');
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P9R-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P9R-%';
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P9R-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P9R-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'P9R-%';
  `);
}

function seedPhase9RFixtures() {
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
    VALUES (1, @agent, 'AGENT_SAISIE', 1, CURDATE(), 'phase9r', 'Phase 9R alerts', NOW(), @agent),
           (1, @verifier, 'AGENT_VERIFICATEUR', 1, CURDATE(), 'phase9r', 'Phase 9R alerts', NOW(), @agent),
           (1, @final, 'VALIDATEUR_DEFINITIF', 1, CURDATE(), 'phase9r', 'Phase 9R alerts', NOW(), @agent);
    UPDATE llx_mjlfinancement_user_soc_scope SET is_active = 0 WHERE entity = 1 AND fk_user IN (@agent, @verifier, @final);
    INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @agent, @unicef, 1, CURDATE(), 'phase9r', 'Phase 9R alerts', NOW(), @agent),
           (1, @verifier, @unicef, 1, CURDATE(), 'phase9r', 'Phase 9R alerts', NOW(), @agent),
           (1, @final, @unicef, 1, CURDATE(), 'phase9r', 'Phase 9R alerts', NOW(), @agent);

    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, status, date_creation, fk_user_creat, import_key)
    VALUES
      (1, 'P9R-CONV-SOON', 'Phase 9R enveloppe proche', @unicef, @project, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 5000000, 'XOF', 1, NOW(), @final, 'P9RCONVSOON'),
      (1, 'P9R-CONV-RED', 'Phase 9R enveloppe autre partenaire', @redev, @red_project, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 5000000, 'XOF', 1, NOW(), @final, 'P9RCONVRED');
    SET @soon_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P9R-CONV-SOON' AND entity = 1);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, fk_user_responsible, import_key, status)
    VALUES
      (1, 'P9R-ACT-OVERDUE', 'Activite Phase 9R en retard', @project, @convention, DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), NOW(), @agent, @agent, 'P9RACTOVER', 1),
      (1, 'P9R-ACT-SOON', 'Activite Phase 9R echeance proche', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 4 DAY), NOW(), @agent, @agent, 'P9RACTSOON', 1),
      (1, 'P9R-ACT-SUB', 'Activite Phase 9R a prevalider', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), NOW(), @agent, NULL, 'P9RACTSUB', 3),
      (1, 'P9R-ACT-PRE', 'Activite Phase 9R a valider definitivement', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), NOW(), @agent, NULL, 'P9RACTPRE', 7),
      (1, 'P9R-ACT-CORR', 'Activite Phase 9R retour correction', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 DAY), NOW(), @agent, @agent, 'P9RACTCORR', 4),
      (1, 'P9R-ACT-STALE', 'Activite Phase 9R execution a actualiser', @project, @convention, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), @agent, @agent, 'P9RACTSTALE', 1),
      (1, 'P9R-ACT-RED', 'Activite Phase 9R autre partenaire', @red_project, (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P9R-CONV-RED' AND entity = 1), CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), NOW(), @agent, @agent, 'P9RACTRED', 1);
    INSERT INTO llx_mjlfinancement_workflow_action (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat, import_key)
    SELECT 1, 'P9R-WFA-STALE', 'mjlfinancement_activity', rowid, 'execution_updated', 'En cours', 'En cours', @agent, 'AGENT_SAISIE', DATE_SUB(NOW(), INTERVAL 20 DAY), 'Ancienne execution Phase 9R', '{}', NOW(), @agent, 'P9RWFASTALE'
    FROM llx_mjlfinancement_activity WHERE ref = 'P9R-ACT-STALE' AND entity = 1;

    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, initial_budget, revised_budget, category, status, date_creation, fk_user_creat, import_key)
    VALUES
      (1, 'P9R-BL-WARN', 'Budget Phase 9R surveillance', @project, @convention, 1000, 1000, 'phase9r', 1, NOW(), @final, 'P9RBLWARN'),
      (1, 'P9R-BL-CRIT', 'Budget Phase 9R critique', @project, @convention, 1000, 1000, 'phase9r', 1, NOW(), @final, 'P9RBLCRIT'),
      (1, 'P9R-BL-OVER', 'Budget Phase 9R depassement', @project, @convention, 1000, 1000, 'phase9r', 1, NOW(), @final, 'P9RBLOVER');
    SET @bl_warn = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P9R-BL-WARN' AND entity = 1);
    SET @bl_crit = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P9R-BL-CRIT' AND entity = 1);
    SET @bl_over = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P9R-BL-OVER' AND entity = 1);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_budget_line, amount, prevalidated_amount, final_validated_amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P9R-EXP-SUB', @project, @convention, @bl_over, 100, NULL, NULL, CURDATE(), 'Depense Phase 9R a prevalider', NULL, NOW(), NOW(), @agent, 'P9REXPSUB', 1),
      (1, 'P9R-EXP-PRE', @project, @convention, @bl_over, 100, 100, NULL, CURDATE(), 'Depense Phase 9R a valider definitivement', NULL, NOW(), NOW(), @agent, 'P9REXPPRE', 4),
      (1, 'P9R-EXP-MISSING', @project, @convention, @bl_over, 50, NULL, NULL, CURDATE(), 'Depense Phase 9R piece manquante', NULL, NULL, NOW(), @agent, 'P9REXPMISS', 0),
      (1, 'P9R-EXP-UNAVAILABLE', @project, @convention, @bl_over, 50, NULL, NULL, CURDATE(), 'Depense Phase 9R piece indisponible', 'P9R-missing.pdf', NULL, NOW(), @agent, 'P9REXPUNAV', 3),
      (1, 'P9R-EXP-REJECTED', @project, @convention, @bl_over, 75, NULL, NULL, CURDATE(), 'Depense Phase 9R retour correction', NULL, NULL, NOW(), @agent, 'P9REXPREJ', 8),
      (1, 'P9R-EXP-OVER', @project, @convention, @bl_over, 1200, NULL, NULL, CURDATE(), 'Depense Phase 9R depasse budget', NULL, NULL, NOW(), @agent, 'P9REXPOVER', 1),
      (1, 'P9R-EXP-NOT-DISB', @project, @convention, @bl_crit, 100, NULL, 100, CURDATE(), 'Depense Phase 9R validee non decaissee', 'P9R-ok.pdf', NOW(), NOW(), @agent, 'P9REXPND', 6),
      (1, 'P9R-EXP-WARN-CONS', @project, @convention, @bl_warn, 850, NULL, 850, CURDATE(), 'Depense Phase 9R consommation 85', 'P9R-ok.pdf', NOW(), NOW(), @agent, 'P9REXPWARN', 6),
      (1, 'P9R-EXP-CRIT-CONS', @project, @convention, @bl_crit, 860, NULL, 860, CURDATE(), 'Depense Phase 9R consommation 96', 'P9R-ok.pdf', NOW(), NOW(), @agent, 'P9REXPCRIT', 6);
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase9RFixtures();
  seedPhase9RFixtures();
});

test.afterAll(() => {
  cleanupPhase9RFixtures();
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
});

test('agent sees operational activity and expense alerts only in assigned partner scope', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php');

  await expect(page.locator('body')).toContainText('P9R-ACT-OVERDUE');
  await expect(page.locator('body')).toContainText('P9R-ACT-SOON');
  await expect(page.locator('body')).toContainText('P9R-ACT-CORR');
  await expect(page.locator('body')).toContainText('P9R-ACT-STALE');
  await expect(page.locator('body')).toContainText('P9R-EXP-MISSING');
  await expect(page.locator('body')).toContainText('P9R-EXP-UNAVAILABLE');
  await expect(page.locator('body')).toContainText('P9R-EXP-REJECTED');
  await expect(page.locator('body')).toContainText('P9R-EXP-OVER');
  await expect(page.locator('body')).not.toContainText('P9R-ACT-RED');
  await expect(page.locator('body')).not.toContainText('P9R-EXP-NOT-DISB');
});

test('validation queues are role-specific', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.locator('body')).toContainText('P9R-ACT-SUB');
  await expect(page.locator('body')).toContainText('P9R-EXP-SUB');
  await expect(page.locator('body')).not.toContainText('P9R-ACT-PRE');
  await expect(page.locator('body')).not.toContainText('P9R-EXP-PRE');

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.locator('body')).toContainText('P9R-ACT-PRE');
  await expect(page.locator('body')).toContainText('P9R-EXP-PRE');
  await expect(page.locator('body')).toContainText('P9R-EXP-NOT-DISB');
  await expect(page.locator('body')).not.toContainText('P9R-ACT-RED');
});

test('scope filter separates activities, expenses, and finance alerts', async ({ page }) => {
  await login(page, 'admin.poc');

  await page.goto('/custom/mjlfinancement/alerts.php?scope=activities');
  await expect(page.locator('body')).toContainText('P9R-ACT-OVERDUE');
  await expect(page.locator('body')).not.toContainText('P9R-EXP-MISSING');
  await expect(page.locator('body')).not.toContainText('P9R-BL-WARN');

  await page.goto('/custom/mjlfinancement/alerts.php?scope=expenses');
  await expect(page.locator('body')).toContainText('P9R-EXP-MISSING');
  await expect(page.locator('body')).toContainText('P9R-EXP-NOT-DISB');
  await expect(page.locator('body')).not.toContainText('P9R-ACT-OVERDUE');
  await expect(page.locator('body')).not.toContainText('P9R-BL-WARN');

  await page.goto('/custom/mjlfinancement/alerts.php?scope=finance');
  await expect(page.locator('body')).toContainText('P9R-BL-WARN');
  await expect(page.locator('body')).toContainText('P9R-BL-CRIT');
  await expect(page.locator('body')).toContainText('P9R-CONV-SOON');
  await expect(page.locator('body')).not.toContainText('P9R-ACT-OVERDUE');

  await page.goto('/custom/mjlfinancement/alerts.php?scope=bogus');
  await expect(page.locator('body')).toContainText('P9R-ACT-OVERDUE');
  await expect(page.locator('body')).toContainText('P9R-EXP-MISSING');
});

test('finance alerts are suppressed when the user cannot open finance routes', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php?scope=finance');
  await expect(page.getByText('Aucune alerte active dans votre perimetre.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('P9R-BL-WARN');
  await expect(page.locator('body')).not.toContainText('P9R-CONV-SOON');
});
