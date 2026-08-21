const { test, expect } = require('@playwright/test');
const { execFileSync, spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { sql, scalar, registerSecret } = require('../helpers/mjl-test-runtime');

const adminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
const testPassword = process.env.MJL_TEST_USER_PASSWORD;
const invitationPassword = process.env.MJL_AUTH_PASSWORD_1;
const resetPassword = process.env.MJL_AUTH_PASSWORD_2;
const repositoryRoot = path.resolve(__dirname, '../..');
let phase1Fixture;
let crossEntityFixture;

test.describe.configure({ mode: 'serial' });

function databaseEvidence() {
  return JSON.parse(execFileSync('docker', [
    'compose', 'exec', '-T', '--user', 'www-data', 'dolibarr',
    'php', '/opt/mjl-tests/fixtures/database-evidence.php',
  ], { env: process.env, encoding: 'utf8', input: '', stdio: ['pipe', 'pipe', 'pipe'] }));
}

function securityEvidence() {
  const evidence = databaseEvidence();
  return {
    database: evidence.database_sha256,
    admin: evidence.admin_sha256,
    ecm: evidence.ecm_sha256,
    documents: evidence.documents_sha256,
    activities: evidence.table_counts.llx_mjlfinancement_activity,
    audit: evidence.table_counts.llx_mjlfinancement_audit_event,
  };
}

async function activityProjection(page, suffix = '') {
  const response = await page.goto(`/custom/mjlfinancement/activities.php${suffix}`);
  return {
    status: response.status(),
    rows: await page.locator('table tr.oddeven').evaluateAll((rows) => rows.map((row) => (
      Array.from(row.cells, (cell) => (cell.textContent || '').trim())
    ))),
  };
}

async function registerLinkSecrets(link) {
  const url = new URL(link, process.env.MJL_BASE_URL);
  const selector = url.searchParams.get('selector') || url.searchParams.get('mjlselector');
  const verifier = url.hash.slice('#verifier='.length);
  await registerSecret('auth selector', selector);
  await registerSecret('auth verifier', verifier);
  await registerSecret('auth token hash', crypto.createHash('sha256').update(verifier).digest('hex'));
}

function outbox(type) {
  const payload = execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'cat', '/var/www/documents/mjlfinancement/email-test-outbox/latest-' + type + '.json'], { encoding: 'utf8', env: process.env });
  return JSON.parse(payload);
}

