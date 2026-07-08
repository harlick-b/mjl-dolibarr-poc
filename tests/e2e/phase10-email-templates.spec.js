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

function scalar(query) {
  return execSync(`docker compose exec -T mariadb mariadb -N -B -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

function e2eConst(name) {
  return scalar(`SELECT COALESCE(MAX(value), '') FROM llx_const WHERE name = '${name}' AND entity = 1`);
}

function latestLink(type) {
  return e2eConst(`MJL_AUTH_E2E_LAST_${type.toUpperCase()}_LINK`);
}

function outboxMessages() {
  const raw = execSync("docker compose exec -T dolibarr sh -lc 'cat /var/www/documents/mjlfinancement/email-test-outbox/emails.jsonl 2>/dev/null || true'", { encoding: 'utf8' });
  return raw.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function login(page, username, userPassword = password) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(userPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

async function inviteUser(page, suffix) {
  const loginName = `mjl.phase10.${suffix}`;
  const email = `${loginName}@mjl-poc.local`;

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.locator('#mjl-login').fill(loginName);
  await page.locator('#mjl-firstname').fill('Phase10');
  await page.locator('#mjl-lastname').fill('Email');
  await page.locator('#mjl-email').fill(email);
  const firstScope = await page.locator('select[name="scope_soc_ids[]"] option').first().getAttribute('value');
  await page.locator('select[name="scope_soc_ids[]"]').first().selectOption(firstScope);
  await page.getByRole('button', { name: 'Envoyer l invitation' }).click();
  await expect(page.getByText('Invitation envoyee')).toBeVisible();

  return { loginName, email, invitationLink: latestLink('invitation') };
}

function cleanupPhase10() {
  sql(`
    SET @phase10_users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'mjl.phase10.%');
    SET @phase10_activity_ids = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P10-%');
    DELETE FROM llx_const WHERE entity = 1 AND (name LIKE 'MJL_AUTH_E2E_%' OR name LIKE 'MJL_EMAIL_E2E_%');
    DELETE FROM llx_mjlfinancement_access_audit WHERE context LIKE '%template=%' OR context LIKE '%P10-%' OR FIND_IN_SET(fk_user, COALESCE(@phase10_users, '')) OR FIND_IN_SET(fk_actor, COALESCE(@phase10_users, ''));
    DELETE FROM llx_mjlfinancement_invitation WHERE FIND_IN_SET(fk_user, COALESCE(@phase10_users, ''));
    DELETE FROM llx_mjlfinancement_password_reset WHERE FIND_IN_SET(fk_user, COALESCE(@phase10_users, ''));
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@phase10_activity_ids, ''));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P10-%';
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@phase10_users, ''));
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE FIND_IN_SET(fk_user, COALESCE(@phase10_users, ''));
    DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user, COALESCE(@phase10_users, ''));
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@phase10_users, ''));
  `);
  dockerExec("dolibarr sh -lc 'rm -rf /var/www/documents/mjlfinancement/email-test-outbox /var/www/documents/mjlfinancement/auth-test-outbox'");
}

function enableE2eMail() {
  sql("INSERT INTO llx_const (name, entity, value, type, visible, note) VALUES ('MJL_AUTH_E2E_EXPOSE_TOKENS', 1, '1', 'chaine', 0, 'Phase 10 E2E')");
}

function seedWorkflowFixtures() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @validator = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' LIMIT 1);
    SET @validator_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Superviseur N1' AND entity = 1 LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);

    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase10.validatorclone', 'Clone', 'Validator', email, pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE rowid = @validator LIMIT 1;
    SET @clone = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @clone, @validator_group);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P10-SUBMIT', 'Activite Phase 10 soumission', @project, @convention, '2026-06-20', '2026-06-30', NOW(), @agent, 'P10SUBMIT', 0),
      (1, 'P10-CORRECTION', 'Activite Phase 10 correction', @project, @convention, '2026-06-20', '2026-06-30', NOW(), @agent, 'P10CORR', 3),
      (1, 'P10-VALIDATE', 'Activite Phase 10 validation', @project, @convention, '2026-06-20', '2026-06-30', NOW(), @agent, 'P10VALID', 3),
      (1, 'P10-REJECT', 'Activite Phase 10 rejet', @project, @convention, '2026-06-20', '2026-06-30', NOW(), @agent, 'P10REJECT', 3);
  `);
}

