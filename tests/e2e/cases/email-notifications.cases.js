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
  const loginName = `mjl.email_notification.${suffix}`;
  const email = `${loginName}@mjl-poc.local`;

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.locator('#mjl-login').fill(loginName);
  await page.locator('#mjl-firstname').fill('EmailNotification');
  await page.locator('#mjl-lastname').fill('Email');
  await page.locator('#mjl-email').fill(email);
  const firstScope = await page.locator('select[name="scope_soc_ids[]"] option').first().getAttribute('value');
  await page.locator('select[name="scope_soc_ids[]"]').first().selectOption(firstScope);
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();

  return { loginName, email, invitationLink: latestLink('invitation') };
}

function cleanupEmailNotification() {
  sql(`
    SET @email_notification_users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'mjl.email_notification.%');
    SET @email_notification_activity_ids = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'EML-%');
    DELETE FROM llx_const WHERE entity = 1 AND (name LIKE 'MJL_AUTH_E2E_%' OR name LIKE 'MJL_EMAIL_E2E_%');
    DELETE FROM llx_mjlfinancement_access_audit WHERE context LIKE '%template=%' OR context LIKE '%EML-%' OR FIND_IN_SET(fk_user, COALESCE(@email_notification_users, '')) OR FIND_IN_SET(fk_actor, COALESCE(@email_notification_users, ''));
    DELETE FROM llx_mjlfinancement_invitation WHERE FIND_IN_SET(fk_user, COALESCE(@email_notification_users, ''));
    DELETE FROM llx_mjlfinancement_password_reset WHERE FIND_IN_SET(fk_user, COALESCE(@email_notification_users, ''));
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@email_notification_activity_ids, ''));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'EML-%';
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@email_notification_users, ''));
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE FIND_IN_SET(fk_user, COALESCE(@email_notification_users, ''));
    DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user, COALESCE(@email_notification_users, ''));
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@email_notification_users, ''));
  `);
  dockerExec("dolibarr sh -lc 'rm -rf /var/www/documents/mjlfinancement/email-test-outbox /var/www/documents/mjlfinancement/auth-test-outbox'");
}

function enableE2eMail() {
  sql("INSERT INTO llx_const (name, entity, value, type, visible, note) VALUES ('MJL_AUTH_E2E_EXPOSE_TOKENS', 1, '1', 'chaine', 0, 'Email notification E2E')");
}

function seedWorkflowFixtures() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @validator = (SELECT fk_user FROM llx_mjlfinancement_user_role WHERE entity = 1 AND role_code = 'AGENT_VERIFICATEUR' AND is_active = 1 ORDER BY rowid LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);

    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.email_notification.validatorclone', 'Clone', 'Validator', email, pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE rowid = @validator LIMIT 1;
    SET @clone = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup)
    SELECT entity, @clone, fk_usergroup FROM llx_usergroup_user WHERE entity = 1 AND fk_user = @validator;

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'EML-SUBMIT', 'Activite Email notification soumission', @project, @convention, '2026-06-20', '2026-06-30', NOW(), @agent, 'EMLSUBMIT', 0),
      (1, 'EML-CORRECTION', 'Activite Email notification correction', @project, @convention, '2026-06-20', '2026-06-30', NOW(), @agent, 'EMLCORR', 3),
      (1, 'EML-VALIDATE', 'Activite Email notification validation', @project, @convention, '2026-06-20', '2026-06-30', NOW(), @agent, 'EMLVALID', 3),
      (1, 'EML-REJECT', 'Activite Email notification rejet', @project, @convention, '2026-06-20', '2026-06-30', NOW(), @agent, 'DSHEJECT', 3);
  `);
}

function activityId(ref) {
  return Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = '${ref}' AND entity = 1 LIMIT 1`));
}

test.beforeAll(() => {
  cleanupEmailNotification();
  enableE2eMail();
  seedWorkflowFixtures();
});

test.afterAll(() => {
  cleanupEmailNotification();
});

