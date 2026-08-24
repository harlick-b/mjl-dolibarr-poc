const { test, expect } = require('@playwright/test');
const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { composeExec, scalar, sql } = require('../helpers/mjl-test-runtime');

const password = process.env.MJL_TEST_USER_PASSWORD;
const adminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
let primary;
let secondary;
let baseline;

test.describe.configure({ mode: 'serial' });

function evidence() {
  return JSON.parse(composeExec('dolibarr', ['php', '/opt/mjl-tests/fixtures/database-evidence.php'], 'utf8'));
}

function stableEvidence() {
  let previous = evidence();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = evidence();
    if (JSON.stringify(current) === JSON.stringify(previous)) return current;
    previous = current;
  }
  throw new Error('RST-005 database/filesystem evidence did not reach a stable baseline.');
}

async function login(page, loginName, loginPassword = password) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
  await page.getByLabel('Mot de passe').fill(loginPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

function insert(overrides = {}) {
  const values = {
    rowid: 'NULL',
    entity: 1,
    ref: "'RST005-PROBE'",
    partner: primary.partners.partner,
    project: primary.projects.project,
    name: "'RST005 probe'",
    description: "'RST005 probe description'",
    start: "'2032-01-01'",
    end: "'2032-12-31'",
    amount: '1',
    first: 'NULL',
    latest: 'NULL',
    status: "'DRAFT'",
    cancelled: '0',
    version: '1',
    creator: primary.users.validator.id,
    modifier: 'NULL',
    responsible: 'NULL',
    ...overrides,
  };
  return `INSERT INTO llx_mjlfinancement_activity
    (rowid,entity,ref,fk_partner,fk_project,name,description,date_start,date_end,draft_authorized_amount,
     first_submitted_amount,latest_validated_amount,validation_status,is_cancelled,version,date_creation,
     fk_user_creat,fk_user_modif,fk_user_responsible)
    VALUES (${values.rowid},${values.entity},${values.ref},${values.partner},${values.project},${values.name},${values.description},
      ${values.start},${values.end},${values.amount},${values.first},${values.latest},${values.status},${values.cancelled},
      ${values.version},NOW(),${values.creator},${values.modifier},${values.responsible})`;
}

let rejectedProbeId = -2147483000;
function rejectedInsert(overrides = {}) {
  rejectedProbeId += 1;
  return insert({ ...overrides, rowid: String(rejectedProbeId) });
}

test.beforeAll(() => {
  primary = createPhase1FixtureSet({
    namespace: 'rst005.primary', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
      { key: 'norole', role: null },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire RST-005' }, { key: 'other', label: 'Autre partenaire RST-005' }],
      projects: [
        { key: 'project', label: 'Projet RST-005', partnerKey: 'partner' },
        { key: 'nullparent', label: 'Projet parent nul RST-005', partnerKey: 'other' },
      ],
      operationTypes: [],
    },
  });
  secondary = createPhase1FixtureSet({
    namespace: 'rst005.secondary', entity: 2,
    users: [{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire RST-005 entité 2' }],
      projects: [{ key: 'project', label: 'Projet RST-005 entité 2', partnerKey: 'partner' }],
      operationTypes: [],
    },
  });
  sql(insert({ ref: "'RST005-ENTITY-1'", name: "'Activité RST-005 entité 1'", description: "'RST005_CANARY_DESCRIPTION_1'", amount: '9223372036854775807' }));
  sql(insert({ entity: 2, ref: "'RST005-ENTITY-2'", partner: secondary.partners.partner, project: secondary.projects.project, name: "'RST005_CANARY_OTHER_ENTITY'", description: "'RST005_CANARY_DESCRIPTION_2'", amount: '0', creator: secondary.users.validator.id }));
  sql(`UPDATE llx_projet SET fk_soc=NULL WHERE rowid=${primary.projects.nullparent}`);
  baseline = evidence();
});

test('anonymous GET, POST, action, and traversal probes fail closed without redirect', async ({ request }) => {
  for (const probe of [
    ['get', '/custom/mjlfinancement/activities.php'],
    ['get', '/custom/mjlfinancement/activities.php?id=..%2F2'],
    ['get', '/custom/mjlfinancement/activities.php?action=create'],
    ['post', '/custom/mjlfinancement/activities.php'],
    ['post', '/custom/mjlfinancement/activities.php?action=delete'],
  ]) {
    const response = probe[0] === 'get'
      ? await request.get(probe[1], { maxRedirects: 0 })
      : await request.post(probe[1], { form: { action: 'create', id: '../2' }, maxRedirects: 0 });
    expect(response.status()).toBe(403);
    expect(response.headers().location).toBeUndefined();
    const body = await response.text();
    expect(body).not.toMatch(/Identifiant|RST005-ENTITY|<form/i);
  }
  const forged = await request.get('/custom/mjlfinancement/activities.php', {
    headers: { Cookie: 'DOLSESSID_forged=not-a-session' }, maxRedirects: 0,
  });
  expect(forged.status()).toBe(403);
  expect(forged.headers().location).toBeUndefined();
  expect(await forged.text()).not.toMatch(/Identifiant|RST005-ENTITY|<form/i);
  expect(evidence()).toEqual(baseline);
});

test('only Supervisor and Validator read the active-entity minimal projection; every POST is denied', async ({ browser }) => {
  const roles = [
    ['agent', 'rst005.primary.agent', password, 403],
    ['supervisor', 'rst005.primary.supervisor', password, 200],
    ['validator', 'rst005.primary.validator', password, 200],
    ['norole', 'rst005.primary.norole', password, 403],
    ['admin', 'admin', adminPassword, 403],
  ];
  for (const [role, loginName, credential, getStatus] of roles) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, loginName, credential);
    await expect(page.getByRole('link', { name: 'Activités' })).toHaveCount(0);
    const roleBaseline = stableEvidence();
    const get = await page.request.get('/custom/mjlfinancement/activities.php?id=../2');
    expect(get.status(), role).toBe(getStatus);
    const body = await get.text();
    if (getStatus === 200) {
      expect(body).toContain('RST005-ENTITY-1');
      expect(body).toContain('Activit&eacute; RST-005 entit&eacute; 1');
      expect(body).not.toContain('RST005_CANARY_OTHER_ENTITY');
      expect(body).not.toContain('RST005_CANARY_DESCRIPTION_1');
      expect(body).not.toContain('9223372036854775807');
      expect(body).not.toContain('<form');
    }
    for (const url of ['/custom/mjlfinancement/activities.php', '/custom/mjlfinancement/activities.php?action=delete']) {
      const post = await page.request.post(url, { form: { action: 'create', entity: '2', fk_project: String(secondary.projects.project) } });
      expect(post.status(), `${role} ${url}`).toBe(403);
    }
    expect(evidence(), `${role} rejected requests changed database/filesystem evidence`).toEqual(roleBaseline);
    await context.close();
  }
});

