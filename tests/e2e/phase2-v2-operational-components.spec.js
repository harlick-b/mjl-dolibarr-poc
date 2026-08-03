const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const cleanupActivityRefs = new Set();
const cleanupActivityPrefixes = new Set();
const phase2DecisionIds = {};
const phase2DecisionRefs = ['P2DEC-E2E-FLOW', 'P2DEC-E2E-REJECT', 'P2DEC-E2E-RACE', 'P2DEC-E2E-SELF-REVIEW', 'P2DEC-E2E-SELF-FINAL', 'P2DEC-E2E-SELF-DISB'];

test.describe.configure({ mode: 'serial' });

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

function dockerPhpJson(code) {
  return JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'php', '-r', code], {
    cwd: projectRoot,
    encoding: 'utf8',
  }));
}

function dockerSql(query) {
  execFileSync('docker', ['compose', 'exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e', query], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}

function dockerScalar(query) {
  return execFileSync('docker', ['compose', 'exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-N', '-B', '-e', query], {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim();
}

function dockerCommand(service, commandArgs) {
  return execFileSync('docker', ['compose', 'exec', '-T', service, ...commandArgs], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function rgbChannels(value) {
  const channels = value.match(/[\d.]+/g).map(Number);
  const alpha = channels.length > 3 ? channels[3] : 1;
  return { channels: channels.slice(0, 3), alpha };
}

function renderedContrast(foreground, background) {
  const fg = rgbChannels(foreground);
  const bg = rgbChannels(background);
  const composite = fg.channels.map((channel, index) => (channel * fg.alpha) + (bg.channels[index] * (1 - fg.alpha)));
  const luminance = (channels) => {
    const values = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * values[0]) + (0.7152 * values[1]) + (0.0722 * values[2]);
  };
  const values = [luminance(composite), luminance(bg.channels)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function mutateRecoverySession(handle, mutation) {
  if (!/^[a-f0-9]{32}$/.test(handle)) {
    throw new Error('Invalid recovery-session fixture identifier');
  }
  const allowedMutations = {
    expire: '$_SESSION["mjl_form_recovery"][$handle]["expires_at"] = time() - 1;',
    cross_user: '$_SESSION["mjl_form_recovery"][$handle]["context"]["user_id"] = 999999;',
    cross_entity: '$_SESSION["mjl_form_recovery"][$handle]["context"]["entity"] = 999999;',
  };
  if (!allowedMutations[mutation]) throw new Error('Invalid recovery-session fixture mutation');
  execFileSync('docker', [
    'compose', 'exec', '-T', '-u', 'www-data', 'dolibarr', 'php', '-r',
    `ini_set("session.save_path", "/tmp"); $handle = $argv[1]; $target = ""; $files = glob("/tmp/sess_*"); usort($files, function ($left, $right) { return filemtime($right) - filemtime($left); }); foreach ($files as $file) { if (strpos((string) @file_get_contents($file), $handle) !== false) { $target = basename($file); break; } } if ($target === "") exit(2); session_id(substr($target, 5)); session_start(); if (!isset($_SESSION["mjl_form_recovery"][$handle])) exit(3); ${allowedMutations[mutation]} session_write_close();`,
    handle,
  ], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}

async function recoverySessionHandles(page) {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => /^(DOLSESSID|PHPSESSID)/.test(cookie.name));
  if (!sessionCookie || !/^[a-zA-Z0-9,-]+$/.test(sessionCookie.value)) {
    throw new Error('Unable to resolve the guarded browser session fixture');
  }
  return JSON.parse(execFileSync('docker', [
    'compose', 'exec', '-T', '-u', 'www-data', 'dolibarr', 'php', '-r',
    'ini_set("session.save_path", "/tmp"); session_id($argv[1]); session_start(); $handles = array_keys($_SESSION["mjl_form_recovery"] ?? array()); sort($handles); echo json_encode($handles); session_write_close();',
    sessionCookie.value,
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  }).trim());
}

async function createInvalidRecovery(page, ref, label) {
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  const form = page.locator('form[data-mjl-form="activity-create"]');
  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref,
      label,
      fk_project: await form.locator('select[name="fk_project"] option:not([value=""])').first().getAttribute('value'),
      fk_convention: await form.locator('select[name="fk_convention"] option:not([value=""])').first().getAttribute('value'),
      date_start: '2026-08-02',
      date_end: '2026-08-01',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const location = response.headers().location;
  expect(location).toMatch(/mjl_recovery=[a-f0-9]{32}/);
  return location;
}

async function createActivityFixture(page, ref, label) {
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  const form = page.locator('form[data-mjl-form="activity-create"]');
  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref,
      label,
      fk_project: await form.locator('select[name="fk_project"] option', { hasText: 'PRJ-JE-2026' }).getAttribute('value'),
      fk_convention: await form.locator('select[name="fk_convention"] option', { hasText: 'CONV-UNICEF-2026-001' }).getAttribute('value'),
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const match = (response.headers().location || '').match(/[?&]id=(\d+)/);
  expect(match).not.toBeNull();
  cleanupActivityRefs.add(ref);
  return Number(match[1]);
}

async function postActivityDecision(page, activityId, action, comment, token = '') {
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  const postToken = token || await page.locator('input[name="token"]').first().inputValue();
  return page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: { token: postToken, action, id: String(activityId), comment },
    maxRedirects: 0,
  });
}

function cleanupActivities() {
  for (const ref of cleanupActivityRefs) {
    if (!/^[A-Z0-9-]+$/.test(ref)) continue;
    const query = `
      SET @activity_id = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = '${ref}' LIMIT 1);
      DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = @activity_id;
      DELETE FROM llx_mjlfinancement_activity WHERE rowid = @activity_id;
    `;
    dockerSql(query);
  }
  for (const prefix of cleanupActivityPrefixes) {
    if (!/^[A-Z0-9-]+$/.test(prefix)) continue;
    dockerSql(`
      DELETE FROM llx_mjlfinancement_workflow_action
      WHERE object_type = 'mjlfinancement_activity'
        AND object_id IN (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref LIKE '${prefix}%');
      DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE '${prefix}%';
    `);
  }
  cleanupActivityRefs.clear();
  cleanupActivityPrefixes.clear();
}

function cleanupEmptyScopeUser() {
  dockerSql(`
    SET @phase2_empty_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase2.empty' AND entity = 1 LIMIT 1);
    DELETE FROM llx_usergroup_user WHERE fk_user = @phase2_empty_user;
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE fk_user = @phase2_empty_user;
    DELETE FROM llx_mjlfinancement_user_role WHERE fk_user = @phase2_empty_user;
    DELETE FROM llx_user WHERE rowid = @phase2_empty_user;
  `);
}

function cleanupPhase2DecisionFixtures() {
  dockerSql(`
    SET @final2 = (
      SELECT u.rowid
      FROM llx_user u
      WHERE u.login = 'mjl.phase2.final2' AND u.entity = 1
        AND EXISTS (
          SELECT 1
          FROM llx_mjlfinancement_user_role r
          WHERE r.entity = 1 AND r.fk_user = u.rowid
            AND r.source = 'P2DEC_E2E'
            AND r.note = 'Second validateur Phase 2'
        )
      LIMIT 1
    );
    DELETE FROM llx_mjlfinancement_exchange_log
      WHERE object_type = 'mjlfinancement_expense'
        AND object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P2DEC-E2E-%' AND import_key = 'P2DEC_E2E');
    DELETE FROM llx_mjlfinancement_workflow_action
      WHERE object_type = 'mjlfinancement_expense'
        AND object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P2DEC-E2E-%' AND import_key = 'P2DEC_E2E');
    DELETE FROM llx_ecm_files
      WHERE ref LIKE 'P2DEC-E2E-%-ECM'
        AND src_object_type = 'mjlfinancement_expense'
        AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P2DEC-E2E-%' AND import_key = 'P2DEC_E2E');
    DELETE FROM llx_mjlfinancement_validation
      WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P2DEC-E2E-%' AND import_key = 'P2DEC_E2E');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P2DEC-E2E-%' AND import_key = 'P2DEC_E2E';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P2DEC-E2E-%-BL' AND import_key = 'P2DEC_E2E';
    DELETE FROM llx_usergroup_user WHERE fk_user = @final2;
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE fk_user = @final2;
    DELETE FROM llx_mjlfinancement_user_role WHERE fk_user = @final2;
    DELETE FROM llx_user WHERE rowid = @final2;
  `);
  dockerCommand('dolibarr', ['sh', '-lc', `rm -f ${phase2DecisionRefs.map((ref) => `/var/www/documents/ecm/mjlfinancement_expense/${ref}.pdf`).join(' ')}`]);
}

function seedPhase2DecisionFixtures() {
  const prerequisites = {
    agent: dockerScalar("SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 AND statut = 1 LIMIT 1"),
    verifier: dockerScalar("SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' AND entity = 1 AND statut = 1 LIMIT 1"),
    final: dockerScalar("SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' AND entity = 1 AND statut = 1 LIMIT 1"),
    project: dockerScalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1"),
    convention: dockerScalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 AND status = 1 LIMIT 1"),
    activity: dockerScalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1"),
  };
  for (const [name, value] of Object.entries(prerequisites)) {
    if (!value) throw new Error(`Missing Phase 2 decision prerequisite: ${name}`);
  }
  const linkedFixtureCount = Number(dockerScalar(`
    SELECT COUNT(*)
    FROM llx_mjlfinancement_activity a
    INNER JOIN llx_mjlfinancement_convention c
      ON c.rowid = a.fk_convention AND c.entity = a.entity
    INNER JOIN llx_projet p
      ON p.rowid = a.fk_project AND p.entity = a.entity
    WHERE a.rowid = ${prerequisites.activity}
      AND c.rowid = ${prerequisites.convention}
      AND p.rowid = ${prerequisites.project}
      AND c.fk_project = p.rowid
      AND c.status = 1
      AND a.entity = 1
  `));
  if (linkedFixtureCount !== 1) {
    throw new Error('Inconsistent Phase 2 project/convention/activity prerequisites');
  }
  const capabilities = dockerPhpJson(`
    define('NOLOGIN', 1);
    require '/var/www/html/main.inc.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
    $checks = array();
    foreach (array('agent.mjl', 'superviseur.n1', 'dpaf.mjl') as $login) {
      $candidate = new User($db);
      if ($candidate->fetch(0, $login) <= 0) {
        $checks[$login] = array('loaded' => false);
        continue;
      }
      $candidate->getrights();
      $checks[$login] = array(
        'loaded' => true,
        'role' => mjl_scope_active_role_code($candidate->id, 1),
        'expense_write' => mjl_workspace_can_apply_expense_write($candidate),
        'expense_validate' => mjl_workspace_can_apply_expense_validation($candidate),
        'project_scope' => mjl_scope_can_access_object($candidate, 'mjlfinancement_project', ${prerequisites.project}, 1),
        'convention_scope' => mjl_scope_can_access_object($candidate, 'mjlfinancement_convention', ${prerequisites.convention}, 1),
        'activity_scope' => mjl_scope_can_access_object($candidate, 'mjlfinancement_activity', ${prerequisites.activity}, 1),
      );
    }
    echo json_encode($checks);
  `);
  const expectedCapabilities = {
    'agent.mjl': { loaded: true, role: 'AGENT_SAISIE', expense_write: true, expense_validate: false, project_scope: true, convention_scope: true, activity_scope: true },
    'superviseur.n1': { loaded: true, role: 'AGENT_VERIFICATEUR', expense_write: false, expense_validate: true, project_scope: true, convention_scope: true, activity_scope: true },
    'dpaf.mjl': { loaded: true, role: 'VALIDATEUR_DEFINITIF', expense_write: false, expense_validate: true, project_scope: true, convention_scope: true, activity_scope: true },
  };
  if (JSON.stringify(capabilities) !== JSON.stringify(expectedCapabilities)) {
    throw new Error(`Invalid effective Phase 2 capabilities or scope: ${JSON.stringify(capabilities)}`);
  }

  dockerSql(`
    SET @agent = ${prerequisites.agent};
    SET @verifier = ${prerequisites.verifier};
    SET @final = ${prerequisites.final};
    SET @project = ${prerequisites.project};
    SET @convention = ${prerequisites.convention};
    SET @activity = ${prerequisites.activity};

    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase2.final2', 'Validation', 'Phase2', 'mjl.phase2.final2@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE rowid = @final;
    SET @final2 = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup)
    SELECT entity, @final2, fk_usergroup FROM llx_usergroup_user WHERE fk_user = @final;
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @final2, 'VALIDATEUR_DEFINITIF', 1, CURDATE(), 'P2DEC_E2E', 'Second validateur Phase 2', NOW(), @final);
    INSERT INTO llx_mjlfinancement_user_soc_scope
      (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat)
    SELECT entity, @final2, fk_soc, 1, CURDATE(), 'P2DEC_E2E', 'Périmètre Phase 2', NOW(), @final
    FROM llx_mjlfinancement_user_soc_scope WHERE fk_user = @final AND entity = 1 AND is_active = 1;

    INSERT INTO llx_mjlfinancement_budget_line
      (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, committed_amount, spent_amount, remaining_amount, category, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P2DEC-E2E-FLOW-BL', 'Décisions Phase 2 - flux', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'E2E', NOW(), @final, 'P2DEC_E2E', 1),
      (1, 'P2DEC-E2E-REJECT-BL', 'Décisions Phase 2 - rejet', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'E2E', NOW(), @final, 'P2DEC_E2E', 1),
      (1, 'P2DEC-E2E-RACE-BL', 'Décisions Phase 2 - concurrence', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'E2E', NOW(), @final, 'P2DEC_E2E', 1),
      (1, 'P2DEC-E2E-SELF-REVIEW-BL', 'Décisions Phase 2 - auto revue', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'E2E', NOW(), @final, 'P2DEC_E2E', 1),
      (1, 'P2DEC-E2E-SELF-FINAL-BL', 'Décisions Phase 2 - auto validation', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'E2E', NOW(), @final, 'P2DEC_E2E', 1),
      (1, 'P2DEC-E2E-SELF-DISB-BL', 'Décisions Phase 2 - auto décaissement', @project, @convention, @activity, 10000, 10000, 500, 0, 9500, 'E2E', NOW(), @final, 'P2DEC_E2E', 1);

    SET @flow_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P2DEC-E2E-FLOW-BL' AND import_key = 'P2DEC_E2E');
    SET @reject_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P2DEC-E2E-REJECT-BL' AND import_key = 'P2DEC_E2E');
    SET @race_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P2DEC-E2E-RACE-BL' AND import_key = 'P2DEC_E2E');
    SET @self_review_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P2DEC-E2E-SELF-REVIEW-BL' AND import_key = 'P2DEC_E2E');
    SET @self_final_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P2DEC-E2E-SELF-FINAL-BL' AND import_key = 'P2DEC_E2E');
    SET @self_disb_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P2DEC-E2E-SELF-DISB-BL' AND import_key = 'P2DEC_E2E');

    INSERT INTO llx_mjlfinancement_expense
      (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status, prevalidated_amount, final_validated_amount, fk_user_prevalidated, fk_user_final_valid, prevalidation_date, final_validation_date)
    VALUES
      (1, 'P2DEC-E2E-FLOW', @project, @convention, @activity, @flow_bl, 1000, CURDATE(), 'Flux exact Phase 2', 'P2DEC-E2E-FLOW.pdf', NOW(), NOW(), @agent, 'P2DEC_E2E', 1, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'P2DEC-E2E-REJECT', @project, @convention, @activity, @reject_bl, 800, CURDATE(), 'Rejet exact Phase 2', 'P2DEC-E2E-REJECT.pdf', NOW(), NOW(), @agent, 'P2DEC_E2E', 1, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'P2DEC-E2E-RACE', @project, @convention, @activity, @race_bl, 1000, CURDATE(), 'Concurrence Phase 2', 'P2DEC-E2E-RACE.pdf', NOW(), NOW(), @agent, 'P2DEC_E2E', 4, 1000, NULL, @verifier, NULL, NOW(), NULL),
      (1, 'P2DEC-E2E-SELF-REVIEW', @project, @convention, @activity, @self_review_bl, 700, CURDATE(), 'Auto revue Phase 2', 'P2DEC-E2E-SELF-REVIEW.pdf', NOW(), NOW(), @verifier, 'P2DEC_E2E', 1, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'P2DEC-E2E-SELF-FINAL', @project, @convention, @activity, @self_final_bl, 600, CURDATE(), 'Auto validation Phase 2', 'P2DEC-E2E-SELF-FINAL.pdf', NOW(), NOW(), @final, 'P2DEC_E2E', 4, 600, NULL, @verifier, NULL, NOW(), NULL),
      (1, 'P2DEC-E2E-SELF-DISB', @project, @convention, @activity, @self_disb_bl, 500, CURDATE(), 'Auto décaissement Phase 2', 'P2DEC-E2E-SELF-DISB.pdf', NOW(), NOW(), @final, 'P2DEC_E2E', 6, 500, 500, @verifier, @final2, NOW(), NOW());

    INSERT INTO llx_mjlfinancement_validation
      (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, actor_role, action_date, comment, date_creation, fk_user_creat, import_key)
    SELECT 1, CONCAT('P2DEC-E2E-', e.ref, '-PRE'), e.rowid, 'prevalidated', 'submitted', 'prevalidated', @verifier, 'AGENT_VERIFICATEUR', NOW(), 'Prévalidation fixture Phase 2', NOW(), @verifier, 'P2DEC_E2E'
    FROM llx_mjlfinancement_expense e WHERE e.ref IN ('P2DEC-E2E-RACE', 'P2DEC-E2E-SELF-FINAL', 'P2DEC-E2E-SELF-DISB') AND e.import_key = 'P2DEC_E2E';
    INSERT INTO llx_mjlfinancement_validation
      (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, actor_role, action_date, comment, date_creation, fk_user_creat, import_key)
    SELECT 1, CONCAT('P2DEC-E2E-', e.ref, '-FINAL'), e.rowid, 'final_validated', 'prevalidated', 'final_validated', @final2, 'VALIDATEUR_DEFINITIF', NOW(), 'Validation fixture Phase 2', NOW(), @final2, 'P2DEC_E2E'
    FROM llx_mjlfinancement_expense e WHERE e.ref = 'P2DEC-E2E-SELF-DISB' AND e.import_key = 'P2DEC_E2E';

    INSERT INTO llx_ecm_files
      (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    SELECT CONCAT(e.ref, '-ECM'), CONCAT(e.ref, '.pdf'), 1, CONCAT(e.ref, '.pdf'), 'mjlfinancement_expense', CONCAT(e.ref, '.pdf'), 'Pièce E2E Phase 2', 1, NOW(), @final, 'mjlfinancement_expense', e.rowid
    FROM llx_mjlfinancement_expense e WHERE e.ref LIKE 'P2DEC-E2E-%' AND e.import_key = 'P2DEC_E2E';
  `);
  dockerCommand('dolibarr', ['sh', '-lc', `mkdir -p /var/www/documents/ecm/mjlfinancement_expense && for ref in ${phase2DecisionRefs.join(' ')}; do printf '%s' "Document $ref" > "/var/www/documents/ecm/mjlfinancement_expense/$ref.pdf"; done`]);
  for (const ref of phase2DecisionRefs) {
    phase2DecisionIds[ref] = Number(dockerScalar(`SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = '${ref}' AND import_key = 'P2DEC_E2E' LIMIT 1`));
    if (!phase2DecisionIds[ref]) throw new Error(`Failed to seed ${ref}`);
  }
}

async function expenseToken(page, expenseId) {
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}`);
  const tokenInput = page.locator('input[name="token"]').first();
  if (await tokenInput.count()) return tokenInput.inputValue();
  return page.locator('meta[name="anti-csrf-newtoken"]').getAttribute('content');
}

async function postExpense(page, expenseId, payload) {
  const token = await expenseToken(page, expenseId);
  return page.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, {
    form: { token, id: String(expenseId), ...payload },
    maxRedirects: 0,
  });
}

function expenseProjection(expenseId) {
  return dockerScalar(`
    SELECT CONCAT_WS('|', status, COALESCE(prevalidated_amount, ''), COALESCE(final_validated_amount, ''), COALESCE(disbursed_amount, ''),
      COALESCE(fk_user_prevalidated, ''), COALESCE(fk_user_final_valid, ''), COALESCE(fk_user_disbursed, ''),
      COALESCE(prevalidation_date, ''), COALESCE(final_validation_date, ''), COALESCE(disbursement_date, ''),
      COALESCE(beneficiary_name, ''), COALESCE(correction_reason, ''), fk_user_creat, COALESCE(fk_user_modif, ''))
    FROM llx_mjlfinancement_expense WHERE rowid = ${Number(expenseId)}
  `);
}

function expenseStageProjection(expenseId) {
  return JSON.parse(dockerScalar(`
    SELECT JSON_OBJECT(
      'status', status,
      'prevalidated_amount', IF(prevalidated_amount IS NULL, NULL, CAST(prevalidated_amount AS CHAR)),
      'final_validated_amount', IF(final_validated_amount IS NULL, NULL, CAST(final_validated_amount AS CHAR)),
      'disbursed_amount', IF(disbursed_amount IS NULL, NULL, CAST(disbursed_amount AS CHAR)),
      'fk_user_prevalidated', fk_user_prevalidated,
      'fk_user_final_valid', fk_user_final_valid,
      'fk_user_valid', fk_user_valid,
      'fk_user_disbursed', fk_user_disbursed,
      'has_prevalidation_date', IF(prevalidation_date IS NULL, 0, 1),
      'has_final_validation_date', IF(final_validation_date IS NULL, 0, 1),
      'has_validation_date', IF(validation_date IS NULL, 0, 1),
      'disbursement_date', IF(disbursement_date IS NULL, NULL, CAST(disbursement_date AS CHAR)),
      'beneficiary_name', beneficiary_name,
      'correction_reason', correction_reason,
      'fk_user_creat', fk_user_creat,
      'fk_user_modif', fk_user_modif
    )
    FROM llx_mjlfinancement_expense
    WHERE rowid = ${Number(expenseId)}
  `));
}

function validationEventProjection(expenseId, action) {
  if (!/^[a-z_]+$/.test(action)) throw new Error('Invalid validation action fixture');
  return JSON.parse(dockerScalar(`
    SELECT JSON_OBJECT(
      'action', action,
      'from_status', from_status,
      'to_status', to_status,
      'fk_user_action', fk_user_action,
      'actor_role', actor_role,
      'has_action_date', IF(action_date IS NULL, 0, 1),
      'comment', comment,
      'fk_user_creat', fk_user_creat
    )
    FROM llx_mjlfinancement_validation
    WHERE fk_expense = ${Number(expenseId)}
      AND action = '${action}'
    LIMIT 1
  `));
}

function budgetProjection(expenseId) {
  return dockerScalar(`
    SELECT CONCAT_WS('|', ROUND(bl.committed_amount), ROUND(bl.spent_amount), ROUND(bl.remaining_amount))
    FROM llx_mjlfinancement_budget_line bl
    INNER JOIN llx_mjlfinancement_expense e ON e.fk_budget_line = bl.rowid
    WHERE e.rowid = ${Number(expenseId)}
  `);
}

function seedEmptyScopeUser() {
  cleanupEmptyScopeUser();
  dockerSql(`
    SET @agent_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Agent' AND entity = 1 LIMIT 1);
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' AND entity = 1 LIMIT 1);
    SET @empty_soc = (SELECT rowid FROM llx_societe s WHERE s.entity = 1 AND NOT EXISTS (
      SELECT 1 FROM llx_mjlfinancement_convention c
      INNER JOIN llx_mjlfinancement_activity a ON a.entity = c.entity AND a.fk_convention = c.rowid
      WHERE c.entity = s.entity AND c.fk_soc = s.rowid
    ) ORDER BY s.rowid LIMIT 1);
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase2.empty', 'Vide', 'Phase2', 'mjl.phase2.empty@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1;
    SET @phase2_empty_user = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup)
    VALUES (1, @phase2_empty_user, @agent_group);
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @phase2_empty_user, 'AGENT_SAISIE', 1, CURDATE(), 'phase2_e2e', 'Etat initial vide', NOW(), @admin);
    INSERT INTO llx_mjlfinancement_user_soc_scope
      (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @phase2_empty_user, @empty_soc, 1, CURDATE(), 'phase2_e2e', 'Etat initial vide', NOW(), @admin);
  `);
}

test.beforeAll(() => {
  dockerCommand('dolibarr', ['php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
  dockerCommand('dolibarr', ['php', '/var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php']);
  cleanupPhase2DecisionFixtures();
  seedPhase2DecisionFixtures();
});

test.afterEach(() => {
  cleanupActivities();
  cleanupEmptyScopeUser();
});

test.afterAll(() => {
  cleanupPhase2DecisionFixtures();
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

test('activity recovery registry is exact and excludes upload or unknown actions', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_activity_recovery.lib.php';
    require 'custom/mjlfinancement/lib/mjl_form.lib.php';
    $_SESSION = array();
    $reason = '';
    $mismatch = mjl_form_recovery_store(
      array('user_id' => 7, 'entity' => 1, 'route' => 'activities', 'form' => 'decision', 'action' => 'correct', 'object_id' => 42),
      array('comment' => 'Valeur isolée'), array('comment'), $reason, array('comment' => 'Erreur')
    );
    $before = array_keys($_SESSION['mjl_form_recovery']);
    $consumed = mjl_form_recovery_consume_route(
      $mismatch,
      array('user_id' => 7, 'entity' => 1, 'route' => 'activities', 'object_id' => 42),
      mjl_activity_recovery_consume_allowlist()
    );
    $after = array_keys($_SESSION['mjl_form_recovery']);
    echo json_encode([
      'registry' => mjl_activity_recovery_registry(),
      'consume' => mjl_activity_recovery_consume_allowlist(),
      'upload' => mjl_activity_recovery_config('upload'),
      'unknown' => mjl_activity_recovery_config('future_action'),
      'mismatch_consumed' => $consumed,
      'mismatch_before' => $before,
      'mismatch_after' => $after,
    ]);
  `);

  expect(result.registry).toEqual({
    create: {
      form: 'create',
      fields: ['ref', 'label', 'project_scope', 'convention_scope', 'task_scope', 'responsible_scope', 'date_start', 'date_end', 'date_actual_start', 'date_actual_end', 'physical_execution_percent', 'execution_status', 'execution_comment'],
    },
    update: {
      form: 'correction',
      fields: ['label', 'responsible_scope', 'date_start', 'date_end', 'comment'],
    },
    correct: { form: 'correction', fields: ['comment'] },
    request_correction: { form: 'correction', fields: ['comment'] },
    update_execution: {
      form: 'execution',
      fields: ['date_actual_start', 'date_actual_end', 'physical_execution_percent', 'execution_status', 'execution_comment'],
    },
    submit: { form: 'decision', fields: ['comment'] },
    prevalidate: { form: 'decision', fields: ['comment'] },
    final_validate: { form: 'decision', fields: ['comment'] },
    validate: { form: 'decision', fields: ['comment'] },
    reject: { form: 'decision', fields: ['comment'] },
    add_exchange: { form: 'comment', fields: ['message'] },
  });
  expect(result.consume).toEqual({
    create: ['create'],
    correction: ['update', 'correct', 'request_correction'],
    execution: ['update_execution'],
    decision: ['submit', 'prevalidate', 'final_validate', 'validate', 'reject'],
    comment: ['add_exchange'],
  });
  expect(result.upload).toBeNull();
  expect(result.unknown).toBeNull();
  expect(result.mismatch_consumed).toBeNull();
  expect(result.mismatch_after).toEqual(result.mismatch_before);
});