test('invitation and password reset emails contain working single-use links', async ({ page }) => {
  const invited = await inviteUser(page, `invite.${Date.now()}`);

  expect(e2eConst('MJL_EMAIL_E2E_LAST_INVITATION_SUBJECT')).not.toBe('');
  const invitationBody = e2eConst('MJL_EMAIL_E2E_LAST_INVITATION_BODY');
  expect(invitationBody).toContain('/custom/mjlfinancement/invitation.php?invite=');
  expect(invitationBody).not.toContain('fonts.googleapis.com');
  expect(invitationBody).not.toContain('fonts.gstatic.com');
  expect(invitationBody).not.toContain('<link');

  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('MjlEmailNotificationInvite2026!!');
  await page.locator('#newpass2').fill('MjlEmailNotificationInvite2026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse e-mail').fill(invited.email);
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();

  expect(e2eConst('MJL_EMAIL_E2E_LAST_PASSWORD_RESET_SUBJECT')).not.toBe('');
  const resetBody = e2eConst('MJL_EMAIL_E2E_LAST_PASSWORD_RESET_BODY');
  expect(resetBody).toContain('/user/passwordforgotten.php?setnewpassword=1&mjlreset=');
  expect(resetBody).not.toContain('fonts.googleapis.com');
  expect(resetBody).not.toContain('fonts.gstatic.com');
  expect(resetBody).not.toContain('<link');

  await page.goto(latestLink('password_reset'));
  await page.locator('#newpass1').fill('MjlRoleDashboardeset2026!!');
  await page.locator('#newpass2').fill('MjlRoleDashboardeset2026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();

  await login(page, invited.loginName, 'MjlRoleDashboardeset2026!!');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
});

test('activity submission notifies validators once per email address', async ({ page }) => {
  const id = activityId('EML-SUBMIT');
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${id}`);
  await page.getByLabel('Commentaire de soumission').fill('Soumission Email notification');
  await page.getByRole('button', { name: 'Soumettre l activité' }).click();
  await expect(page.locator('[role="status"]')).toContainText('Action sur l’activité enregistrée.');
  await expect(page.getByText('Soumise').first()).toBeVisible();

  const submitted = outboxMessages().filter((message) => message.template === 'activity_submitted' && message.body.includes('EML-SUBMIT'));
  expect(submitted.length).toBeGreaterThan(0);
  expect(submitted[0].subject).toContain('EML-SUBMIT');
  expect(submitted[0].body).toContain('Soumission Email notification');
  const recipientEmails = submitted.map((message) => message.to.toLowerCase());
  expect(new Set(recipientEmails).size).toBe(recipientEmails.length);
});

test('correction, prevalidation, final validation, and rejection notify expected users', async ({ page }) => {
  await login(page, 'superviseur.n1');

  const correctionId = activityId('EML-CORRECTION');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${correctionId}`);
  await page.getByRole('link', { name: 'Retourner pour correction' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${correctionId}&action=request_correction$`));
  await page.getByLabel('Motif de correction').fill('Motif correction Email notification');
  await page.getByRole('button', { name: 'Retourner pour correction' }).click();
  await expect(page.getByText('Correction demandée', { exact: true }).first()).toBeVisible();

  const validationId = activityId('EML-VALIDATE');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${validationId}`);
  await page.getByRole('link', { name: 'Prévalider l’activité' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${validationId}&action=prevalidate$`));
  await page.getByLabel('Commentaire de prévalidation').fill('Prevalidation Email notification');
  await page.getByRole('button', { name: 'Prévalider l’activité' }).click();
  await expect(page.getByText('Prévalidée').first()).toBeVisible();

  const rejectId = activityId('EML-REJECT');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${rejectId}`);
  await page.getByRole('link', { name: 'Rejeter l’activité' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${rejectId}&action=reject$`));
  await page.getByLabel('Motif de rejet').fill('Rejet Email notification');
  await page.getByRole('button', { name: 'Rejeter l’activité' }).click();
  await expect(page.getByText('Rejetée').first()).toBeVisible();

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${validationId}`);
  await page.getByRole('link', { name: 'Valider définitivement l’activité' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${validationId}&action=final_validate$`));
  await page.getByLabel('Commentaire de validation définitive').fill('Validation definitive Email notification');
  await page.getByRole('button', { name: 'Valider définitivement l’activité' }).click();
  await expect(page.getByText('Validée définitivement').first()).toBeVisible();

  const messages = outboxMessages();
  expect(messages.find((message) => message.template === 'activity_correction_requested' && message.body.includes('EML-CORRECTION')).body).toContain('Motif correction Email notification');
  expect(messages.find((message) => message.template === 'activity_prevalidated' && message.body.includes('EML-VALIDATE')).body).toContain('Prevalidation Email notification');
  expect(messages.find((message) => message.template === 'activity_validated' && message.body.includes('EML-VALIDATE')).body).toContain('Validation definitive Email notification');
  expect(messages.find((message) => message.template === 'activity_rejected' && message.body.includes('EML-REJECT')).body).toContain('Rejet Email notification');
});

test('notrigger workflow calls do not send workflow emails', async () => {
  const before = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_access_audit WHERE context LIKE '%template=activity_%'"));
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/verify_activity_workflow.php');
  const after = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_access_audit WHERE context LIKE '%template=activity_%'"));
  expect(after).toBe(before);
});

test('email registry keeps formal French and rejects unsafe or unknown templates', async () => {
  const rendered = execSync(`docker compose exec -T dolibarr php -r "define('NOLOGIN', 1); require '/var/www/html/main.inc.php'; require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_email.lib.php'; print json_encode(array(mjl_email_render('alert_deadline_approaching', array('activity_ref' => 'EML-ALERT')), mjl_email_render('alert_overdue_activity', array('activity_ref' => 'EML-ALERT')), mjl_email_render('invitation', array('link' => 'https://evil.test/x')), mjl_email_render('unknown_template', array())));"`, { encoding: 'utf8' });
  const alerts = JSON.parse(rendered);
  expect(alerts[0].subject).toContain('EML-ALERT');
  expect(alerts[1].subject).toContain('EML-ALERT');
  expect(alerts[0].body).toContain('échéance');
  expect(alerts[2]).toBe(false);
  expect(alerts[3]).toBe(false);
});
