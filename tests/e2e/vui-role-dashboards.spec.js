const { test, expect } = require('@playwright/test');
const childProcess = require('node:child_process');
const { createExecutionFixtureSet } = require('../helpers/execution-fixture');

let fixture;

test.describe.configure({ mode: 'serial' });

async function login(page, role = 'agent') {
	await page.context().clearCookies();
	await page.goto('/index.php');
	await page.getByLabel('Identifiant').fill(role === 'admin' ? 'admin' : fixture.users[role].login);
	await page.getByLabel('Mot de passe').fill(role === 'admin' ? (process.env.DOLI_ADMIN_PASSWORD || 'Admin1234') : process.env.MJL_TEST_USER_PASSWORD);
	await page.getByRole('button', { name: 'Connexion' }).click();
	await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

test.beforeAll(() => {
	fixture = createExecutionFixtureSet({
		namespace: 'vui09.dashboard',
		entity: 1,
		users: [
			{ key: 'agent', role: 'AGENT_SAISIE' },
			{ key: 'other', role: 'AGENT_SAISIE' },
			{ key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
			{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
		],
		references: {
			partners: [{ key: 'partner', label: 'Partenaire tableau de bord' }],
			projects: [{ key: 'project', label: 'Projet tableau de bord', partnerKey: 'partner' }],
			operationTypes: [{ key: 'type', label: 'Type tableau de bord' }],
		},
		activities: [
			{ key: 'owned', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'VUI09 Activité visible agent', description: 'Périmètre affecté.', dateStart: '2026-09-05', dateEnd: '2032-09-30', authorizedAmount: '100', operations: [{ name: 'Opération visible', typeKey: 'type', authorizedAmount: '100' }] },
			{ key: 'other', agentKey: 'other', partnerKey: 'partner', projectKey: 'project', name: 'VUI09 Activité portefeuille seulement', description: 'Périmètre global.', dateStart: '2026-09-05', dateEnd: '2032-09-30', authorizedAmount: '900', operations: [{ name: 'Opération portefeuille', typeKey: 'type', authorizedAmount: '900' }] },
		],
	});
});

test('business roles receive scoped dashboard composition from existing projections', async ({ page }, testInfo) => {
	await login(page, 'agent');
	await page.goto('/custom/mjlfinancement/index.php?q=VUI09');
	await expect(page.getByRole('heading', { name: 'Tableau de bord', exact: true })).toBeVisible();
	await expect(page.locator('[data-dashboard-kpi="scope"]')).toContainText('Mes Activités');
	await expect(page.locator('[data-dashboard-kpi="scope"] .mjl-dashboard-kpi-value')).toHaveText('1');
	await expect(page.locator('#mjl-dashboard-kpi-freshness')).toContainText('selon la sélection et les accès actifs');
	await expect(page.getByRole('heading', { name: 'Mes actions à traiter', exact: true })).toBeVisible();
	await expect(page.locator('[data-metric="validated_amount"]')).toContainText('100 F CFA');
	await expect(page.locator('[data-work^="operation-"]')).toContainText('Opération visible');
	await expect(page.locator('[data-alert="SPENDING_MISSING"]')).toContainText('Opération visible');
	await expect(page.locator('main')).not.toContainText('Activité portefeuille seulement');
	const progress = page.getByRole('progressbar');
	await expect(progress).toHaveCount(6);
	const progressNames = await progress.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
	expect(new Set(progressNames).size).toBe(6);
	expect(progressNames.every(name => /sur 1 Activité$/.test(name))).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('dashboard-agent-desktop.png'), fullPage: true });

	await page.locator('[data-dashboard-kpi="in-progress"] .mjl-card-link').click();
	await expect(page).toHaveURL(/execution_status=IN_PROGRESS/);
	await expect(page.locator('[data-activity]')).toHaveCount(1);

	await login(page, 'supervisor');
	await page.goto('/custom/mjlfinancement/index.php?q=VUI09');
	await expect(page.locator('[data-dashboard-kpi="scope"]')).toContainText('Activités du portefeuille');
	await expect(page.locator('[data-dashboard-kpi="scope"] .mjl-dashboard-kpi-value')).toHaveText('2');
	await expect(page.getByRole('heading', { name: 'Prévalidations à traiter', exact: true })).toBeVisible();

	await login(page, 'validator');
	await page.goto('/custom/mjlfinancement/index.php?q=VUI09');
	await expect(page.locator('[data-dashboard-kpi="scope"] .mjl-dashboard-kpi-value')).toHaveText('2');
	await expect(page.getByRole('heading', { name: 'Décisions à traiter', exact: true })).toBeVisible();
	await page.goto('/custom/mjlfinancement/index.php?q=VUI09-absent');
	const progressPanel = page.locator('[aria-labelledby="mjl-dashboard-progress-title"]');
	await expect(progressPanel.getByRole('progressbar')).toHaveCount(0);
	await expect(progressPanel.getByText('Aucune Activité', { exact: true })).toBeVisible();
});

test('Supervisor and Validator dashboard queues expose only their current review action', async ({ page }) => {
	const created = createActivities([{ key: 'review', name: 'VUI09 Révision à décider' }]).review;
	await login(page, 'supervisor');
	await page.goto('/custom/mjlfinancement/index.php?q=VUI09%20Révision');
	const supervisorWork = page.locator('[data-work="activity-' + created.activity_id + '"]');
	await expect(supervisorWork).toContainText('Prévalider');
	await supervisorWork.getByRole('link', { name: 'Ouvrir', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Prévalider', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Prévalider', exact: true }).click();
	await expect(page).toHaveURL(/result=OK/);

	await login(page, 'validator');
	await page.goto('/custom/mjlfinancement/index.php?q=VUI09%20Révision');
	const validatorWork = page.locator('[data-work="activity-' + created.activity_id + '"]');
	await expect(validatorWork).toContainText('Valider définitivement');
	await validatorWork.getByRole('link', { name: 'Ouvrir', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Valider définitivement', exact: true })).toBeVisible();
});

test('Admin dashboard exposes only existing technical and account destinations', async ({ page }, testInfo) => {
	await login(page, 'admin');
	await page.goto('/custom/mjlfinancement/index.php?q=VUI09');
	await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
	for (const [name, href] of [
		['Gérer les utilisateurs', '/custom/mjlfinancement/admin/access.php'],
		['Consulter l’historique', '/custom/mjlfinancement/workflowactions.php'],
		['Ouvrir le rapport d’audit', '/custom/mjlfinancement/reports.php?report=audit'],
		['Administration technique', '/admin/modules.php'],
	]) {
		await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
	}
	await expect(page.locator('[data-dashboard-kpi], [data-metric]')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Situation financière', exact: true })).toHaveCount(0);
	await page.screenshot({ path: testInfo.outputPath('dashboard-admin-desktop.png'), fullPage: true });
	await page.getByRole('link', { name: 'Gérer les utilisateurs', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Gestion des accès MJL', exact: true })).toBeVisible();
	expect((await page.goto('/custom/mjlfinancement/activities.php')).status()).toBe(403);
});

test('role dashboard reflows with forced colors and remains useful without JavaScript', async ({ browser }, testInfo) => {
	const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
	try {
		const page = await context.newPage();
		await login(page, 'agent');
		await page.goto('/custom/mjlfinancement/index.php?q=VUI09%20Activité');
		await expect(page.getByRole('heading', { name: 'Tableau de bord', exact: true })).toBeVisible();
		await expect(page.locator('[data-dashboard-kpi="scope"] .mjl-dashboard-kpi-value')).toHaveText('1');
		await expect(page.getByRole('link', { name: 'Voir toutes les alertes' })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.screenshot({ path: testInfo.outputPath('dashboard-agent-mobile-forced-colors.png'), fullPage: true });
	} finally {
		await context.close();
	}
});

function createActivities(items) {
	return JSON.parse(childProcess.execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/activity-fixture.php'], {
		env: process.env,
		encoding: 'utf8',
		stdio: ['pipe', 'pipe', 'pipe'],
		input: JSON.stringify({
			entity: 1,
			activities: items.map(item => ({
				actorId: fixture.users.agent.id,
				partnerId: fixture.partners.partner,
				projectId: fixture.projects.project,
				assignmentActorId: fixture.users.validator.id,
				description: 'Révision du tableau de bord.',
				dateStart: '2032-09-05',
				dateEnd: '2032-09-30',
				authorizedAmount: '10',
				submit: true,
				operations: [{ name: 'Opération à examiner', typeId: fixture.operationTypes.type, authorizedAmount: '10' }],
				...item,
			})),
		}),
	}) .toString());
}
