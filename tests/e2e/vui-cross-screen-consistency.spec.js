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

async function expectConsistentPage(page) {
	await expect(page.locator('main h1:visible')).toHaveCount(1);
	expect(await page.evaluate(() => {
		const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
		return ids.filter((id, index) => ids.indexOf(id) !== index);
	})).toEqual([]);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test.beforeAll(() => {
	childProcess.execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/report-fixture.php', 'install'], { env: process.env, stdio: 'pipe' });
	fixture = createExecutionFixtureSet({
		namespace: 'vui13.consistency',
		entity: 1,
		users: [
			{ key: 'agent', role: 'AGENT_SAISIE' },
			{ key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
			{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
		],
		references: {
			partners: [{ key: 'partner', label: 'Partenaire VUI-13' }],
			projects: [{ key: 'project', label: 'Projet VUI-13', partnerKey: 'partner' }],
			operationTypes: [{ key: 'type', label: 'Type VUI-13' }],
		},
		activities: [{
			key: 'main', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
			name: 'Activité cohérence VUI-13', description: 'Revue transversale des surfaces.',
			dateStart: '2026-09-05', dateEnd: '2032-09-30', authorizedAmount: '100',
			operations: [{ name: 'Opération VUI-13', typeKey: 'type', authorizedAmount: '100' }],
		}],
	});
});

test('completed business and audit surfaces share structural and chronology presentation', async ({ page }, testInfo) => {
	await login(page, 'agent');
	const activityId = fixture.activities.main.activity_id;
	for (const path of [
		'/custom/mjlfinancement/index.php',
		'/custom/mjlfinancement/activities.php',
		`/custom/mjlfinancement/activities.php?id=${activityId}`,
		`/custom/mjlfinancement/operations.php?activity_id=${activityId}`,
		'/custom/mjlfinancement/operationrequests.php',
		'/custom/mjlfinancement/alerts.php',
		'/custom/mjlfinancement/reports.php?report=activities&q=VUI-13',
	]) {
		const response = await page.goto(path);
		expect(response.status(), path).toBe(200);
		await expectConsistentPage(page);
	}
	await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
	await page.getByRole('tab', { name: 'Historique', exact: true }).click();
	const contextualTimeline = page.locator('.mjl-review-timeline').last();
	await expect(contextualTimeline.locator('li').first()).toBeVisible();
	expect(await contextualTimeline.evaluate(node => getComputedStyle(node).borderInlineStartWidth)).toBe('2px');
	expect(await contextualTimeline.locator('li').first().evaluate(node => getComputedStyle(node, '::before').content)).not.toBe('none');
	await page.screenshot({ path: testInfo.outputPath('vui13-activity-desktop.png'), fullPage: true });

	await login(page, 'validator');
	await page.goto('/custom/mjlfinancement/reports.php?report=audit');
	await expectConsistentPage(page);
	await expect(page.locator('.mjl-audit-timeline')).toBeVisible();
	expect(await page.locator('.mjl-audit-timeline').evaluate(node => getComputedStyle(node).borderInlineStartWidth)).toBe('2px');
	const auditStatus = page.locator('.mjl-audit-timeline .mjl-status-success').first();
	await expect(auditStatus).toBeVisible();
	expect(await auditStatus.evaluate(node => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--mjl-color-status-success)';
		node.parentElement.append(probe);
		const matches = getComputedStyle(node).color === getComputedStyle(probe).color;
		probe.remove();
		return matches;
	})).toBe(true);
});

test('four roles retain their established direct-route boundaries', async ({ page }) => {
	for (const [role, path, expected] of [
		['agent', '/custom/mjlfinancement/workflowactions.php', 403],
		['agent', '/custom/mjlfinancement/admin/access.php', 403],
		['supervisor', '/custom/mjlfinancement/workflowactions.php', 403],
		['validator', '/custom/mjlfinancement/workflowactions.php', 200],
		['validator', '/custom/mjlfinancement/admin/access.php', 403],
		['admin', '/custom/mjlfinancement/admin/access.php', 200],
		['admin', '/custom/mjlfinancement/activities.php', 403],
		['admin', '/custom/mjlfinancement/workflowactions.php', 200],
	]) {
		await login(page, role);
		expect((await page.goto(path)).status(), `${role} ${path}`).toBe(expected);
	}
});

test('shared surfaces reflow with accessible targets without JavaScript', async ({ browser }, testInfo) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 390, height: 844 },
		reducedMotion: 'reduce',
		forcedColors: 'active',
	});
	try {
		const page = await context.newPage();
		await login(page, 'agent');
		await page.goto(`/custom/mjlfinancement/activities.php?id=${fixture.activities.main.activity_id}`);
		await expectConsistentPage(page);
		const controls = page.locator('main :is(button, .button, .butAction, .mjl-action, input, select, textarea):visible');
		for (const box of await controls.evaluateAll(nodes => nodes.slice(0, 20).map(node => node.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
		expect(await page.locator('.mjl-review-timeline').last().evaluate(node => getComputedStyle(node).borderInlineStartWidth)).toBe('2px');
		await page.screenshot({ path: testInfo.outputPath('vui13-activity-mobile-forced-colors.png'), fullPage: true });

		await login(page, 'admin');
		await page.goto('/custom/mjlfinancement/admin/access.php');
		await expectConsistentPage(page);
		await expect(page.locator('form').filter({ has: page.locator('input[name="action"][value="update_profile"]') }).first()).toBeVisible();
	} finally {
		await context.close();
	}
});