async function login(page, loginName, loginPassword = loginName === 'admin' ? adminPassword : testPassword) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
	await page.getByLabel('Mot de passe').fill(loginPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

test.beforeAll(() => {
  const includesRst013a = ['all', 'rst013a', 'rst014a', 'phase1-reset', 'e2e'].includes(process.env.MJL_TEST_MODE);
  phase1Fixture = createPhase1FixtureSet({
    namespace: 'phase1.e2e', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
      { key: 'norole', role: null },
    ],
    references: includesRst013a ? {
      partners: [{ key: 'partner', label: 'Partenaire Phase 1' }],
      projects: [{ key: 'project', label: 'Projet Phase 1', partnerKey: 'partner' }],
      operationTypes: [],
    } : { partners: [], projects: [], operationTypes: [] },
  });
  if (includesRst013a) {
    crossEntityFixture = createPhase1FixtureSet({
      namespace: 'phase1.cross', entity: 2,
      users: [{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
      references: {
        partners: [{ key: 'partner', label: 'Partenaire autre entité' }],
        projects: [{ key: 'project', label: 'Projet autre entité', partnerKey: 'partner' }],
        operationTypes: [],
      },
    });
    sql(`SET FOREIGN_KEY_CHECKS=0;
    START TRANSACTION;
    INSERT INTO llx_mjlfinancement_activity
    (entity,ref,label,fk_project,date_start,date_end,fk_user_responsible,date_actual_start,date_actual_end,
     physical_execution_percent,execution_status,execution_comment,note_public,note_private,date_creation,fk_user_creat,status)
    VALUES
    (1,'RST013-SAFE','Activité visible RST-013A',${phase1Fixture.projects.project},'2031-01-02','2031-03-04',${phase1Fixture.users.agent.id},'2031-01-03','2031-03-05',73,'RST013_CANARY_EXECUTION_STATUS','RST013_CANARY_EXECUTION_COMMENT','RST013_CANARY_NOTE_PUBLIC','RST013_CANARY_NOTE_PRIVATE',NOW(),${phase1Fixture.users.validator.id},7),
    (2,'RST013-OTHER-ENTITY','RST013_CANARY_OTHER_ENTITY',${crossEntityFixture.projects.project},NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NOW(),${crossEntityFixture.users.validator.id},4),
    (1,'RST013-CROSS-PARENT','RST013_CANARY_CROSS_PARENT',${crossEntityFixture.projects.project},NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NOW(),${phase1Fixture.users.validator.id},5),
    (1,'RST013-ORPHAN','RST013_CANARY_ORPHAN_PARENT',2147483000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NOW(),${phase1Fixture.users.validator.id},6);
    COMMIT;
    SET FOREIGN_KEY_CHECKS=1;`);
  }
  sql("INSERT INTO llx_const (name,entity,value,type,visible,note) VALUES ('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'Phase 1 disposable E2E') ON DUPLICATE KEY UPDATE value='1'");
});

test('[RST-013A] current Activity authorization ignores poisoned legacy scope and preserves exact safe projection', async ({ browser }) => {
  test.setTimeout(180000);
  const roles = ['agent', 'supervisor', 'validator'];
  const sessions = {};
  const baseline = {};
  for (const role of roles) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, `phase1.e2e.${role}`);
    sessions[role] = { context, page };
  }

  const expectedProject = scalar(`SELECT CONCAT(ref,' — ',title) FROM llx_projet WHERE rowid=${phase1Fixture.projects.project}`);
  const expectedReviewerProjection = {
    status: 200,
    rows: [['RST013-SAFE', 'Activité visible RST-013A', expectedProject, '7']],
  };
  const zeroScopeBefore = securityEvidence();
  for (const role of roles) {
    const page = sessions[role].page;
    baseline[role] = await activityProjection(page);
    expect(await activityProjection(page, `?scope_soc_ids%5B%5D=${crossEntityFixture.partners.partner}`)).toEqual(baseline[role]);
  }

  expect(baseline.agent).toEqual({ status: 403, rows: [] });
  expect(baseline.supervisor).toEqual(expectedReviewerProjection);
  expect(baseline.validator).toEqual(expectedReviewerProjection);
  expect(securityEvidence()).toEqual(zeroScopeBefore);

  const poisonValues = roles.map((role) => `
    (1,${phase1Fixture.users[role].id},${phase1Fixture.partners.partner},1,NOW(),'RST013 poisoned scope',NOW(),${phase1Fixture.users.validator.id})`).join(',');
  sql(`INSERT INTO llx_mjlfinancement_user_soc_scope
    (entity,fk_user,fk_soc,is_active,date_start,source,date_creation,fk_user_creat)
    VALUES ${poisonValues}`);

  const poisonedScopeBefore = securityEvidence();
  for (const role of roles) {
    expect(await activityProjection(sessions[role].page)).toEqual(baseline[role]);
    expect(await activityProjection(sessions[role].page, `?scope_soc_ids%5B%5D=${crossEntityFixture.partners.partner}`)).toEqual(baseline[role]);
  }
  for (const role of ['supervisor', 'validator']) {
    const page = sessions[role].page;
    const html = await page.locator('body').innerText();
    for (const canary of [
      'RST013_CANARY_EXECUTION_STATUS', 'RST013_CANARY_EXECUTION_COMMENT',
      'RST013_CANARY_NOTE_PUBLIC', 'RST013_CANARY_NOTE_PRIVATE',
      'RST013_CANARY_OTHER_ENTITY', 'RST013_CANARY_CROSS_PARENT', 'RST013_CANARY_ORPHAN_PARENT',
      '2031-01-02', '2031-03-04', '2031-01-03', '2031-03-05',
    ]) expect(html).not.toContain(canary);
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
  }
  expect(securityEvidence()).toEqual(poisonedScopeBefore);

  const denialBefore = securityEvidence();
  for (const role of ['supervisor', 'validator']) {
    const hostilePost = await sessions[role].page.request.post('/custom/mjlfinancement/activities.php', {
      form: { 'scope_soc_ids[]': String(crossEntityFixture.partners.partner), action: 'create' },
    });
    expect(hostilePost.status()).toBe(403);
  }
  const agentPage = sessions.agent.page;
  expect((await agentPage.request.get('/custom/mjlfinancement/activities.php?scope_soc_ids%5B%5D=1')).status()).toBe(403);
  expect((await agentPage.request.post('/custom/mjlfinancement/activities.php', {
    form: { 'scope_soc_ids[]': String(phase1Fixture.partners.partner), action: 'create' },
  })).status()).toBe(403);

  const classProbe = execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php'], {
    env: process.env,
    encoding: 'utf8',
    input: `<?php
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
$probe = new MjlActivity($db);
$probe->entity = 1;
$probe->ref = 'RST013-MUTATION-PROBE';
$probe->label = 'Mutation interdite';
$probe->fk_project = ${phase1Fixture.projects.project};
$probe->status = 0;
$existing = new MjlActivity($db);
$existing->rowid = ${Number(scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref='RST013-SAFE' AND entity=1"))};
$existing->entity = 1;
$existing->ref = 'RST013-SAFE';
$existing->label = 'Activité visible RST-013A';
$existing->fk_project = ${phase1Fixture.projects.project};
$existing->status = 7;
$methods = ['updateImportantFields','updateExecution','submit','correct','prevalidate','finalValidate','validate','requestCorrection','reject'];
$result = ['create' => [], 'update' => [], 'delete' => [], 'retired' => []];
foreach ([0, 1] as $notrigger) {
    $result['create'][] = $probe->create($user, $notrigger);
    $result['update'][] = $existing->update($user, $notrigger);
    $result['delete'][] = $existing->delete($user, $notrigger);
}
foreach ($methods as $method) $result['retired'][$method] = method_exists($probe, $method);
echo json_encode($result, JSON_THROW_ON_ERROR);`,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  expect(JSON.parse(classProbe)).toEqual({
    create: [-1, -1], update: [-1, -1], delete: [-1, -1],
    retired: {
      updateImportantFields: false, updateExecution: false, submit: false, correct: false,
      prevalidate: false, finalValidate: false, validate: false, requestCorrection: false, reject: false,
    },
  });
  expect(securityEvidence()).toEqual(denialBefore);
  for (const { context } of Object.values(sessions)) await context.close();
});

