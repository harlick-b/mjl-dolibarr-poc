const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { sql, scalar, registerSecret } = require('../helpers/mjl-test-runtime');

const adminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
const testPassword = process.env.MJL_TEST_USER_PASSWORD;
const invitationPassword = process.env.MJL_AUTH_PASSWORD_1;
const resetPassword = process.env.MJL_AUTH_PASSWORD_2;

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
  createPhase1FixtureSet({
    namespace: 'phase1.e2e', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
      { key: 'norole', role: null },
    ],
    references: { partners: [], projects: [], operationTypes: [] },
  });
  sql("INSERT INTO llx_const (name,entity,value,type,visible,note) VALUES ('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'Phase 1 disposable E2E') ON DUPLICATE KEY UPDATE value='1'");
});

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