function activityId(ref) {
  return Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = '${ref}' AND entity = 1 LIMIT 1`));
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase10();
  enableE2eMail();
  seedWorkflowFixtures();
});

test.afterAll(() => {
  cleanupPhase10();
});

test('invitation and password reset emails use MJL templates and keep auth flows working', async ({ page }) => {
  const invited = await inviteUser(page, `invite.${Date.now()}`);

  expect(e2eConst('MJL_EMAIL_E2E_LAST_INVITATION_SUBJECT')).toBe('[MJL Financement] Invitation a votre espace');
  const invitationBody = e2eConst('MJL_EMAIL_E2E_LAST_INVITATION_BODY');
  expect(invitationBody).toContain('Invitation a votre espace MJL');
  expect(invitationBody).toContain('Definir mon mot de passe');
  expect(invitationBody).toContain('/custom/mjlfinancement/invitation.php?invite=');

  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('MjlPhase10Invite2026!!');
  await page.locator('#newpass2').fill('MjlPhase10Invite2026!!');
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();
  await expect(page.getByText('Votre acces est active')).toBeVisible();

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill(invited.email);
  await page.getByRole('button', { name: 'Reinitialiser le mot de passe' }).click();
  await expect(page.getByText('Si un compte correspond a cette adresse')).toBeVisible();

  expect(e2eConst('MJL_EMAIL_E2E_LAST_PASSWORD_RESET_SUBJECT')).toBe('[MJL Financement] Reinitialisation du mot de passe');
  const resetBody = e2eConst('MJL_EMAIL_E2E_LAST_PASSWORD_RESET_BODY');
  expect(resetBody).toContain('Reinitialisation du mot de passe');
  expect(resetBody).toContain('Si vous n avez pas fait cette demande');
  expect(resetBody).toContain('/user/passwordforgotten.php?setnewpassword=1&mjlreset=');

  await page.goto(latestLink('password_reset'));
  await page.locator('#newpass1').fill('MjlPhase10Reset2026!!');
  await page.locator('#newpass2').fill('MjlPhase10Reset2026!!');
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();
  await expect(page.getByText('Votre mot de passe a ete mis a jour')).toBeVisible();

  await login(page, invited.loginName, 'MjlPhase10Reset2026!!');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
});

test('activity submission notifies validators once per email address', async ({ page }) => {
  const id = activityId('P10-SUBMIT');
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${id}`);
  await page.getByLabel('Commentaire de soumission').fill('Soumission Phase 10');
  await page.getByRole('button', { name: 'Soumettre l activite' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();

  const submitted = outboxMessages().filter((message) => message.template === 'activity_submitted' && message.body.includes('P10-SUBMIT'));
  expect(submitted.length).toBeGreaterThan(0);
  expect(submitted[0].subject).toBe('[MJL Financement] Activite a examiner: P10-SUBMIT');
  expect(submitted[0].body).toContain('Une activite liee a un projet a financement exterieur attend une decision.');
  expect(submitted[0].body).toContain('Soumission Phase 10');
  const recipientEmails = submitted.map((message) => message.to.toLowerCase());
  expect(new Set(recipientEmails).size).toBe(recipientEmails.length);
});

test('correction, prevalidation, final validation, and rejection notify expected users', async ({ page }) => {
  await login(page, 'superviseur.n1');

  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId('P10-CORRECTION')}`);
  await page.getByLabel('Motif de correction').fill('Motif correction Phase 10');
  await page.getByRole('button', { name: 'Retourner pour correction' }).click();
  await expect(page.getByText('Correction demandee', { exact: true }).first()).toBeVisible();

  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId('P10-VALIDATE')}`);
  await page.getByLabel('Commentaire de prevalidation').fill('Prevalidation Phase 10');
  await page.getByRole('button', { name: 'Prevalider l activite' }).click();
  await expect(page.getByText('Prevalidee').first()).toBeVisible();

  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId('P10-REJECT')}`);
  await page.getByLabel('Motif de rejet').fill('Rejet Phase 10');
  await page.getByRole('button', { name: 'Rejeter l activite' }).click();
  await expect(page.getByText('Rejetee').first()).toBeVisible();

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId('P10-VALIDATE')}`);
  await page.getByLabel('Commentaire de validation definitive').fill('Validation definitive Phase 10');
  await page.getByRole('button', { name: 'Validation definitive' }).click();
  await expect(page.getByText('Validee definitivement').first()).toBeVisible();

  const messages = outboxMessages();
  expect(messages.find((message) => message.template === 'activity_correction_requested' && message.body.includes('P10-CORRECTION')).body).toContain('Motif correction Phase 10');
  expect(messages.find((message) => message.template === 'activity_prevalidated' && message.body.includes('P10-VALIDATE')).body).toContain('Prevalidation Phase 10');
  expect(messages.find((message) => message.template === 'activity_validated' && message.body.includes('P10-VALIDATE')).body).toContain('Validation definitive Phase 10');
  expect(messages.find((message) => message.template === 'activity_rejected' && message.body.includes('P10-REJECT')).body).toContain('Rejet Phase 10');
});

test('notrigger workflow calls do not send workflow emails', async () => {
  const before = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_access_audit WHERE context LIKE '%template=activity_%'"));
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php');
  const after = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_access_audit WHERE context LIKE '%template=activity_%'"));
  expect(after).toBe(before);
});

test('alert templates render but scheduled alert sending is absent', async () => {
  const rendered = execSync(`docker compose exec -T dolibarr php -r "define('NOLOGIN', 1); require '/var/www/html/main.inc.php'; require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_email.lib.php'; print json_encode(array(mjl_email_render('alert_deadline_approaching', array('activity_ref' => 'P10-ALERT')), mjl_email_render('alert_overdue_activity', array('activity_ref' => 'P10-ALERT'))));"`, { encoding: 'utf8' });
  const alerts = JSON.parse(rendered);
  expect(alerts[0].subject).toBe('[MJL Financement] Echeance proche: P10-ALERT');
  expect(alerts[1].subject).toBe('[MJL Financement] Activite en retard: P10-ALERT');
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_access_audit WHERE context LIKE '%template=alert_%'"))).toBe(0);
});
