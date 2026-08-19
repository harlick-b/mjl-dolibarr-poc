const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');

const adminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
const fixtureScript = '/opt/mjl-tests/fixtures/rst010a-document-state.php';
let fixture;

function fixtureAction(action) {
  const output = execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'dolibarr', 'php', fixtureScript, action],
    { encoding: 'utf8', env: process.env },
  );
  return JSON.parse(output);
}

async function login(page, loginName) {
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
  await page.getByLabel('Mot de passe').fill(adminPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

test.beforeAll(() => {
  fixture = fixtureAction('setup');
});

test.afterAll(() => {
  fixtureAction('cleanup');
});

test('[RST-010A] every custom and native document probe fails closed without mutating filesystem or ECM state', async ({ browser }) => {
  test.setTimeout(180000);

  const anonymous = await browser.newContext();
  const administrator = await browser.newContext();
  const businessUser = await browser.newContext();
  await login(await administrator.newPage(), 'admin');
  await login(await businessUser.newPage(), fixture.login);

  const before = fixtureAction('snapshot');
  const ids = fixture.references;
  const probes = [
    { path: '/custom/mjlfinancement/documents.php', custom: true },
    { path: '/custom/mjlfinancement/%64ocuments.php?entity=1', custom: true },
    { path: `/custom/mjlfinancement/documentdownload.php?id=${ids['RST010A-SAME']}&entity=1`, custom: true },
    { path: `/custom/mjlfinancement/documentdownload.php?id=${ids['RST010A-CROSS']}&entity=2`, custom: true },
    { path: `/custom/mjlfinancement/documentdownload.php?id=${ids['RST010A-ORPHAN']}&entity=1`, custom: true },
    { path: '/custom/mjlfinancement/documentdownload.php?hashp=rst010a-public-share-token', custom: true },
    { path: '/custom/mjlfinancement/documentdownload.php?file=..%2f..%2f..%2fetc%2fpasswd', custom: true },
    { path: '/custom/mjlfinancement/documentdownload.php?file=..%5c..%5cwindows%5cwin.ini', custom: true },
    { path: '/custom/mjlfinancement/documentdownload.php?file=%2fvar%2fwww%2fdocuments%2finitdb.log', custom: true },
    { path: `/custom/mjlfinancement/documentdownload.php?id=${ids['RST010A-SAME']}&id=${ids['RST010A-CROSS']}`, custom: true },
    { path: '/ecm', custom: false },
    { path: '/ecm/index.php', custom: false },
    { path: '/ecm/%69ndex.php?file=..%2f..%2finitdb.log', custom: false },
    { path: `/ecm/file_card.php?id=${ids['RST010A-CROSS']}&entity=2`, custom: false },
    { path: `/document.php?modulepart=ecm&file=mjl-rst010a-containment%2fentity-1%2fsame-entity.txt`, custom: false },
    { path: '/document.php?modulepart=ecm&file=..%2f..%2finitdb.log', custom: false },
    { path: '/document.php?hashp=rst010a-public-share-token', custom: false },
    { path: '/document.php/encoded-path-info?modulepart=ecm&file=..%2f..%2finitdb.log', custom: false },
    { path: '/viewimage.php?modulepart=ecm&file=mjl-rst010a-containment%2fshare%2fpublic-share.txt', custom: false },
    { path: '/viewimage.php/encoded-path-info?modulepart=ecm&file=..%2f..%2finitdb.log', custom: false },
    { path: '/%76iewimage.php?modulepart=ecm&file=..%2f..%2finitdb.log', custom: false },
  ];

  try {
    for (const [actor, context] of [
      ['anonymous', anonymous],
      ['administrator', administrator],
      ['business user', businessUser],
    ]) {
      for (const probe of probes) {
        for (const method of ['GET', 'POST']) {
          const response = await context.request.fetch(probe.path, {
            method,
            form: method === 'POST' ? {
              action: 'download',
              id: String(ids['RST010A-CROSS']),
              entity: '2',
              file: '../../initdb.log',
              hashp: 'rst010a-public-share-token',
            } : undefined,
            maxRedirects: 0,
          });
          expect(response.status(), `${actor} ${method} ${probe.path}`).toBe(403);
          const headers = response.headers();
          expect(headers['content-disposition'], `${actor} ${method} ${probe.path}`).toBeUndefined();
          if (probe.custom) {
            expect(headers['content-type']).toMatch(/^text\/plain;\s*charset=UTF-8$/i);
            expect(headers['cache-control']).toContain('no-store');
            expect(headers['x-content-type-options']).toBe('nosniff');
          }
          const body = await response.text();
          expect(body, `${actor} ${method} ${probe.path}`).not.toMatch(/fatal error|call to undefined function/i);
          for (const canary of fixture.canaries) {
            expect(body, `${actor} ${method} ${probe.path}`).not.toContain(canary);
          }
        }
      }
    }

    const after = fixtureAction('snapshot');
    expect(after).toEqual(before);
    console.log(`RST-010A disposable state SHA-256: ${before.aggregate_sha256}`);
    console.log(`RST-010A disposable filesystem SHA-256: ${before.filesystem.sha256}`);
    console.log(`RST-010A disposable llx_ecm_files SHA-256: ${before.ecm.llx_ecm_files.sha256}`);
    console.log(`RST-010A disposable llx_ecm_directories SHA-256: ${before.ecm.llx_ecm_directories.sha256}`);
  } finally {
    await Promise.all([anonymous.close(), administrator.close(), businessUser.close()]);
  }
});