test('database invariants reject cross-entity, cross-parent, orphan, invalid, and mutation probes', () => {
  const databaseBaseline = stableEvidence();
  const rejected = [
    rejectedInsert({ ref: "'RST005-CROSS-PARTNER'", partner: secondary.partners.partner }),
    rejectedInsert({ ref: "'RST005-CROSS-PROJECT'", project: secondary.projects.project }),
    rejectedInsert({ ref: "'RST005-MISMATCH'", partner: primary.partners.other }),
    rejectedInsert({ ref: "'RST005-ORPHAN-PARTNER'", partner: 2147483000 }),
    rejectedInsert({ ref: "'RST005-ORPHAN-PROJECT'", project: 2147483000 }),
    rejectedInsert({ ref: "'RST005-ORPHAN-CREATOR'", creator: 2147483000 }),
    rejectedInsert({ ref: "'RST005-CROSS-CREATOR'", creator: secondary.users.validator.id }),
    rejectedInsert({ ref: "'RST005-CROSS-MODIFIER'", modifier: secondary.users.validator.id }),
    rejectedInsert({ ref: "'RST005-ORPHAN-MODIFIER'", modifier: 2147483000 }),
    rejectedInsert({ ref: "'RST005-ENTITY-1'" }),
    rejectedInsert({ ref: "'RST005-ENTITY-ZERO'", entity: 0 }),
    rejectedInsert({ ref: "'   '" }),
    rejectedInsert({ ref: "'RST005-BLANK-NAME'", name: "'\t\n '" }),
    rejectedInsert({ ref: "'RST005-BLANK-DESCRIPTION'", description: "'\t\n '" }),
    rejectedInsert({ ref: "'RST005-DATES'", start: "'2033-01-02'", end: "'2033-01-01'" }),
    rejectedInsert({ ref: "'RST005-NEGATIVE'", amount: '-1' }),
    rejectedInsert({ ref: "'RST005-NEGATIVE-FIRST'", first: '-1' }),
    rejectedInsert({ ref: "'RST005-NEGATIVE-LATEST'", latest: '-1' }),
    rejectedInsert({ ref: "'RST005-STATUS'", status: "'SUBMITTED'" }),
    rejectedInsert({ ref: "'RST005-ILLEGAL-STATUS'", status: "'NOT_A_STATUS'" }),
    rejectedInsert({ ref: "'RST005-CANCEL'", status: "'CANCELLED'", cancelled: '0' }),
    rejectedInsert({ ref: "'RST005-CANCEL-OPPOSITE'", status: "'DRAFT'", cancelled: '1' }),
    rejectedInsert({ ref: "'RST005-VERSION'", version: '0' }),
    rejectedInsert({ ref: "'RST005-RESPONSIBLE'", responsible: primary.users.agent.id }),
  ];
  for (const statement of rejected) expect(() => sql(statement)).toThrow();
  expect(() => sql(rejectedInsert({ ref: "'RST005-NULL-PARENT'", project: primary.projects.nullparent, partner: primary.partners.other }))).toThrow();
  expect(() => sql(`UPDATE llx_projet SET entity=NULL WHERE rowid=${primary.projects.project}`)).toThrow();
  for (const mutation of [
    'rowid=-99', 'entity=2', "ref='tampered'", `fk_user_creat=${secondary.users.validator.id}`, "date_creation='2040-01-01 00:00:00'",
    "name='tampered'", "description='tampered'", "draft_authorized_amount=2", "first_submitted_amount=1",
    "latest_validated_amount=1", "validation_status='SUBMITTED'", 'is_cancelled=1', 'version=2',
    `fk_partner=${primary.partners.other}`, `fk_project=${primary.projects.nullparent}`,
    `fk_user_modif=${primary.users.agent.id}`, `fk_user_responsible=${primary.users.agent.id}`,
  ]) expect(() => sql(`UPDATE llx_mjlfinancement_activity SET ${mutation} WHERE ref='RST005-ENTITY-1'`)).toThrow();
  expect(() => sql("DELETE FROM llx_mjlfinancement_activity WHERE ref='RST005-ENTITY-1'")).toThrow();
  expect(Number(scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('llx_mjlfinancement_workflow_action','llx_mjlfinancement_activity_assignment','llx_mjlfinancement_operation','llx_mjlfinancement_activity_revision','llx_mjlfinancement_review_decision')"))).toBe(0);
  expect(Number(scalar('SELECT COUNT(*) FROM llx_rights_def WHERE id=520006'))).toBe(1);
  expect(evidence()).toEqual(databaseBaseline);
});
