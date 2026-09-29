const { test, expect } = require('@playwright/test');
const { createUserReferenceFixtureSet } = require('../helpers/user-reference-fixture');
const { login, scalar } = require('../helpers/mjl-test-runtime');

let fixture;

test.describe.configure({ mode: 'serial' });

async function signIn(page, role) {
	await login(page, fixture.users[role].login, process.env.MJL_TEST_USER_PASSWORD);
	await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

test.beforeAll(() => {
	fixture = createUserReferenceFixtureSet({
		namespace: 'vui10.references',
		entity: 1,
		users: [
			{ key: 'agent', role: 'AGENT_SAISIE' },
			{ key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
			{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
		],
		references: {
			partners: [
				{ key: 'partner-primary', label: 'Partenaire VUI10 principal' },
				{ key: 'partner-cycle', label: 'Partenaire VUI10 cycle' },
			],
			projects: [
				{ key: 'project-primary', label: 'Projet VUI10 principal', partnerKey: 'partner-primary' },
				{ key: 'project-cycle', label: 'Projet VUI10 cycle', partnerKey: 'partner-cycle' },
			],
			operationTypes: [],
		},
	});
});

test('shared Partner and Project lists expose current facts and role-aware actions', async ({ page }, testInfo) => {
	await signIn(page, 'validator');
	await page.goto('/custom/mjlfinancement/partners.php');
	const partnerList = page.locator('[data-mjl-reference-list="partner"]');
	await expect(partnerList.getByRole('table', { name: 'Partenaires' })).toBeVisible();
	await expect(partnerList.getByRole('columnheader', { name: 'Partenaire' })).toBeVisible();
	await expect(partnerList.getByRole('columnheader', { name: 'Statut' })).toBeVisible();
	await expect(partnerList.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
	const partnerRow = partnerList.locator('[data-reference-row]').filter({ hasText: 'Partenaire VUI10 principal' });
	await expect(partnerRow.locator('.mjl-status-pill')).toHaveText('Actif');
	await partnerRow.locator('summary[aria-label^="Actions pour Partenaire VUI10 principal"]').click();
	await expect(partnerRow.getByRole('menuitem', { name: 'Consulter' })).toBeVisible();
	await expect(partnerRow.getByRole('menuitem', { name: 'Modifier' })).toBeVisible();

	await page.goto('/custom/mjlfinancement/projects.php');
	const projectList = page.locator('[data-mjl-reference-list="project"]');
	await expect(projectList.getByRole('columnheader', { name: 'Projet' })).toBeVisible();
	await expect(projectList.getByRole('columnheader', { name: 'Partenaire' })).toBeVisible();
	const projectRow = projectList.locator('[data-reference-row]').filter({ hasText: 'Projet VUI10 principal' });
	await expect(projectRow).toContainText('Partenaire VUI10 principal');
	await expect(projectRow.locator('.mjl-status-pill')).toHaveText('Actif');
	await page.screenshot({ path: testInfo.outputPath('projects-validator-desktop.png'), fullPage: true });

	await signIn(page, 'agent');
	await page.goto('/custom/mjlfinancement/partners.php');
	await expect(page.getByRole('link', { name: 'Créer un Partenaire' })).toHaveCount(0);
	await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0);
	await expect(page.locator('[data-mjl-action-menu]')).toHaveCount(0);

	await signIn(page, 'supervisor');
	await page.goto('/custom/mjlfinancement/projects.php');
	await expect(page.getByRole('link', { name: 'Créer un Projet' })).toHaveCount(0);
	await expect(page.locator('[data-mjl-action-menu]')).toHaveCount(0);
});

test('create and edit use the shared dialog while Project ownership remains immutable', async ({ page }) => {
	await signIn(page, 'validator');
	await page.goto('/custom/mjlfinancement/partners.php?action=create');
	let dialog = page.getByRole('dialog', { name: 'Créer un Partenaire' });
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('form')).toHaveCount(1);
	const label = dialog.getByLabel('Libellé');
	await label.fill('Partenaire VUI10 créé');
	await page.keyboard.press('Escape');
	const unsaved = page.getByRole('dialog', { name: 'Modifications non enregistrées' });
	await expect(unsaved).toBeVisible();
	await unsaved.getByRole('button', { name: 'Continuer la saisie', exact: true }).click();
	await expect(dialog).toBeVisible();
	await expect(label).toHaveValue('Partenaire VUI10 créé');
	await expect(label).toBeFocused();
	await page.keyboard.press('Escape');
	await unsaved.getByRole('button', { name: 'Quitter sans enregistrer', exact: true }).click();
	await expect(page).toHaveURL(/\/partners\.php$/);

	await page.goto('/custom/mjlfinancement/partners.php?action=create');
	dialog = page.getByRole('dialog', { name: 'Créer un Partenaire' });
	await dialog.getByLabel('Libellé').fill('Partenaire VUI10 créé');
	await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
	await expect(page).toHaveURL(/partners\.php\?id=\d+$/);
	expect(Number(scalar("SELECT COUNT(*) FROM llx_societe WHERE entity=1 AND nom='Partenaire VUI10 créé'"))).toBe(1);

	const projectId = fixture.projects['project-primary'];
	const beforeParent = scalar(`SELECT fk_soc FROM llx_projet WHERE rowid=${projectId}`);
	await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}&action=edit`);
	dialog = page.getByRole('dialog', { name: 'Modifier le Projet' });
	await expect(dialog).toContainText('Partenaire VUI10 principal');
	await expect(dialog.locator('select[name="partner_id"], input[name="partner_id"]')).toHaveCount(0);
	await dialog.getByLabel('Libellé').fill('Projet VUI10 renommé');
	await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
	expect(scalar(`SELECT fk_soc FROM llx_projet WHERE rowid=${projectId}`)).toBe(beforeParent);
	expect(scalar(`SELECT title FROM llx_projet WHERE rowid=${projectId}`)).toBe('Projet VUI10 renommé');
});

test('lifecycle confirmation moves the exact guarded form and restores focus', async ({ page }) => {
	await signIn(page, 'validator');
	const partnerId = fixture.partners['partner-cycle'];
	await page.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}`);
	const lifecycleForms = page.locator('form').filter({ has: page.locator('input[name="action"][value="deactivate"]') });
	await expect(lifecycleForms).toHaveCount(1);
	const trigger = page.getByRole('button', { name: 'Désactiver', exact: true });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Désactiver le Partenaire' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Les Projets actifs liés seront également désactivés');
	await expect(lifecycleForms).toHaveCount(1);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
	await trigger.click();
	await dialog.getByRole('button', { name: 'Confirmer la désactivation', exact: true }).click();
	expect(scalar(`SELECT status FROM llx_societe WHERE rowid=${partnerId}`)).toBe('0');
	expect(scalar(`SELECT fk_statut FROM llx_projet WHERE rowid=${fixture.projects['project-cycle']}`)).not.toBe('1');
});

test('reference screens reflow in forced colors and retain no-JavaScript forms', async ({ browser }, testInfo) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 390, height: 844 },
		reducedMotion: 'reduce',
		forcedColors: 'active',
	});
	try {
		const page = await context.newPage();
		await signIn(page, 'validator');
		await page.goto('/custom/mjlfinancement/projects.php');
		await expect(page.locator('[data-mjl-reference-list="project"]')).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.goto('/custom/mjlfinancement/projects.php?action=create');
		const fallback = page.getByRole('dialog', { name: 'Créer un Projet' });
		await expect(fallback).toBeVisible();
		await expect(fallback.getByLabel('Libellé')).toBeVisible();
		await expect(fallback.getByLabel('Partenaire')).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath('project-create-mobile-forced-colors.png'), fullPage: true });
	} finally {
		await context.close();
	}
});