test('timeline presentation registry covers emitted and legacy values without raw fallbacks', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php';
    $actions = array('created', 'field_changed', 'execution_updated', 'document_uploaded', 'document_downloaded', 'proof_uploaded', 'unsafe_edit_rejected', 'received', 'not_received', 'submitted', 'correction_requested', 'corrected', 'prevalidated', 'validated', 'legacy_validated', 'final_validated', 'disbursed', 'rejected', 'deleted', 'activated', 'closed', 'note_added', 'export_generated');
    $genericActions = array();
    $expenseActions = array();
    foreach ($actions as $action) {
      $genericActions[$action] = mjl_timeline_presentation_action_label('mjlfinancement_activity', $action);
      $expenseActions[$action] = mjl_timeline_presentation_action_label('mjlfinancement_expense', $action);
    }
    $supportedObjects = array('mjlfinancement_project', 'mjlfinancement_activity', 'mjlfinancement_expense', 'mjlfinancement_convention', 'mjlfinancement_budget_line', 'mjlfinancement_fund_receipt', 'mjlfinancement_report');
    $objects = array();
    foreach ($supportedObjects as $value) {
      $objects[$value] = mjl_timeline_presentation_object_label($value);
    }
    $channels = array();
    foreach (array('commentaire', 'email', 'telephone', 'reunion', 'courrier', 'autre') as $value) {
      $channels[$value] = mjl_timeline_presentation_channel_label($value);
    }
    $roles = array();
    foreach (array('AGENT', 'AGENT_SAISIE', 'SUPERVISEUR_N1', 'SUPERVISEUR_N2', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF', 'ADMIN', 'ADMIN_PLATEFORME', 'N1', 'N2', 'LEGACY', 'LECTEUR') as $value) {
      $roles[$value] = mjl_timeline_presentation_actor_role_label('', '', $value);
    }
    $dpaf = array();
    foreach ($supportedObjects as $objectType) {
      $dpaf[$objectType] = array();
      foreach ($actions as $action) {
        $dpaf[$objectType][$action] = mjl_timeline_presentation_actor_role_label($objectType, $action, 'DPAF');
      }
    }
    $numericStatuses = array();
    $statusInputs = array(
      'activity' => array('mjlfinancement_activity', array(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      'expense' => array('mjlfinancement_expense', array(0, 1, 2, 3, 4, 6, 7, 8)),
      'convention' => array('mjlfinancement_convention', array(0, 1, 2)),
      'budget_line' => array('mjlfinancement_budget_line', array(0, 1)),
      'fund_receipt' => array('mjlfinancement_fund_receipt', array(0, 1, 8)),
    );
    foreach ($statusInputs as $key => $input) {
      $numericStatuses[$key] = array();
      foreach ($input[1] as $status) {
        $numericStatuses[$key][(string) $status] = mjl_timeline_presentation_status_label($input[0], $status);
      }
    }
    $aliases = array();
    foreach (array(
      'draft' => array('', 'draft'), 'active' => array('', 'active'), 'closed' => array('', 'closed'),
      'deleted' => array('', 'deleted'), 'submitted' => array('', 'submitted'),
      'prevalidated' => array('', 'prevalidated'), 'validated' => array('', 'validated'),
      'legacy_validated' => array('', 'legacy_validated'),
      'final_validated' => array('', 'final_validated'), 'rejected' => array('', 'rejected'),
      'corrected' => array('', 'corrected'), 'correction_requested' => array('', 'correction_requested'),
      'completed' => array('', 'completed'), 'cancelled' => array('', 'cancelled'),
      'received' => array('', 'received'), 'not_received' => array('', 'not_received'),
      'stored_draft' => array('', 'Brouillon'), 'stored_active' => array('', 'Active'),
      'expense_validated' => array('mjlfinancement_expense', 'validated'),
      'expense_legacy_validated' => array('mjlfinancement_expense', 'legacy_validated'),
      'cloturee' => array('mjlfinancement_convention', 'Cloturee'),
      'cloturee_accented' => array('mjlfinancement_convention', 'Clôturée'),
      'project_created' => array('mjlfinancement_project', 'Projet cree'),
      'project_created_accented' => array('mjlfinancement_project', 'Projet créé'),
      'project_updated' => array('mjlfinancement_project', 'Projet mis a jour'),
      'project_updated_accented' => array('mjlfinancement_project', 'Projet mis à jour'),
      'project_note' => array('mjlfinancement_project', 'Note projet'),
      'document_downloaded' => array('mjlfinancement_activity', 'Document telecharge'),
      'document_downloaded_accented' => array('mjlfinancement_activity', 'Document téléchargé'),
      'export_csv' => array('mjlfinancement_report', 'Export csv'),
      'export_csv_upper' => array('mjlfinancement_report', 'Export CSV'),
      'export_xlsx' => array('mjlfinancement_report', 'Export xlsx'),
      'export_xlsx_upper' => array('mjlfinancement_report', 'Export XLSX'),
      'activity_ongoing' => array('mjlfinancement_activity', 'ongoing'),
      'activity_ongoing_stored' => array('mjlfinancement_activity', 'En cours'),
      'activity_completed_stored' => array('mjlfinancement_activity', 'Terminée'),
      'activity_submitted_stored' => array('mjlfinancement_activity', 'Soumise'),
      'activity_correction_requested_stored' => array('mjlfinancement_activity', 'Correction demandée'),
      'activity_corrected_stored' => array('mjlfinancement_activity', 'Corrigée'),
      'activity_validated_stored' => array('mjlfinancement_activity', 'Validée définitivement'),
      'activity_prevalidated_stored' => array('mjlfinancement_activity', 'Prévalidée'),
      'activity_rejected_stored' => array('mjlfinancement_activity', 'Rejetée'),
      'activity_cancelled_stored' => array('mjlfinancement_activity', 'Annulée'),
      'expense_disbursed_stored' => array('mjlfinancement_expense', 'Décaissée')
    ) as $key => $input) {
      $aliases[$key] = mjl_timeline_presentation_status_label($input[0], $input[1]);
    }
    echo json_encode([
      'generic_actions' => $genericActions,
      'expense_actions' => $expenseActions,
      'objects' => $objects,
      'channels' => $channels,
      'roles' => $roles,
      'dpaf' => $dpaf,
      'numeric_statuses' => $numericStatuses,
      'aliases' => $aliases,
      'empty_action' => mjl_timeline_presentation_action_label('', ''),
      'unknown_action' => mjl_timeline_presentation_action_label('', 'future_machine_action'),
      'empty_role' => mjl_timeline_presentation_actor_role_label('', '', ''),
      'unknown_role' => mjl_timeline_presentation_actor_role_label('', '', 'FUTURE_ROLE'),
      'empty_object' => mjl_timeline_presentation_object_label(''),
      'unknown_object' => mjl_timeline_presentation_object_label('future_object'),
      'empty_channel' => mjl_timeline_presentation_channel_label(''),
      'unknown_channel' => mjl_timeline_presentation_channel_label('future_channel'),
      'empty_status' => mjl_timeline_presentation_status_label('', ''),
      'unknown_status' => mjl_timeline_presentation_status_label('mjlfinancement_expense', 'future_status'),
    ]);
  `);

  expect(result.generic_actions).toEqual({
    created: 'Création',
    field_changed: 'Modification',
    execution_updated: 'Exécution mise à jour',
    document_uploaded: 'Document ajouté',
    document_downloaded: 'Document téléchargé',
    proof_uploaded: 'Preuve ajoutée',
    unsafe_edit_rejected: 'Modification refusée',
    received: 'Réception',
    not_received: 'Non-réception',
    submitted: 'Soumission',
    correction_requested: 'Correction demandée',
    corrected: 'Correction',
    prevalidated: 'Prévalidation',
    validated: 'Validation définitive',
    legacy_validated: 'Validation définitive',
    final_validated: 'Validation définitive',
    disbursed: 'Décaissement',
    rejected: 'Rejet',
    deleted: 'Suppression',
    activated: 'Activation',
    closed: 'Clôture',
    note_added: 'Commentaire ajouté',
    export_generated: 'Export généré',
  });
  expect(result.expense_actions).toEqual({
    ...result.generic_actions,
    document_uploaded: 'Pièce justificative ajoutée',
    validated: 'Validation enregistrée',
    legacy_validated: 'Validation enregistrée',
  });
  expect(result.objects).toEqual({
    mjlfinancement_project: 'Projet',
    mjlfinancement_activity: 'Activité',
    mjlfinancement_expense: 'Dépense',
    mjlfinancement_convention: 'Enveloppe de financement',
    mjlfinancement_budget_line: 'Ligne budgétaire',
    mjlfinancement_fund_receipt: 'Fonds reçu',
    mjlfinancement_report: 'Rapport / export',
  });
  expect(result.channels).toEqual({
    commentaire: 'Commentaire',
    email: 'Email',
    telephone: 'Téléphone',
    reunion: 'Réunion',
    courrier: 'Courrier',
    autre: 'Autre',
  });
  expect(result.roles).toEqual({
    AGENT: 'Agent de saisie',
    AGENT_SAISIE: 'Agent de saisie',
    SUPERVISEUR_N1: 'Agent vérificateur',
    SUPERVISEUR_N2: 'Agent vérificateur',
    AGENT_VERIFICATEUR: 'Agent vérificateur',
    VALIDATEUR_DEFINITIF: 'Validateur définitif',
    ADMIN: 'Administrateur plateforme',
    ADMIN_PLATEFORME: 'Administrateur plateforme',
    N1: 'Rôle historique non résolu',
    N2: 'Rôle historique non résolu',
    LEGACY: 'Rôle historique non résolu',
    LECTEUR: 'Rôle non reconnu',
  });
  const emittedActions = Object.keys(result.generic_actions);
  const supportedObjects = Object.keys(result.objects);
  const definitiveDpafPairs = new Set([
    'mjlfinancement_activity|validated',
    'mjlfinancement_activity|final_validated',
    'mjlfinancement_activity|rejected',
    'mjlfinancement_activity|correction_requested',
    'mjlfinancement_expense|validated',
    'mjlfinancement_expense|legacy_validated',
    'mjlfinancement_expense|final_validated',
    'mjlfinancement_expense|disbursed',
    'mjlfinancement_expense|rejected',
  ]);
  expect(Object.keys(result.dpaf)).toEqual(supportedObjects);
  for (const objectType of supportedObjects) {
    expect(Object.keys(result.dpaf[objectType])).toEqual(emittedActions);
    for (const action of emittedActions) {
      const pair = `${objectType}|${action}`;
      expect(result.dpaf[objectType][action], pair).toBe(
        definitiveDpafPairs.has(pair) ? 'Validateur définitif' : 'Rôle historique non résolu',
      );
    }
  }
  expect(result.numeric_statuses).toEqual({
    activity: ['Brouillon', 'En cours', 'Terminée', 'Soumise', 'Correction demandée', 'Corrigée', 'Validée définitivement', 'Prévalidée', 'Rejetée', 'Annulée'],
    expense: {
      0: 'Brouillon', 1: 'Soumise', 2: 'Validation enregistrée', 3: 'Corrigée',
      4: 'Prévalidée', 6: 'Validée définitivement', 7: 'Décaissée', 8: 'Rejetée',
    },
    convention: ['Brouillon', 'Active', 'Clôturée'],
    budget_line: ['Brouillon', 'Active'],
    fund_receipt: { 0: 'Brouillon', 1: 'Reçu', 8: 'Non reçu' },
  });
  expect(result.aliases).toEqual({
    draft: 'Brouillon',
    active: 'Active',
    closed: 'Clôturée',
    deleted: 'Supprimée',
    submitted: 'Soumise',
    prevalidated: 'Prévalidée',
    validated: 'Validée définitivement',
    legacy_validated: 'Validée définitivement',
    final_validated: 'Validée définitivement',
    rejected: 'Rejetée',
    corrected: 'Corrigée',
    correction_requested: 'Correction demandée',
    completed: 'Terminée',
    cancelled: 'Annulée',
    received: 'Reçu',
    not_received: 'Non reçu',
    stored_draft: 'Brouillon',
    stored_active: 'Active',
    expense_validated: 'Validation enregistrée',
    expense_legacy_validated: 'Validation enregistrée',
    cloturee: 'Clôturée',
    cloturee_accented: 'Clôturée',
    project_created: 'Projet créé',
    project_created_accented: 'Projet créé',
    project_updated: 'Projet mis à jour',
    project_updated_accented: 'Projet mis à jour',
    project_note: 'Note projet',
    document_downloaded: 'Document téléchargé',
    document_downloaded_accented: 'Document téléchargé',
    export_csv: 'Export CSV',
    export_csv_upper: 'Export CSV',
    export_xlsx: 'Export XLSX',
    export_xlsx_upper: 'Export XLSX',
    activity_ongoing: 'En cours',
    activity_ongoing_stored: 'En cours',
    activity_completed_stored: 'Terminée',
    activity_submitted_stored: 'Soumise',
    activity_correction_requested_stored: 'Correction demandée',
    activity_corrected_stored: 'Corrigée',
    activity_validated_stored: 'Validée définitivement',
    activity_prevalidated_stored: 'Prévalidée',
    activity_rejected_stored: 'Rejetée',
    activity_cancelled_stored: 'Annulée',
    expense_disbursed_stored: 'Décaissée',
  });
  expect(result.empty_action).toBe('Événement non renseigné');
  expect(result.unknown_action).toBe('Événement non reconnu');
  expect(result.empty_role).toBe('Rôle non renseigné');
  expect(result.unknown_role).toBe('Rôle non reconnu');
  expect(result.empty_object).toBe('Objet non renseigné');
  expect(result.unknown_object).toBe('Objet non reconnu');
  expect(result.empty_channel).toBe('Canal non renseigné');
  expect(result.unknown_channel).toBe('Canal non reconnu');
  expect(result.empty_status).toBe('Statut non renseigné');
  expect(result.unknown_status).toBe('Statut non reconnu');
});

test('unknown legacy audit values render neutral labels on guarded activity and audit routes', async ({ page }) => {
  const suffix = Date.now();
  const ref = `P2-LEGACY-${suffix}`;
  const action = `future_machine_${suffix}`;
  const role = `FUTURE_ROLE_${suffix}`;
  await login(page, 'agent.mjl');
  const activityId = await createActivityFixture(page, ref, 'Vocabulaire historique contrôlé');
  dockerSql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1);
    INSERT INTO llx_mjlfinancement_workflow_action
      (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, reason, comment, changes_json, date_creation, fk_user_creat, import_key)
    VALUES
      (1, 'P2-WFA-LEGACY-${suffix}', 'mjlfinancement_activity', ${activityId}, '${action}', 'future_before_${suffix}', 'future_after_${suffix}', @agent, '${role}', NOW(), '', 'Repère de présentation Phase 2', '{}', NOW(), @agent, 'P2_E2E');
  `);

  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  const timelineItem = page.locator('.mjl-activity-timeline li', { hasText: 'Repère de présentation Phase 2' });
  await expect(timelineItem.locator('.mjl-status-pill')).toHaveText('Événement non reconnu');
  await expect(timelineItem.locator('p').first()).toContainText('(Rôle non reconnu)');
  await expect(timelineItem.locator('.mjl-status-pill')).not.toContainText(action);
  await expect(timelineItem.locator('p').first()).not.toContainText(role);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/workflowactions.php');
  const auditRow = page.getByRole('row', { name: new RegExp(ref) });
  await expect(auditRow).toContainText('Activité');
  await expect(auditRow).toContainText('Événement non reconnu');
  await expect(auditRow).toContainText('Statut non reconnu');
  await expect(auditRow).toContainText('Rôle non reconnu');
  await expect(auditRow).not.toContainText(action);
  await expect(auditRow).not.toContainText(role);
});

test('activity JavaScript has one route owner and shared components remain shell-owned', () => {
  const productionRoot = path.join(projectRoot, 'custom/mjlfinancement');
  const references = [];
  for (const entry of fs.readdirSync(productionRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(entry.parentPath || entry.path, entry.name);
    const contents = fs.readFileSync(fullPath, 'utf8');
    if (contents.includes('js/activities.js')) references.push(path.relative(projectRoot, fullPath));
  }
  expect(references).toEqual(['custom/mjlfinancement/activities.php']);
});

test('real activity info and success badges use approved computed colors and contrast', async ({ page }) => {
  const suffix = Date.now();
  const fixtures = [
    { ref: `P2-TONE-INFO-${suffix}`, label: 'Activité en cours contrôlée', status: 1, expectedClass: 'mjl-status-info', color: 'rgb(22, 79, 122)', background: 'rgb(234, 243, 248)', minimum: 7.67 },
    { ref: `P2-TONE-SUCCESS-${suffix}`, label: 'Activité terminée contrôlée', status: 2, expectedClass: 'mjl-status-success', color: 'rgb(23, 99, 58)', background: 'rgb(232, 245, 236)', minimum: 6.48 },
  ];
  for (const fixture of fixtures) cleanupActivityRefs.add(fixture.ref);
  dockerSql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    INSERT INTO llx_mjlfinancement_activity
      (entity, ref, label, fk_project, fk_convention, date_creation, fk_user_creat, status)
    VALUES
      (1, '${fixtures[0].ref}', '${fixtures[0].label}', @project, @convention, NOW(), @agent, 1),
      (1, '${fixtures[1].ref}', '${fixtures[1].label}', @project, @convention, NOW(), @agent, 2);
  `);

  await login(page, 'agent.mjl');
  for (const fixture of fixtures) {
    await page.goto(`/custom/mjlfinancement/activities.php?status=${fixture.status}&sort=recent`);
    const row = page.getByRole('row', { name: new RegExp(fixture.ref) });
    const badge = row.locator('.mjl-status-pill');
    await expect(badge).toContainText(fixture.status === 1 ? 'En cours' : 'Terminée');
    await expect(badge).toHaveClass(new RegExp(fixture.expectedClass));
    const style = await badge.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { color: computed.color, background: computed.backgroundColor, border: computed.borderColor };
    });
    expect(style).toEqual({ color: fixture.color, background: fixture.background, border: fixture.color });
    expect(renderedContrast(style.color, style.background)).toBeGreaterThanOrEqual(fixture.minimum);
  }
});

test('activity script loads once before shared components and nowhere else', async ({ page }) => {
  await login(page, 'admin.poc');
  const activityId = dockerScalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1");
  for (const route of ['/custom/mjlfinancement/activities.php', `/custom/mjlfinancement/activities.php?id=${activityId}`]) {
    await page.goto(route);
    const scripts = await page.locator('script[src*="/custom/mjlfinancement/js/"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('src')));
    expect(scripts.filter((src) => src.endsWith('/activities.js'))).toHaveLength(1);
    expect(scripts.filter((src) => src.endsWith('/mjl_components.js'))).toHaveLength(1);
    expect(scripts.findIndex((src) => src.endsWith('/activities.js'))).toBeLessThan(scripts.findIndex((src) => src.endsWith('/mjl_components.js')));
  }
  for (const route of ['/custom/mjlfinancement/index.php', '/custom/mjlfinancement/expenses.php', '/custom/mjlfinancement/projects.php', '/custom/mjlfinancement/partners.php']) {
    await page.goto(route);
    await expect(page.locator('script[src$="/activities.js"]'), route).toHaveCount(0);
    await expect(page.locator('script[src$="/mjl_components.js"]'), route).toHaveCount(1);
  }
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

test('partial timeline and alert warnings render successful content without technical leakage', async ({ page }) => {
  const result = dockerPhpJson(`
    define('NOLOGIN', 1);
    require '/var/www/html/main.inc.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alerts.lib.php';
    ob_start();
    mjl_timeline_render([
      'items' => [[
        'label' => 'Décision',
        'title' => 'Événement disponible',
        'meta' => '29/07/2026 à 10:00',
        'comment' => 'Contenu conservé',
        'changes' => [],
      ]],
      'errors' => [['source' => 'documents', 'category' => 'database']],
    ]);
    $timeline = ob_get_clean();
    ob_start();
    mjl_alerts_render_result([
      'items' => [[
        'tone' => 'warning',
        'severity' => 'Action attendue',
        'object_type' => 'Activité',
        'ref' => 'P2-ALERT',
        'label' => 'Alerte disponible',
        'audience' => 'Agent de saisie',
        'expected_action' => 'Ouvrir et vérifier.',
        'meta' => ['Projet' => 'P2'],
        'href' => '/custom/mjlfinancement/activities.php?id=1',
      ]],
      'errors' => [['source' => 'finance', 'category' => 'database']],
    ]);
    $alerts = ob_get_clean();
    echo json_encode(['timeline' => $timeline, 'alerts' => $alerts]);
  `);
  await page.setContent(`<main>${result.timeline}${result.alerts}</main>`);

  await expect(page.locator('.mjl-system-state-partial-error').filter({ hasText: 'Historique partiellement disponible' })).toBeVisible();
  await expect(page.getByText('Événement disponible')).toBeVisible();
  await expect(page.getByText('Contenu conservé')).toBeVisible();
  await expect(page.locator('.mjl-system-state-partial-error').filter({ hasText: 'Alertes partiellement disponibles' })).toBeVisible();
  await expect(page.getByText('Alerte disponible')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/SQLSTATE|SELECT |Unknown column|driver/i);
});

test('activity route distinguishes an initially empty scope from filtered-empty recovery', async ({ page }) => {
  seedEmptyScopeUser();
  await login(page, 'mjl.phase2.empty');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.getByRole('table', { name: 'Activités du périmètre' })).toContainText('Aucune activité dans votre périmètre pour le moment.');
  await expect(page.locator('[data-mjl-scoped-count]')).toHaveText('0');

  await page.goto('/custom/mjlfinancement/activities.php?status=3');
  await expect(page.getByRole('table', { name: 'Activités du périmètre' })).toContainText('Aucune activité ne correspond aux filtres appliqués.');
  await expect(page.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', /activities\.php$/);
});

test('exact activity execution failures translate only to their linked fields', () => {
  const result = phpJson(`
    require 'custom/mjlfinancement/lib/mjl_form.lib.php';
    echo json_encode([
      'percent' => mjl_form_translate_domain_error('Physical execution percentage must be between 0 and 100'),
      'comment' => mjl_form_translate_domain_error('Completed execution with a percentage other than 100 requires an execution comment'),
      'unknown' => mjl_form_translate_domain_error('driver-specific unknown failure'),
    ]);
  `);

  expect(result.percent).toEqual({ physical_execution_percent: 'Le taux d’exécution doit être compris entre 0 et 100.' });
  expect(result.comment).toEqual({ execution_comment: 'Un commentaire est obligatoire lorsqu’une activité exécutée n’est pas renseignée à 100 %.' });
  expect(result.unknown).toEqual([]);
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
  await page.goto('/custom/mjlfinancement/activities.php?action=create');

  const form = page.locator('form[data-mjl-validate][data-mjl-form="activity-create"]');
  await expect(form).toHaveAttribute('novalidate', '');
  await form.locator('#mjl-field-execution_comment').fill('Valeur valide conservée');
  await form.getByRole('button', { name: 'Créer l’activité' }).click();

  const summary = form.locator('[data-mjl-error-summary]');
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('link', { name: 'La référence est obligatoire.' })).toHaveAttribute('href', '#mjl-field-ref');
  await expect(form.locator('#mjl-field-ref')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.locator('#mjl-field-ref-error')).toHaveText('La référence est obligatoire.');
  await expect(summary.getByRole('link')).toHaveCount(4);
  await expect(summary.getByRole('link', { name: 'Ce champ est obligatoire.' })).toHaveCount(2);
  await expect(form.locator('#mjl-field-execution_comment')).toHaveValue('Valeur valide conservée');
});

test('activity server recovery retains safe values once and rejects invalid security context', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');

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

test('two tabs keep recovery isolated and expired or cross-context handles reveal nothing', async ({ page, context }) => {
  await login(page, 'agent.mjl');
  const secondTab = await context.newPage();
  const tabOneLocation = await createInvalidRecovery(page, 'P2-TAB-ONE', 'Premier onglet');
  const tabTwoLocation = await createInvalidRecovery(secondTab, 'P2-TAB-TWO', 'Deuxième onglet');

  await page.goto(tabOneLocation);
  await secondTab.goto(tabTwoLocation);
  await expect(page.locator('#mjl-field-ref')).toHaveValue('P2-TAB-ONE');
  await expect(secondTab.locator('#mjl-field-ref')).toHaveValue('P2-TAB-TWO');
  await page.goto(tabOneLocation);
  await expect(page.locator('#mjl-field-ref')).toHaveValue('');

  for (const [mutation, ref] of [
    ['expire', 'P2-EXPIRED'],
    ['cross_user', 'P2-CROSS-USER'],
    ['cross_entity', 'P2-CROSS-ENTITY'],
  ]) {
    const location = await createInvalidRecovery(page, ref, 'Ne doit pas être révélée');
    const handle = new URL(location, 'http://127.0.0.1').searchParams.get('mjl_recovery');
    mutateRecoverySession(handle, mutation);
    await page.goto(`${location}&recovery_proof=${Date.now()}`);
    await expect(page.locator('#mjl-field-ref')).toHaveValue('');
    await expect(page.locator('body')).not.toContainText('Ne doit pas être révélée');
  }
  await secondTab.close();
});

test('activity form keeps native validation without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  const form = page.locator('form[data-mjl-form="activity-create"]');
  await expect(form).not.toHaveAttribute('novalidate', '');
  await expect(form.locator('#mjl-field-ref')).toHaveAttribute('required', '');
  await form.getByRole('button', { name: 'Créer l’activité' }).click();
  await expect(page).toHaveURL(/activities\.php\?action=create$/);
  await expect(form.locator('#mjl-field-ref')).toBeFocused();
  await context.close();
});

test('activity recovery is isolated by exact action and absent for upload failures', async ({ page }) => {
  const ref = `P2-RECOVERY-${Date.now()}`;
  await login(page, 'agent.mjl');
  const activityId = await createActivityFixture(page, ref, 'Isolation de reprise Phase 2');
  expect((await postActivityDecision(page, activityId, 'submit', 'Soumission pour reprise')).status()).toBe(302);

  await login(page, 'superviseur.n1');
  expect((await postActivityDecision(page, activityId, 'request_correction', 'Correction demandée')).status()).toBe(302);

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  const baselineHandles = await recoverySessionHandles(page);
  const correctForm = page.locator('form[data-mjl-form="activity-decision"]', {
    has: page.locator('input[name="action"][value="correct"]'),
  });
  const validToken = await correctForm.locator('input[name="token"]').inputValue();
  for (const request of [
    { token: 'invalid', action: 'correct', id: String(activityId), comment: '' },
    { token: validToken, action: 'final_validate', id: String(activityId), comment: 'Action interdite' },
    { token: validToken, action: 'future_action', id: String(activityId), comment: 'Action inconnue' },
  ]) {
    const response = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
      form: request,
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    expect(response.headers().location || '').not.toContain('mjl_recovery=');
    expect(await recoverySessionHandles(page)).toEqual(baselineHandles);
  }
  const correctResponse = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: {
      token: validToken,
      action: 'correct',
      id: String(activityId),
      comment: '',
    },
    maxRedirects: 0,
  });
  expect(correctResponse.status()).toBe(302);
  expect(correctResponse.headers().location).toMatch(/mjl_recovery=[a-f0-9]{32}/);
  await page.goto(correctResponse.headers().location);

  const recoveredCorrect = page.locator('form[data-mjl-form="activity-decision"]', {
    has: page.locator('input[name="action"][value="correct"]'),
  });
  await expect(recoveredCorrect.locator('[data-mjl-form-errors]')).toContainText('Corrigez les champs indiqués');
  await expect(recoveredCorrect.locator('textarea[name="comment"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('form[data-mjl-form="activity-update"]')).toHaveCount(0);
  expect(await recoverySessionHandles(page)).toEqual(baselineHandles);

  const uploadResponse = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: {
      token: await page.locator('input[name="token"]').first().inputValue(),
      action: 'upload',
      id: String(activityId),
    },
    maxRedirects: 0,
  });
  expect(uploadResponse.status()).toBe(302);
  expect(uploadResponse.headers().location || '').not.toContain('mjl_recovery=');
  expect(await recoverySessionHandles(page)).toEqual(baselineHandles);
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

test('activity table retains semantic desktop layout at 1366px/1024px and labeled cards at 768px/390px', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
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
  await page.goto(createResponse.headers().location);
  await expect(page.getByRole('link', { name: 'Modifier l’activité' })).toBeVisible();
  await expect(page.locator('form[data-mjl-form="activity-update"]')).toHaveCount(0);
  await expect(page.locator('form[data-mjl-form="activity-execution"] #mjl-execution-physical_execution_percent')).toBeVisible();
  await expect(page.locator('form[data-mjl-form="contextual-comment"] #mjl-comment-message')).toBeVisible();
  await page.goto('/custom/mjlfinancement/activities.php');
  const table = page.getByRole('table', { name: 'Activités du périmètre' });

  for (const width of [1366, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(table.locator('thead')).toHaveCSS('position', 'static');
    await expect(table.getByRole('columnheader')).toHaveCount(8);
    await expect(table.locator('tbody tr:not(.mjl-table-empty-row)').first().locator('td[data-label="Prochaine action"]')).toHaveCSS('display', 'table-cell');
  }

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const firstCard = table.locator('tbody tr:not(.mjl-table-empty-row)').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator('td[data-label="Activité"]')).toHaveCSS('display', 'grid');
    await expect(firstCard.locator('td[data-label="Statut"]')).toBeVisible();
    await expect(firstCard.locator('td[data-label="Prochaine action"]')).toBeVisible();
    await expect(firstCard.locator('td[data-label="Ouvrir"] a')).toHaveText('Ouvrir');
  }
});

test('activity pagination retains normalized sort and filter queries at boundaries', async ({ page }) => {
  const prefix = `P2PAGE${Date.now()}-`;
  cleanupActivityPrefixes.add(prefix);
  dockerSql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    INSERT INTO llx_mjlfinancement_activity
      (entity, ref, label, fk_project, fk_convention, date_creation, fk_user_creat, status, date_end)
    WITH RECURSIVE seq AS (
      SELECT 1 AS n
      UNION ALL
      SELECT n + 1 FROM seq WHERE n < 51
    )
    SELECT 1, CONCAT('${prefix}', LPAD(n, 2, '0')), CONCAT('Pagination Phase 2 ', n),
      @project, @convention, DATE_ADD(NOW(), INTERVAL n SECOND), @agent, 9,
      DATE_ADD(CURDATE(), INTERVAL n DAY)
    FROM seq;
  `);

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?status=9&sort=recent&page=1');
  const table = page.getByRole('table', { name: 'Activités du périmètre' });
  await expect(table.locator('tbody tr:not(.mjl-table-empty-row)')).toHaveCount(50);
  await expect(page.locator('[data-mjl-scoped-count]')).toHaveText('51');
  const next = page.getByRole('link', { name: 'Page suivante' });
  await expect(next).toHaveAttribute('href', /status=9/);
  await expect(next).toHaveAttribute('href', /sort=recent/);
  await expect(next).toHaveAttribute('href', /page=2/);
  await next.click();
  await expect(page).toHaveURL(/status=9.*sort=recent.*page=2/);
  await expect(table.locator('tbody tr:not(.mjl-table-empty-row)')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Page précédente' })).toBeVisible();

  await page.goto('/custom/mjlfinancement/activities.php?project=999999999&sort=deadline');
  await expect(page.locator('[data-mjl-scoped-count]')).toHaveText('0');
  await expect(page.getByText('Aucune activité ne correspond aux filtres appliqués.')).toBeVisible();
});

test('expense consequences remain visible in dedicated action states with and without JavaScript', async ({ browser, page }) => {
  const disburseId = Number(dockerScalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-001' AND entity = 1 LIMIT 1"));
  const submittedId = Number(dockerScalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-002' AND entity = 1 LIMIT 1"));
  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${disburseId}`);
  await page.getByRole('link', { name: 'Enregistrer le décaissement' }).click();

  const form = page.locator('form[data-mjl-form="expense-decision"]');
  await expect(form.locator('[data-mjl-consequence]')).toContainText('Le décaissement confirme que les fonds ont effectivement été versés.');
  await form.getByLabel('Beneficiaire').fill('Bénéficiaire Phase 2');
  await form.getByLabel('Date decaissement').fill('2026-07-29');
  await expect(form).not.toHaveAttribute('data-mjl-confirm');
  await expect(page.getByRole('dialog', { name: 'Confirmer la décision' })).toHaveCount(0);

  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJsContext.newPage();
  await login(noJsPage, 'dpaf.mjl');
  await noJsPage.goto(`/custom/mjlfinancement/expenses.php?id=${disburseId}&action=disburse`);
  const noJsForm = noJsPage.locator('form[data-mjl-form="expense-decision"]');
  await expect(noJsForm.locator('[data-mjl-consequence]')).toBeVisible();
  await expect(noJsForm.getByRole('button', { name: 'Enregistrer le décaissement' })).toBeEnabled();
  await noJsContext.close();

  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedId}`);
  await expect(page.locator('form input[name="action"][value="prevalidate"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Prévalider la dépense' })).toBeVisible();
});

test('stale, invalid-token, and premature expense decisions remain server-rejected', async ({ page }) => {
  const finalId = Number(dockerScalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-001' AND entity = 1 LIMIT 1"));
  const submittedId = Number(dockerScalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-002' AND entity = 1 LIMIT 1"));
  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${finalId}`);
  const token = await page.locator('meta[name="anti-csrf-newtoken"]').getAttribute('content');

  const stale = await page.request.post(`/custom/mjlfinancement/expenses.php?id=${finalId}`, {
    form: {
      token,
      action: 'final_validate',
      id: String(finalId),
      expected_status: '4',
      final_validated_amount: '100',
    },
    maxRedirects: 0,
  });
  expect(stale.status()).toBe(403);
  expect(await stale.text()).toContain('a déjà été traitée');

  const invalidToken = await page.request.post(`/custom/mjlfinancement/expenses.php?id=${finalId}`, {
    form: {
      token: 'invalid',
      action: 'final_validate',
      id: String(finalId),
      expected_status: '4',
    },
    maxRedirects: 0,
  });
  expect(invalidToken.status()).toBe(403);

  const premature = await page.request.post(`/custom/mjlfinancement/expenses.php?id=${submittedId}`, {
    form: {
      token,
      action: 'final_validate',
      id: String(submittedId),
      expected_status: '4',
      final_validated_amount: '100',
    },
    maxRedirects: 0,
  });
  expect(premature.status()).toBe(403);
});

test('repeated submission is rejected and repeated correction cycles stay strictly chronological', async ({ page }) => {
  const ref = `P2-CYCLE-${Date.now()}`;
  await login(page, 'agent.mjl');
  const activityId = await createActivityFixture(page, ref, 'Cycle Phase 2');

  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  const submitToken = await page.locator('form input[name="action"][value="submit"]').locator('..').locator('input[name="token"]').inputValue();
  const firstSubmit = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: { token: submitToken, action: 'submit', id: String(activityId), comment: 'Soumission initiale' },
    maxRedirects: 0,
  });
  const duplicateSubmit = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: { token: submitToken, action: 'submit', id: String(activityId), comment: 'Soumission dupliquée' },
    maxRedirects: 0,
  });
  expect(firstSubmit.status()).toBe(302);
  expect(duplicateSubmit.status()).toBe(403);

  for (let cycle = 1; cycle <= 2; cycle += 1) {
    await login(page, 'superviseur.n1');
    expect((await postActivityDecision(page, activityId, 'request_correction', `Retour ${cycle}`)).status()).toBe(302);
    await login(page, 'agent.mjl');
    expect((await postActivityDecision(page, activityId, 'correct', `Correction ${cycle}`)).status()).toBe(302);
    expect((await postActivityDecision(page, activityId, 'submit', `Resoumission ${cycle}`)).status()).toBe(302);
  }

  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  const comments = await page.locator('.mjl-activity-timeline .mjl-timeline-comment').allTextContents();
  expect(comments).toEqual([
    'Soumission initiale',
    'Retour 1',
    'Correction 1',
    'Resoumission 1',
    'Retour 2',
    'Correction 2',
    'Resoumission 2',
  ]);
  await expect(page.locator('body')).not.toContainText('Soumission dupliquée');
});

test('Phase 2 expense decisions are exact-one with fresh-token stale replays', async ({ page }) => {
  const flowId = phase2DecisionIds['P2DEC-E2E-FLOW'];
  const actorIds = {
    agent: Number(dockerScalar("SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1")),
    verifier: Number(dockerScalar("SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' AND entity = 1 LIMIT 1")),
    final: Number(dockerScalar("SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' AND entity = 1 LIMIT 1")),
  };
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${flowId}`);
  await page.getByRole('link', { name: 'Prévalider la dépense' }).click();
  await page.getByLabel('Montant prévalidé').fill('1000');
  await page.getByLabel('Commentaire de prévalidation').fill('Prévalidation exacte Phase 2');
  await page.getByRole('button', { name: 'Prévalider la dépense' }).click();
  await expect(page.getByText('Prévalidée').first()).toBeVisible();
  expect(validationEventProjection(flowId, 'prevalidated')).toEqual({
    action: 'prevalidated',
    from_status: 'submitted',
    to_status: 'prevalidated',
    fk_user_action: actorIds.verifier,
    actor_role: 'AGENT_VERIFICATEUR',
    has_action_date: 1,
    comment: 'Prévalidation exacte Phase 2',
    fk_user_creat: actorIds.verifier,
  });
  expect(expenseStageProjection(flowId)).toEqual({
    status: 4,
    prevalidated_amount: '1000.00000000',
    final_validated_amount: null,
    disbursed_amount: null,
    fk_user_prevalidated: actorIds.verifier,
    fk_user_final_valid: null,
    fk_user_valid: null,
    fk_user_disbursed: null,
    has_prevalidation_date: 1,
    has_final_validation_date: 0,
    has_validation_date: 0,
    disbursement_date: null,
    beneficiary_name: null,
    correction_reason: null,
    fk_user_creat: actorIds.agent,
    fk_user_modif: actorIds.verifier,
  });
  let replay = await postExpense(page, flowId, {
    action: 'prevalidate', expected_status: '1', prevalidated_amount: '1000', comment: 'Prévalidation exacte Phase 2',
  });
  expect(replay.status()).toBe(403);
  expect(await replay.text()).toContain('a déjà été traitée');
  expect(Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'prevalidated'`))).toBe(1);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${flowId}`);
  await page.getByRole('link', { name: 'Valider définitivement la dépense' }).click();
  await page.getByLabel('Montant validé définitivement').fill('1000');
  await page.getByLabel('Commentaire de validation définitive').fill('Validation définitive exacte Phase 2');
  await page.getByRole('button', { name: 'Valider définitivement la dépense' }).click();
  await expect(page.getByText('Validée définitivement').first()).toBeVisible();
  expect(validationEventProjection(flowId, 'final_validated')).toEqual({
    action: 'final_validated',
    from_status: 'prevalidated',
    to_status: 'final_validated',
    fk_user_action: actorIds.final,
    actor_role: 'VALIDATEUR_DEFINITIF',
    has_action_date: 1,
    comment: 'Validation définitive exacte Phase 2',
    fk_user_creat: actorIds.final,
  });
  expect(expenseStageProjection(flowId)).toEqual({
    status: 6,
    prevalidated_amount: '1000.00000000',
    final_validated_amount: '1000.00000000',
    disbursed_amount: null,
    fk_user_prevalidated: actorIds.verifier,
    fk_user_final_valid: actorIds.final,
    fk_user_valid: actorIds.final,
    fk_user_disbursed: null,
    has_prevalidation_date: 1,
    has_final_validation_date: 1,
    has_validation_date: 1,
    disbursement_date: null,
    beneficiary_name: null,
    correction_reason: null,
    fk_user_creat: actorIds.agent,
    fk_user_modif: actorIds.final,
  });
  expect(budgetProjection(flowId)).toBe('1000|0|9000');
  replay = await postExpense(page, flowId, {
    action: 'final_validate', expected_status: '4', final_validated_amount: '1000', comment: 'Validation définitive exacte Phase 2',
  });
  expect(replay.status()).toBe(403);
  expect(await replay.text()).toContain('a déjà été traitée');
  expect(Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'final_validated'`))).toBe(1);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${flowId}`);
  await page.getByRole('link', { name: 'Enregistrer le décaissement' }).click();
  await page.getByLabel('Beneficiaire').fill('Bénéficiaire exact Phase 2');
  await page.getByLabel('Date decaissement').fill('2026-07-29');
  await page.getByRole('button', { name: 'Enregistrer le décaissement' }).click();
  await expect(page.getByText('Décaissée').first()).toBeVisible();
  const successBadge = page.locator('.mjl-status-pill.mjl-status-success').filter({ hasText: 'Décaissée' }).first();
  const successStyle = await successBadge.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { color: computed.color, background: computed.backgroundColor, border: computed.borderColor };
  });
  expect(successStyle).toEqual({
    color: 'rgb(23, 99, 58)',
    background: 'rgb(232, 245, 236)',
    border: 'rgb(23, 99, 58)',
  });
  expect(renderedContrast(successStyle.color, successStyle.background)).toBeGreaterThanOrEqual(6.48);
  expect(validationEventProjection(flowId, 'disbursed')).toEqual({
    action: 'disbursed',
    from_status: 'final_validated',
    to_status: 'disbursed',
    fk_user_action: actorIds.final,
    actor_role: 'VALIDATEUR_DEFINITIF',
    has_action_date: 1,
    comment: null,
    fk_user_creat: actorIds.final,
  });
  expect(budgetProjection(flowId)).toBe('1000|1000|9000');
  expect(expenseStageProjection(flowId)).toEqual({
    status: 7,
    prevalidated_amount: '1000.00000000',
    final_validated_amount: '1000.00000000',
    disbursed_amount: '1000.00000000',
    fk_user_prevalidated: actorIds.verifier,
    fk_user_final_valid: actorIds.final,
    fk_user_valid: actorIds.final,
    fk_user_disbursed: actorIds.final,
    has_prevalidation_date: 1,
    has_final_validation_date: 1,
    has_validation_date: 1,
    disbursement_date: '2026-07-29',
    beneficiary_name: 'Bénéficiaire exact Phase 2',
    correction_reason: null,
    fk_user_creat: actorIds.agent,
    fk_user_modif: actorIds.final,
  });
  replay = await postExpense(page, flowId, {
    action: 'disburse', expected_status: '6', beneficiary_name: 'Bénéficiaire exact Phase 2', disbursement_date: '2026-07-29',
  });
  expect(replay.status()).toBe(403);
  expect(await replay.text()).toContain('a déjà été traitée');
  expect(Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'disbursed'`))).toBe(1);

  const rejectId = phase2DecisionIds['P2DEC-E2E-REJECT'];
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${rejectId}`);
  await page.getByRole('link', { name: 'Rejeter la dépense' }).click();
  await page.getByLabel('Motif de rejet').fill('Rejet exact Phase 2');
  await page.getByRole('button', { name: 'Rejeter la dépense' }).click();
  await expect(page.getByText('Rejetée').first()).toBeVisible();
  expect(validationEventProjection(rejectId, 'rejected')).toEqual({
    action: 'rejected',
    from_status: 'submitted',
    to_status: 'rejected',
    fk_user_action: actorIds.verifier,
    actor_role: 'AGENT_VERIFICATEUR',
    has_action_date: 1,
    comment: 'Rejet exact Phase 2',
    fk_user_creat: actorIds.verifier,
  });
  expect(expenseStageProjection(rejectId)).toEqual({
    status: 8,
    prevalidated_amount: null,
    final_validated_amount: null,
    disbursed_amount: null,
    fk_user_prevalidated: null,
    fk_user_final_valid: null,
    fk_user_valid: null,
    fk_user_disbursed: null,
    has_prevalidation_date: 0,
    has_final_validation_date: 0,
    has_validation_date: 0,
    disbursement_date: null,
    beneficiary_name: null,
    correction_reason: 'Rejet exact Phase 2',
    fk_user_creat: actorIds.agent,
    fk_user_modif: actorIds.verifier,
  });
  expect(budgetProjection(rejectId)).toBe('0|0|10000');
  replay = await postExpense(page, rejectId, {
    action: 'reject', expected_status: '1', comment: 'Rejet exact Phase 2',
  });
  expect(replay.status()).toBe(403);
  expect(await replay.text()).toContain('a déjà été traitée');
  expect(Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${rejectId} AND action = 'rejected'`))).toBe(1);
});

test('invalid CSRF and near-simultaneous clients cannot duplicate a final decision', async ({ browser, page }) => {
  const expenseId = phase2DecisionIds['P2DEC-E2E-RACE'];
  const agentId = Number(dockerScalar("SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1"));
  const verifierId = Number(dockerScalar("SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' AND entity = 1 LIMIT 1"));
  const finalId = Number(dockerScalar("SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' AND entity = 1 LIMIT 1"));
  const beforeExpense = expenseProjection(expenseId);
  const beforeBudget = budgetProjection(expenseId);
  const beforeEvents = Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${expenseId}`));
  await login(page, 'dpaf.mjl');
  const invalid = await page.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, {
    form: { token: 'invalid', action: 'final_validate', id: String(expenseId), expected_status: '4', final_validated_amount: '1000', comment: 'Concurrence Phase 2' },
    maxRedirects: 0,
  });
  expect(invalid.status()).toBe(403);
  expect(expenseProjection(expenseId)).toBe(beforeExpense);
  expect(budgetProjection(expenseId)).toBe(beforeBudget);
  expect(Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${expenseId}`))).toBe(beforeEvents);

  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();
  await login(firstPage, 'dpaf.mjl');
  await login(secondPage, 'dpaf.mjl');
  const firstToken = await expenseToken(firstPage, expenseId);
  const secondToken = await expenseToken(secondPage, expenseId);
  const payload = { action: 'final_validate', id: String(expenseId), expected_status: '4', final_validated_amount: '1000', comment: 'Concurrence Phase 2' };
  const responses = await Promise.all([
    firstPage.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, { form: { token: firstToken, ...payload }, maxRedirects: 0 }),
    secondPage.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, { form: { token: secondToken, ...payload }, maxRedirects: 0 }),
  ]);
  const statuses = responses.map((response) => response.status());
  expect(statuses.every((status) => status === 302 || status === 403)).toBe(true);
  expect(statuses).toContain(302);
  expect(Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${expenseId} AND action = 'final_validated'`))).toBe(1);
  expect(validationEventProjection(expenseId, 'final_validated')).toEqual({
    action: 'final_validated',
    from_status: 'prevalidated',
    to_status: 'final_validated',
    fk_user_action: finalId,
    actor_role: 'VALIDATEUR_DEFINITIF',
    has_action_date: 1,
    comment: 'Concurrence Phase 2',
    fk_user_creat: finalId,
  });
  expect(expenseStageProjection(expenseId)).toEqual({
    status: 6,
    prevalidated_amount: '1000.00000000',
    final_validated_amount: '1000.00000000',
    disbursed_amount: null,
    fk_user_prevalidated: verifierId,
    fk_user_final_valid: finalId,
    fk_user_valid: finalId,
    fk_user_disbursed: null,
    has_prevalidation_date: 1,
    has_final_validation_date: 1,
    has_validation_date: 1,
    disbursement_date: null,
    beneficiary_name: null,
    correction_reason: null,
    fk_user_creat: agentId,
    fk_user_modif: finalId,
  });
  expect(budgetProjection(expenseId)).toBe('1000|0|9000');
  await firstContext.close();
  await secondContext.close();
});

