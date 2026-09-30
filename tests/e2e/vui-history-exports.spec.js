const { test, expect } = require('@playwright/test');
const childProcess = require('node:child_process');
const { createExecutionFixtureSet } = require('../helpers/execution-fixture');

let fixture;

test.describe.configure({ mode: 'serial' });

async function login(page, role = 'validator') {
	await page.context().clearCookies();
	await page.goto('/index.php');
	await page.getByLabel('Identifiant').fill(role === 'admin' ? 'admin' : fixture.users[role].login);
	await page.getByLabel('Mot de passe').fill(role === 'admin' ? (process.env.DOLI_ADMIN_PASSWORD || 'Admin1234') : process.env.MJL_TEST_USER_PASSWORD);
	await page.getByRole('button', { name: 'Connexion' }).click();
	await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

function reportFixture(action) {
	return JSON.parse(childProcess.execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/report-fixture.php', action], {
		env: process.env,
		encoding: 'utf8',
		stdio: ['pipe', 'pipe', 'pipe'],
		input: JSON.stringify({ actorId: fixture.users.validator.id, activityId: fixture.activities.main.activity_id }) + '\n',
	}));
}

test.beforeAll(() => {
	childProcess.execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/report-fixture.php', 'install'], { env: process.env, stdio: 'pipe' });
	fixture = createExecutionFixtureSet({
		namespace: 'vui12.history',
		entity: 1,
		users: [
			{ key: 'agent', role: 'AGENT_SAISIE' },
			{ key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
			{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
		],
		references: {
			partners: [{ key: 'partner', label: 'Partenaire VUI-12' }],
			projects: [{ key: 'project', label: 'Projet VUI-12', partnerKey: 'partner' }],
			operationTypes: [{ key: 'type', label: 'Type VUI-12' }],
		},
		activities: [{
			key: 'main', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
			name: 'Activité historique VUI-12', description: 'Présentation des rapports et de la chronologie.',
			dateStart: '2026-09-05', dateEnd: '2032-09-30', authorizedAmount: '100',
			operations: [{ name: 'Opération VUI-12', typeKey: 'type', authorizedAmount: '100' }],
		}],
	});
	reportFixture('audit-fixtures');
});

test('business reports share filters, visible selection state, navigation, and exact export forms', async ({ page }) => {
	await login(page, 'validator');
	await page.goto('/custom/mjlfinancement/reports.php?report=activities&q=VUI-12&date_from=2026-09-01');
	await expect(page.getByRole('heading', { name: 'Suivi des Activités', level: 1 })).toBeVisible();
	await expect(page.locator('.mjl-report-filter-panel')).toBeVisible();
	await expect(page.locator('[data-active-filter-count="2"]')).toContainText('2 filtres actifs');
	await expect(page.locator('.mjl-report-active-filters')).toContainText('Recherche : VUI-12');
	await expect(page.locator('.mjl-report-active-filters')).toContainText('Période à partir du : 01/09/2026');
	await expect(page.locator('.mjl-report-export-panel')).toContainText('L’export inclut toutes les pages');
	const exportForm = page.locator('.mjl-report-export-actions');
	await expect(exportForm.locator('input[name="q"]')).toHaveValue('VUI-12');
	await expect(exportForm.locator('input[name="date_from"]')).toHaveValue('2026-09-01');
	await expect(exportForm.getByRole('button', { name: 'Télécharger PDF', exact: true })).toBeVisible();
	await expect(exportForm.getByRole('button', { name: 'Télécharger XLSX', exact: true })).toBeVisible();
	await expect(exportForm.getByRole('button', { name: 'Télécharger CSV', exact: true })).toBeVisible();

	await page.getByRole('link', { name: 'Opérations', exact: true }).click();
	await expect(page).toHaveURL(/report=operations/);
	await page.goBack();
	await expect(page).toHaveURL(/report=activities.*q=VUI-12.*date_from=2026-09-01/);
	await expect(page.getByLabel('Recherche', { exact: true })).toHaveValue('VUI-12');
});

test('global audit is a filtered chronology with persistent evidence and audited downloads', async ({ page }) => {
	await login(page, 'validator');
	await page.goto('/custom/mjlfinancement/workflowactions.php?result=SUCCESS&direction=asc');
	await expect(page.getByRole('heading', { name: 'Journal d’audit', exact: true })).toBeVisible();
	await expect(page.locator('[data-active-filter-count="2"]')).toContainText('2 filtres actifs');
	await expect(page.locator('.mjl-report-active-filters')).toContainText('Résultat : Réussite');
	await expect(page.locator('.mjl-report-active-filters')).toContainText('Ordre : Plus anciens en premier');
	const timeline = page.locator('.mjl-audit-timeline');
	await expect(timeline.locator('[data-audit-event-id]').first()).toBeVisible();
	await expect(timeline.locator('[data-audit-event-id]').first().locator('.mjl-audit-event-date')).not.toBeEmpty();
	await expect(timeline.locator('[data-audit-event-id]').first().locator('.mjl-status-pill')).toBeVisible();
	await expect(timeline.locator('[data-audit-event-id]').first().getByText('Champs et valeurs enregistrés')).toBeVisible();
	await expect(page.locator('.mjl-report-export-actions input[name="cursor"]')).toHaveValue('');

	await login(page, 'admin');
	await page.goto('/custom/mjlfinancement/reports.php?report=audit');
	const reportTabs = page.getByRole('navigation', { name: 'Type de rapport' });
	await expect(reportTabs.getByRole('link', { name: 'Journal d’audit', exact: true })).toHaveAttribute('aria-current', 'page');
	for (const label of ['Activités', 'Opérations', 'Portefeuille']) await expect(reportTabs.getByRole('link', { name: label, exact: true })).toHaveCount(0);
});

test('history restrictions and responsive no-JavaScript presentation remain intact', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
	try {
		const page = await context.newPage();
		await login(page, 'agent');
		expect((await page.goto('/custom/mjlfinancement/workflowactions.php')).status()).toBe(403);
		await page.goto('/custom/mjlfinancement/reports.php?report=activities&q=VUI-12');
		await expect(page.locator('.mjl-report-filter-panel')).toBeVisible();
		await expect(page.locator('.mjl-report-export-actions')).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	} finally {
		await context.close();
	}
});
