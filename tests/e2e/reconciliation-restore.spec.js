const { test, expect } = require('@playwright/test');
const childProcess = require('node:child_process');
const { createExecutionFixtureSet, runExecutionFixtureCommand } = require('../helpers/execution-fixture');
const { scalar, sql } = require('../helpers/mjl-test-runtime');

function fixture(action, ...args) {
	return childProcess.execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/reconciliation-fixture.php', action, ...args.map(String)], { env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

let foreign;
let boundary;
let primary;

test.describe.configure({ mode: 'serial', retries: 0 });

function createReconciliationBatch(batch) {
	return createExecutionFixtureSet({
			namespace: `p3c-b${String(batch).padStart(2, '0')}`,
			entity: 1,
			users: [
				{ key: 'agent', role: 'AGENT_SAISIE' },
				{ key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
				{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
				...(batch === 0 ? [{ key: 'norole', role: null }] : []),
			],
			references: {
				partners: [{ key: 'partner', label: `Partenaire Phase 3C ${batch}` }],
				projects: [{ key: 'project', label: `Projet Phase 3C ${batch}`, partnerKey: 'partner' }],
				operationTypes: [{ key: 'type', label: `Type Phase 3C ${batch}` }],
			},
			activities: Array.from({ length: 8 }, (_, index) => ({
				key: `a${index}`,
				agentKey: 'agent',
				partnerKey: 'partner',
				projectKey: 'project',
				name: `Réconciliation Phase 3C ${batch}-${index}`,
				description: 'Pagination du réconciliateur.',
				dateStart: '2026-09-05',
				dateEnd: '2026-09-30',
				authorizedAmount: '100',
				operations: [{ name: `Opération ${batch}-${index}`, typeKey: 'type', authorizedAmount: '100' }],
			})),
		});
}

test.beforeAll(() => {
	primary = createReconciliationBatch(0);
	foreign = createExecutionFixtureSet({ namespace: 'p3c-foreign', entity: 2, users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }], references: { partners: [{ key: 'partner', label: 'Partenaire isolation Phase 3C' }], projects: [{ key: 'project', label: 'Projet isolation Phase 3C', partnerKey: 'partner' }], operationTypes: [{ key: 'type', label: 'Type isolation Phase 3C' }] }, activities: [{ key: 'foreign', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Isolation Phase 3C', description: 'Canari inter-entité.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération isolation', typeKey: 'type', authorizedAmount: '100' }] }] });
	boundary = createExecutionFixtureSet({ namespace: 'p3c-boundary', entity: 1, users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }], references: { partners: [{ key: 'partner', label: 'Partenaire fuseau Phase 3C' }], projects: [{ key: 'project', label: 'Projet fuseau Phase 3C', partnerKey: 'partner' }], operationTypes: [{ key: 'type', label: 'Type fuseau Phase 3C' }] }, activities: [{ key: 'boundary', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Frontière Porto-Novo Phase 3C', description: 'Canari de date.', dateStart: '2032-06-01', dateEnd: '2032-06-01', authorizedAmount: '100', operations: [{ name: 'Opération fuseau', typeKey: 'type', authorizedAmount: '100' }] }] });
	const operation = primary.activities.a0.operations[0];
	const request = runExecutionFixtureCommand({ entity: 1, action: 'request-cancel', actorId: primary.users.agent.id, targetType: 'OPERATION', targetId: operation.rowid, expectedVersion: operation.version, reason: 'Preuve de restauration Phase 3C' });
	if (request.code !== 'OK') throw new Error('Phase 3C could not create representative cancellation evidence.');
});

async function login(page) {
	await page.goto('/index.php');
	await page.getByLabel('Identifiant').fill(primary.users.agent.login);
	await page.getByLabel('Mot de passe').fill(process.env.MJL_TEST_USER_PASSWORD);
	await page.getByRole('button', { name: 'Connexion' }).click();
	await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

test('a real scoped export leaves evidence for the restore rehearsal', async ({ page }) => {
	await login(page);
	await page.goto('/custom/mjlfinancement/reports.php');
	const pending = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Télécharger CSV', exact: true }).click();
	await pending;
	expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_export_record WHERE entity=1 AND status='GENERATED'"))).toBeGreaterThan(0);
});

test('operational scripts and native user creation are denied over HTTP', async ({ request }) => {
	const response = await request.get('/custom/mjlfinancement/scripts/bootstrap_poc.php');
	expect(response.status()).toBe(403);
	for (const route of ['/user/card.php?action=create', '/user/new.php']) expect((await request.get(route)).status()).toBe(403);
});

test('installed reconciler traverses more than one 100-row page and remains idempotent', () => {
	for (let batch = 1; batch < 13; batch += 1) createReconciliationBatch(batch);
	const before = Number(fixture('scheduled-count'));
	const foreignBefore = scalar(`SELECT CONCAT(version,'|',(SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE entity=2 AND activity_id=${foreign.activities.foreign.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'),'|',COALESCE((SELECT state_after FROM llx_mjlfinancement_audit_event WHERE entity=2 AND activity_id=${foreign.activities.foreign.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED' ORDER BY rowid DESC LIMIT 1),'NONE')) FROM llx_mjlfinancement_activity WHERE entity=2 AND rowid=${foreign.activities.foreign.activity_id}`);
	const first = JSON.parse(fixture('reconcile'));
	expect(first.result).toBe(0);
	const processed = Number(first.output.match(/^(\d+) Activité\(s\) réconciliée\(s\)\.$/)?.[1]);
	expect(processed).toBeGreaterThan(100);
	const afterFirst = Number(fixture('scheduled-count'));
	expect(afterFirst).toBeGreaterThan(before);
	const second = JSON.parse(fixture('reconcile'));
	expect(second.result).toBe(0);
	expect(Number(fixture('scheduled-count'))).toBe(afterFirst);
	expect(scalar(`SELECT CONCAT(version,'|',(SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE entity=2 AND activity_id=${foreign.activities.foreign.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'),'|',COALESCE((SELECT state_after FROM llx_mjlfinancement_audit_event WHERE entity=2 AND activity_id=${foreign.activities.foreign.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED' ORDER BY rowid DESC LIMIT 1),'NONE')) FROM llx_mjlfinancement_activity WHERE entity=2 AND rowid=${foreign.activities.foreign.activity_id}`)).toBe(foreignBefore);
});

test('reconciliation service derives its date across the Porto-Novo UTC boundary', () => {
	const id = boundary.activities.boundary.activity_id;
	expect(JSON.parse(fixture('reconcile-at', 1, '2032-06-01T22:59:59Z', id)).code).toBe('OK');
	expect(scalar(`SELECT CONCAT(COUNT(*),'|',(SELECT state_after FROM llx_mjlfinancement_audit_event WHERE entity=1 AND activity_id=${id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED' ORDER BY rowid DESC LIMIT 1)) FROM llx_mjlfinancement_audit_event WHERE entity=1 AND activity_id=${id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED' AND JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.source'))='SCHEDULED'`)).toBe('1|IN_PROGRESS');
	expect(JSON.parse(fixture('reconcile-at', 1, '2032-06-01T23:00:00Z', id)).code).toBe('OK');
	expect(scalar(`SELECT CONCAT(COUNT(*),'|',(SELECT state_after FROM llx_mjlfinancement_audit_event WHERE entity=1 AND activity_id=${id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED' ORDER BY rowid DESC LIMIT 1)) FROM llx_mjlfinancement_audit_event WHERE entity=1 AND activity_id=${id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED' AND JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.source'))='SCHEDULED'`)).toBe('2|OVERDUE');
});

test('installed reconciler rolls back a failed transition and succeeds on retry', () => {
	const retry = createExecutionFixtureSet({
		namespace: 'p3c-retry', entity: 1,
		users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
		references: { partners: [{ key: 'partner', label: 'Partenaire reprise Phase 3C' }], projects: [{ key: 'project', label: 'Projet reprise Phase 3C', partnerKey: 'partner' }], operationTypes: [{ key: 'type', label: 'Type reprise Phase 3C' }] },
		activities: [{ key: 'retry', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Réconciliation à reprendre', description: 'Échec puis reprise.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération à reprendre', typeKey: 'type', authorizedAmount: '100' }] }],
	});
	const id = retry.activities.retry.activity_id;
	const before = Number(fixture('scheduled-count', 1, id));
	sql('RENAME TABLE llx_mjlfinancement_audit_event TO llx_mjlfinancement_audit_event_unavailable');
	try {
		expect(() => fixture('reconcile')).toThrow();
	} finally {
		sql('RENAME TABLE llx_mjlfinancement_audit_event_unavailable TO llx_mjlfinancement_audit_event');
	}
	expect(Number(fixture('scheduled-count', 1, id))).toBe(before);
	expect(JSON.parse(fixture('reconcile')).result).toBe(0);
	expect(Number(fixture('scheduled-count', 1, id))).toBe(before + 1);
});