test('Phase 2 seam proves all four no-self decisions through UI and direct POST', async ({ page }) => {
  const selfReviewId = phase2DecisionIds['P2DEC-E2E-SELF-REVIEW'];
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfReviewId}`);
  await expect(page.getByRole('link', { name: 'Prévalider la dépense' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Rejeter la dépense' })).toHaveCount(0);
  for (const payload of [
    { action: 'prevalidate', expected_status: '1', prevalidated_amount: '700', comment: 'Auto prévalidation Phase 2' },
    { action: 'reject', expected_status: '1', comment: 'Auto rejet Phase 2' },
  ]) {
    const beforeExpense = expenseProjection(selfReviewId);
    const beforeBudget = budgetProjection(selfReviewId);
    const beforeEvents = Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${selfReviewId}`));
    const response = await postExpense(page, selfReviewId, payload);
    expect(response.status()).toBe(403);
    expect(expenseProjection(selfReviewId)).toBe(beforeExpense);
    expect(budgetProjection(selfReviewId)).toBe(beforeBudget);
    expect(Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${selfReviewId}`))).toBe(beforeEvents);
  }

  await login(page, 'dpaf.mjl');
  for (const scenario of [
    {
      id: phase2DecisionIds['P2DEC-E2E-SELF-FINAL'],
      link: 'Valider définitivement la dépense',
      payload: { action: 'final_validate', expected_status: '4', final_validated_amount: '600', comment: 'Auto validation Phase 2' },
    },
    {
      id: phase2DecisionIds['P2DEC-E2E-SELF-DISB'],
      link: 'Enregistrer le décaissement',
      payload: { action: 'disburse', expected_status: '6', beneficiary_name: 'Auto bénéficiaire Phase 2', disbursement_date: '2026-07-29' },
    },
  ]) {
    await page.goto(`/custom/mjlfinancement/expenses.php?id=${scenario.id}`);
    await expect(page.getByRole('link', { name: scenario.link })).toHaveCount(0);
    const beforeExpense = expenseProjection(scenario.id);
    const beforeBudget = budgetProjection(scenario.id);
    const beforeEvents = Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${scenario.id}`));
    const response = await postExpense(page, scenario.id, scenario.payload);
    expect(response.status()).toBe(403);
    expect(expenseProjection(scenario.id)).toBe(beforeExpense);
    expect(budgetProjection(scenario.id)).toBe(beforeBudget);
    expect(Number(dockerScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${scenario.id}`))).toBe(beforeEvents);
  }
});
