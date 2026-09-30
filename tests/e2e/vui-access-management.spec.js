const { test, expect } = require('@playwright/test');
const { createUserReferenceFixtureSet } = require('../helpers/user-reference-fixture');
const { login, registerSecret, scalar, sql } = require('../helpers/mjl-test-runtime');

let fixture;


test.beforeAll(({}, workerInfo) => {
	fixture = createUserReferenceFixtureSet({
		namespace: `vui11.access${workerInfo.workerIndex}`,
		entity: 1,
		users: [
			{ key: 'agent', role: 'AGENT_SAISIE' },
			{ key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
			{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
		],
		references: { partners: [], projects: [], operationTypes: [] },
	});
	sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'VUI-11 disposable invitation delivery') ON DUPLICATE KEY UPDATE value='1'");
});

async function signIn(page, username, password) {
	await login(page, username, password);
	await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

test('Admin access presents current users and preserves direct-route denial', async ({ page }) => {
	await signIn(page, fixture.users.agent.login, process.env.MJL_TEST_USER_PASSWORD);
	let denied = await page.goto('/custom/mjlfinancement/admin/access.php');
	expect(denied.status()).toBe(403);
	denied = await page.request.post('/custom/mjlfinancement/admin/access.php', {
		form: { action: 'deactivate', user_id: String(fixture.users.validator.id), token: 'non-admin' },
	});
	expect(denied.status()).toBe(403);
	await signIn(page, fixture.users.supervisor.login, process.env.MJL_TEST_USER_PASSWORD);
	denied = await page.goto('/custom/mjlfinancement/admin/access.php');
	expect(denied.status()).toBe(403);

	await signIn(page, 'admin', process.env.DOLI_ADMIN_PASSWORD || 'Admin1234');
	await page.goto('/custom/mjlfinancement/admin/access.php');
	await expect(page.getByRole('heading', { name: 'Gestion des accès MJL', level: 1 })).toBeVisible();
	await expect(page.getByRole('table', { name: 'Utilisateurs MJL' })).toBeVisible();
	await expect(page.locator('[data-mjl-access-invitations]')).toContainText('Aucune invitation');
	const agentRow = page.locator('[data-access-user-row]').filter({ hasText: fixture.users.agent.login });
	await expect(agentRow).toContainText('Agent de saisie');
	await expect(agentRow.locator('.mjl-status-pill')).toHaveText('Actif');
	await expect(page.getByRole('button', { name: 'Réactiver' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Renvoyer' })).toHaveCount(0);
});

test('invitation dialog protects dirty input and revokes through the exact guarded form', async ({ page }) => {
	await signIn(page, 'admin', process.env.DOLI_ADMIN_PASSWORD || 'Admin1234');
	await page.goto('/custom/mjlfinancement/admin/access.php');
	const inviteTrigger = page.getByRole('link', { name: 'Inviter un utilisateur' });
	await inviteTrigger.click();
	let dialog = page.getByRole('dialog', { name: 'Inviter un utilisateur' });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel('Identifiant').fill('vui11.invited');
	await page.keyboard.press('Escape');
	const unsaved = page.getByRole('dialog', { name: 'Modifications non enregistrées' });
	await expect(unsaved).toBeVisible();
	await unsaved.getByRole('button', { name: 'Continuer la saisie', exact: true }).click();
	await expect(dialog.getByLabel('Identifiant')).toHaveValue('vui11.invited');
	await expect(dialog.getByLabel('Identifiant')).toBeFocused();
	await page.keyboard.press('Escape');
	await unsaved.getByRole('button', { name: 'Quitter sans enregistrer', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(inviteTrigger).toBeFocused();

	await inviteTrigger.click();
	dialog = page.getByRole('dialog', { name: 'Inviter un utilisateur' });
	await dialog.getByLabel('Identifiant').fill('vui11.invited');
	await dialog.getByLabel('Prénom').fill('Utilisateur');
	await dialog.getByLabel(/^Nom \(/).fill('VUI11');
	await dialog.getByLabel('Email').fill('vui11.invited@example.test');
	await dialog.getByLabel('Profil de production').selectOption('AGENT_SAISIE');
	await dialog.getByRole('button', { name: 'Envoyer l’invitation', exact: true }).click();
	const invitationLink = await page.locator('code').innerText();
	await registerSecret('invitation link', invitationLink);
	await expect(page.locator('body')).toContainText('Invitation envoyée');
	const invitationRow = page.locator('[data-access-invitation-row]').filter({ hasText: 'vui11.invited' });
	await expect(invitationRow.locator('.mjl-status-pill')).toHaveText('Envoyée');
	const revoke = invitationRow.getByRole('button', { name: 'Révoquer', exact: true });
	await revoke.click();
	const actionDialog = page.getByRole('dialog', { name: 'Révoquer l’invitation' });
	await expect(actionDialog).toBeVisible();
	await expect(page.locator('form').filter({ has: page.locator('input[name="action"][value="revoke"]') })).toHaveCount(1);
	await actionDialog.getByRole('button', { name: 'Confirmer la révocation', exact: true }).click();
	expect(scalar("SELECT status FROM llx_mjlfinancement_invitation i INNER JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='vui11.invited' ORDER BY i.rowid DESC LIMIT 1")).toBe('revoked');
});


test('failed invitation delivery is presented without a usable link', async ({ page }) => {
	sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_FAIL_AUTH_OUTBOX',1,'1','chaine',0,'VUI-11 failed delivery') ON DUPLICATE KEY UPDATE value='1'");
	try {
		await signIn(page, 'admin', process.env.DOLI_ADMIN_PASSWORD || 'Admin1234');
		await page.goto('/custom/mjlfinancement/admin/access.php');
		await page.getByRole('link', { name: 'Inviter un utilisateur' }).click();
		const dialog = page.getByRole('dialog', { name: 'Inviter un utilisateur' });
		await dialog.getByLabel('Identifiant').fill('vui11.failed');
		await dialog.getByLabel('Prénom').fill('Échec');
		await dialog.getByLabel(/^Nom \(/).fill('VUI11');
		await dialog.getByLabel('Email').fill('vui11.failed@example.test');
		await dialog.getByRole('button', { name: 'Envoyer l’invitation', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Inviter un utilisateur' })).toContainText('Échec de l’envoi');
		const invitationRow = page.locator('[data-access-invitation-row]').filter({ hasText: 'vui11.failed' });
		await expect(invitationRow.locator('.mjl-status-pill')).toHaveText('Échec de l’envoi');
		await expect(invitationRow).toContainText('Aucune action');
		await expect(page.locator('code')).toHaveCount(0);
	} finally {
		sql("DELETE FROM llx_const WHERE name='MJL_AUTH_E2E_FAIL_AUTH_OUTBOX' AND entity=1");
	}
});

test('role change and deactivation use one shared action dialog', async ({ page }) => {
	await signIn(page, 'admin', process.env.DOLI_ADMIN_PASSWORD || 'Admin1234');
	await page.goto('/custom/mjlfinancement/admin/access.php');
	let row = page.locator('[data-access-user-row]').filter({ hasText: fixture.users.agent.login });
	const edit = row.getByRole('button', { name: 'Modifier le profil', exact: true });
	await edit.click();
	let dialog = page.getByRole('dialog', { name: 'Modifier le profil' });
	await dialog.getByLabel('Profil de production').selectOption('AGENT_VERIFICATEUR');
	await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
	expect(scalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE entity=1 AND fk_user=${fixture.users.agent.id} AND is_active=1`)).toBe('AGENT_VERIFICATEUR');

	row = page.locator('[data-access-user-row]').filter({ hasText: fixture.users.validator.login });
	const deactivate = row.getByRole('button', { name: 'Désactiver', exact: true });
	await deactivate.click();
	dialog = page.getByRole('dialog', { name: 'Désactiver l’utilisateur' });
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(deactivate).toBeFocused();
	await deactivate.click();
	await dialog.getByRole('button', { name: 'Confirmer la désactivation', exact: true }).click();
	expect(scalar(`SELECT statut FROM llx_user WHERE rowid=${fixture.users.validator.id}`)).toBe('0');
});

test('access management reflows in forced colors and keeps no-JavaScript forms', async ({ browser }) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 390, height: 844 },
		reducedMotion: 'reduce',
		forcedColors: 'active',
	});
	try {
		const page = await context.newPage();
		await signIn(page, 'admin', process.env.DOLI_ADMIN_PASSWORD || 'Admin1234');
		await page.goto('/custom/mjlfinancement/admin/access.php');
		await expect(page.getByRole('dialog', { name: 'Inviter un utilisateur' })).toBeVisible();
		await expect(page.locator('form').filter({ has: page.locator('input[name="action"][value="update_profile"]') }).first()).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	} finally {
		await context.close();
	}
});