async function runRst013aSignalProbe(signal) {
  const injectedSecret = `rst013a-lifecycle-${crypto.randomBytes(16).toString('hex')}`;
  await registerSecret('injected lifecycle secret', injectedSecret);
  const child = spawn(process.execPath, ['tests/runner/run-suite.js', 'rst013a-lifecycle-probe'], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      MJL_TEST_RETAIN: '1',
      MJL_RST013A_PROBE_OUTCOME: 'signal',
      MJL_RST013A_INJECT_SECRET: injectedSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let spawnError = null;
  let project = null;
  let childClosed = false;
  let childOutcome = null;
  let preFallbackArtifactExists = null;
  let preFallbackResources = null;
  let postFallbackResources = null;
  let executionError = null;
  const cleanupErrors = [];
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.once('error', (error) => { spawnError = error; });
  child.once('close', (code, closeSignal) => {
    childClosed = true;
    childOutcome = { code, signal: closeSignal };
  });

  const projectResources = (projectName) => {
    const filter = `label=com.docker.compose.project=${projectName}`;
    const list = (args, format) => execFileSync('docker', [...args, '--filter', filter, '--format', format], { encoding: 'utf8' })
      .split('\n').map((entry) => entry.trim()).filter(Boolean);
    return {
      containers: list(['ps', '-a'], '{{.Names}}'),
      networks: list(['network', 'ls'], '{{.Name}}'),
      volumes: list(['volume', 'ls'], '{{.Name}}'),
    };
  };

  const waitForClose = (timeoutMs) => {
    if (childClosed) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('RST-013A lifecycle cleanup timed out.')), timeoutMs);
      child.once('close', () => { clearTimeout(timer); resolve(); });
    });
  };
  const stopChild = async () => {
    if (childClosed) return;
    child.kill('SIGTERM');
    try {
      await waitForClose(5000);
    } catch (_) {
      child.kill('SIGKILL');
      await waitForClose(5000);
    }
  };

  try {
    const deadline = Date.now() + 90000;
    while (!output.includes('RST-013A lifecycle probe ready.')) {
      if (spawnError) throw spawnError;
      if (childClosed) throw new Error(`RST-013A lifecycle probe exited before readiness: ${output}`);
      if (Date.now() > deadline) throw new Error('RST-013A lifecycle probe readiness timed out.');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    project = output.match(/Disposable MJL project: (mjl-test-[^\n]+)/)?.[1] || null;
    expect(project).toBeTruthy();
    child.kill(signal);
    await new Promise((resolve) => setTimeout(resolve, 250));
    child.kill(signal);
    await waitForClose(130000);
    preFallbackArtifactExists = fs.existsSync(path.join(repositoryRoot, 'test-results', 'runs', project));
    preFallbackResources = projectResources(project);
  } catch (error) {
    executionError = error;
  } finally {
    project ||= output.match(/Disposable MJL project: (mjl-test-[^\n]+)/)?.[1] || null;
    try {
      await stopChild();
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (project) {
      const artifactRoot = path.join(repositoryRoot, 'test-results', 'runs', project);
      const cleanupEnvironment = {
        ...process.env,
        COMPOSE_PROJECT_NAME: project,
        MJL_REPOSITORY_ROOT: repositoryRoot,
        MJL_EVIDENCE_ROOT: artifactRoot,
        MJL_BASE_URL: 'http://127.0.0.1:1',
        MJL_TEST_PORT: '1',
        MJL_DISPOSABLE_RUN_SENTINEL: '00000000000000000000000000000000',
        MJL_TEST_USER_PASSWORD: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      };
      let teardownError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          execFileSync('docker', [
            'compose', '-p', project,
            '-f', path.join(repositoryRoot, 'docker-compose.yml'),
            '-f', path.join(repositoryRoot, 'tests/fixtures/disposable-compose.override.yml'),
            'down', '-v', '--remove-orphans',
          ], { cwd: repositoryRoot, env: cleanupEnvironment, stdio: ['ignore', 'pipe', 'pipe'] });
          teardownError = null;
          break;
        } catch (error) {
          teardownError = error;
        }
      }
      if (teardownError) cleanupErrors.push(teardownError);
      try {
        fs.rmSync(artifactRoot, { recursive: true, force: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
      try {
        postFallbackResources = projectResources(project);
        if (Object.values(postFallbackResources).some((entries) => entries.length > 0)) {
          cleanupErrors.push(new Error('RST-013A lifecycle fallback left disposable resources.'));
        }
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }

  if (executionError || cleanupErrors.length > 0) {
    throw new AggregateError([...(executionError ? [executionError] : []), ...cleanupErrors], 'RST-013A lifecycle probe or fallback cleanup failed.');
  }
  expect(project).toBeTruthy();
  expect(childOutcome).toEqual({ code: 1, signal: null });
  expect(output).toContain('Contaminated artifacts were removed');
  expect(output).not.toContain(injectedSecret);
  expect(preFallbackArtifactExists).toBe(false);
  expect(preFallbackResources).toEqual({ containers: [], networks: [], volumes: [] });
  expect(fs.existsSync(path.join(repositoryRoot, 'test-results', 'runs', project))).toBe(false);
  expect(postFallbackResources).toEqual({ containers: [], networks: [], volumes: [] });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`[RST-013A] repeated ${signal} tears down the real disposable runner`, async () => {
    test.skip(process.env.MJL_TEST_MODE !== 'rst013a', 'Executed by the focused RST-013A proof mode.');
    test.setTimeout(180000);
    await runRst013aSignalProbe(signal);
  });
}

test('[RST-007A] audit events are immutable and entity-filtered', async ({ page }) => {
  sql("INSERT INTO llx_mjlfinancement_audit_event (entity,object_type,actor_name_snapshot,actor_role_snapshot,event_date,action,result,date_creation) VALUES (1,'phase1_test','Phase 1','SYSTEM',NOW(),'phase1.visible','SUCCESS',NOW()),(2,'phase1_test','Phase 1','SYSTEM',NOW(),'phase1.hidden','SUCCESS',NOW())");
  expect(() => sql("UPDATE llx_mjlfinancement_audit_event SET action='phase1.tampered' WHERE action='phase1.visible'")).toThrow();
  expect(() => sql("DELETE FROM llx_mjlfinancement_audit_event WHERE action='phase1.visible'")).toThrow();
  await login(page, 'phase1.e2e.validator');
  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.locator('body')).toContainText('phase1.visible');
  await expect(page.locator('body')).not.toContainText('phase1.hidden');
});

test('[RST-009A] business navigation is projected from the active role and direct guards agree', async ({ page }) => {
  await login(page, 'phase1.e2e.agent');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('link', { name: 'Partenaires' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Audit' })).toHaveCount(0);
  let response = await page.goto('/custom/mjlfinancement/workflowactions.php');
  expect(response.status()).toBeGreaterThanOrEqual(400);

  await login(page, 'phase1.e2e.validator');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('link', { name: 'Audit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Utilisateurs et accès' })).toHaveCount(0);
  response = await page.goto('/custom/mjlfinancement/admin/access.php');
  expect(response.status()).toBeGreaterThanOrEqual(400);

  await login(page, 'phase1.e2e.supervisor');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('link', { name: 'Partenaires' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Audit' })).toHaveCount(0);
  response = await page.goto('/custom/mjlfinancement/activities.php');
  expect(response.status()).toBe(200);
  response = await page.goto('/custom/mjlfinancement/activities.php?action=create');
  expect(response.status()).toBe(403);
});

test('[RST-009A] native Admin sees only the approved technical controls', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('link', { name: 'Audit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Utilisateurs et accès' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Partenaires' })).toHaveCount(0);
  const technical = page.getByRole('link', { name: 'Administration technique' });
  await expect(technical).toBeVisible();
  const response = await page.request.get(await technical.getAttribute('href'));
  expect(response.status()).toBe(200);
  const technicalHtml = await response.text();
  expect(technicalHtml).toContain('page-modules');
  expect(technicalHtml).toContain('info-box-module');
  const denied = await page.request.get('/admin/company.php');
  expect(denied.status()).toBe(403);
  expect(await denied.text()).not.toContain('Call to undefined function');
});

test('[RST-004] role-less users and obsolete routes fail closed', async ({ page }) => {
  await login(page, 'phase1.e2e.norole');
  let response = await page.goto('/custom/mjlfinancement/index.php');
  expect(response.status()).toBeGreaterThanOrEqual(400);
  response = await page.goto('/custom/mjlfinancement/expenses.php');
  expect(response.status()).toBe(404);
});

test('[RST-008] invitation and reset credentials enforce lifecycle invalidation and immediate access changes', async ({ page, browser }) => {
	test.setTimeout(120000);
  await login(page, 'admin');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.getByLabel('Identifiant').fill('phase1.e2e.invited');
  await page.getByLabel('Prénom').fill('Invitée');
	await page.getByLabel('Nom', { exact: true }).fill('Phase1');
  await page.getByLabel('Email').fill('phase1.invited@example.test');
  await page.getByLabel('Profil de production').selectOption('AGENT_SAISIE');
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  await expect(page.locator('body')).toContainText('Invitation envoyée');
  let invitationLink = await page.locator('code').innerText();
  await registerLinkSecrets(invitationLink);
  expect(invitationLink).toMatch(/\?selector=[a-f0-9]{32}#verifier=/);
  let invitationVerifier = new URL(invitationLink, page.url()).hash.slice('#verifier='.length);
  expect(page.url()).not.toContain(invitationVerifier);

  const userRow = page.locator('tr').filter({ hasText: 'phase1.e2e.invited' }).filter({ has: page.locator('input[value="update_profile"]') });
  await userRow.locator('select[name="role_code"]').selectOption('VALIDATEUR_DEFINITIF');
  await userRow.getByRole('button', { name: 'Enregistrer' }).click();
  expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_invitation i INNER JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='phase1.e2e.invited' ORDER BY i.rowid DESC LIMIT 1")).toBe('revoked:NULL');
  await page.goto(invitationLink);
  await expect(page.locator('body')).toContainText('révoquée');

  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.getByLabel('Identifiant').fill('phase1.e2e.invited');
  await page.getByLabel('Prénom').fill('Invitée');
  await page.getByLabel('Nom', { exact: true }).fill('Phase1');
  await page.getByLabel('Email').fill('phase1.invited@example.test');
  await page.getByLabel('Profil de production').selectOption('AGENT_SAISIE');
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  invitationLink = await page.locator('code').innerText();
  await registerLinkSecrets(invitationLink);
  invitationVerifier = new URL(invitationLink, page.url()).hash.slice('#verifier='.length);

  await page.goto(invitationLink.replace(invitationVerifier, 'invalid-verifier'));
  await page.getByLabel('Mot de passe', { exact: true }).fill(invitationPassword);
  await page.getByLabel('Confirmer le mot de passe').fill(invitationPassword);
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();
  await expect(page.locator('body')).toContainText('invalide ou expirée');

  await page.goto(invitationLink);
  await expect(page).not.toHaveURL(/#verifier=/);
  await expect(page.getByLabel('Code secret de l’invitation')).toHaveValue(invitationVerifier);
  await page.getByLabel('Mot de passe', { exact: true }).fill(invitationPassword);
  await page.getByLabel('Confirmer le mot de passe').fill(invitationPassword);
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();
  await expect(page.locator('body')).toContainText('Votre accès est activé');
  expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_invitation i INNER JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='phase1.e2e.invited' ORDER BY i.rowid DESC LIMIT 1")).toBe('accepted:NULL');

  await page.goto(invitationLink);
  await expect(page.locator('body')).toContainText('déjà été acceptée');
  await login(page, 'phase1.e2e.invited', invitationPassword);

  await page.goto('/user/logout.php');
  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse e-mail').fill('phase1.invited@example.test');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  await expect(page.locator('body')).toContainText('Si un compte correspond');
  const resetLink = outbox('password_reset').link;
  await registerLinkSecrets(resetLink);
  expect(resetLink).toMatch(/mjlselector=[a-f0-9]{32}#verifier=/);
  const resetVerifier = new URL(resetLink).hash.slice('#verifier='.length);
  await page.goto(resetLink);
  await expect(page).not.toHaveURL(/#verifier=/);
  await expect(page.getByLabel('Code secret de réinitialisation')).toHaveValue(resetVerifier);
	await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(resetPassword);
  await page.getByLabel('Confirmer le mot de passe').fill(resetPassword);
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();
  expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_password_reset r INNER JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login='phase1.e2e.invited' ORDER BY r.rowid DESC LIMIT 1")).toBe('consumed:NULL');
  await page.goto(resetLink);
  await expect(page.locator('body')).toContainText('invalide ou expiré');
  await login(page, 'phase1.e2e.invited', resetPassword);

  await page.goto('/user/logout.php');
  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse e-mail').fill('phase1.invited@example.test');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  const expiringResetLink = outbox('password_reset').link;
  await registerLinkSecrets(expiringResetLink);
  sql("UPDATE llx_mjlfinancement_password_reset r INNER JOIN llx_user u ON u.rowid=r.fk_user SET r.date_expiry=DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE u.login='phase1.e2e.invited' AND r.status='sent'");
  await page.goto(expiringResetLink);
  await expect(page.locator('body')).toContainText('invalide ou expiré');

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse e-mail').fill('phase1.invited@example.test');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  const revokedByDeactivationLink = outbox('password_reset').link;
  await registerLinkSecrets(revokedByDeactivationLink);
  await login(page, 'phase1.e2e.invited', resetPassword);
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, 'admin');
  await adminPage.goto('/custom/mjlfinancement/admin/access.php');
  const activeUserRow = adminPage.locator('tr').filter({ hasText: 'phase1.e2e.invited' }).filter({ has: adminPage.locator('input[value="deactivate"]') });
  await activeUserRow.getByRole('button', { name: 'Désactiver' }).click();
  expect(scalar("SELECT CONCAT(u.statut,':',r.status,':',IFNULL(r.token_hash,'NULL')) FROM llx_user u INNER JOIN llx_mjlfinancement_password_reset r ON r.fk_user=u.rowid WHERE u.login='phase1.e2e.invited' ORDER BY r.rowid DESC LIMIT 1")).toBe('0:revoked:NULL');
  const denied = await page.goto('/custom/mjlfinancement/index.php');
  expect([200, 401, 403]).toContain(denied.status());
  await expect(page.locator('.mjl-module-shell')).toHaveCount(0);
  if (denied.status() === 200) await expect(page.getByLabel('Identifiant')).toBeVisible();
  await page.goto(revokedByDeactivationLink);
  await expect(page.locator('body')).toContainText('invalide ou expiré');
  await adminContext.close();
});
