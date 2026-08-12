const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { verifyDisposableEnvironment } = require('../../helpers/verify-disposable-environment');

const adminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
const marker = `R2A${Date.now().toString().slice(-10)}`;
const prefix = `rst002a.${marker.toLowerCase()}`;
const deniedPattern = /Accès refusé|Access denied|Forbidden|Non autorisé|temporairement indisponibles/i;
const roles = {
  agent: 'AGENT_SAISIE',
  supervisor: 'AGENT_VERIFICATEUR',
  validator: 'VALIDATEUR_DEFINITIF',
};
const ids = {};

test.describe.configure({ mode: 'serial' });

function composeExec(service, args, options = {}) {
  return execFileSync('docker', ['compose', 'exec', '-T', service, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: options.encoding || 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function sql(query) {
  return composeExec('mariadb', ['mariadb', '-udolidbuser', `-p${process.env.MYSQL_PASSWORD || 'poc_pwd'}`, 'dolidb', '-e', query]);
}

function scalar(query) {
  return composeExec('mariadb', ['mariadb', '-N', '-B', '-udolidbuser', `-p${process.env.MYSQL_PASSWORD || 'poc_pwd'}`, 'dolidb', '-e', query]).trim();
}

function phpEval(code) {
  const encoded = Buffer.from(code, 'utf8').toString('base64');
  return composeExec('dolibarr', ['php', '-r', `eval(base64_decode('${encoded}'));`]).trim();
}

function cleanup() {
  sql(`
    SET @users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE import_key = '${marker}' OR login LIKE '${prefix}.%');
    DELETE FROM llx_mjlfinancement_exchange_log WHERE import_key = '${marker}';
    DELETE FROM llx_mjlfinancement_workflow_action WHERE import_key = '${marker}';
    DELETE FROM llx_mjlfinancement_access_audit WHERE FIND_IN_SET(fk_user, COALESCE(@users, '')) OR FIND_IN_SET(fk_actor, COALESCE(@users, ''));
    DELETE FROM llx_mjlfinancement_password_reset WHERE FIND_IN_SET(fk_user, COALESCE(@users, ''));
    DELETE FROM llx_mjlfinancement_invitation WHERE FIND_IN_SET(fk_user, COALESCE(@users, ''));
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE FIND_IN_SET(fk_user, COALESCE(@users, '')) OR import_key = '${marker}';
    DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user, COALESCE(@users, ''));
    DELETE FROM llx_user_rights WHERE FIND_IN_SET(fk_user, COALESCE(@users, ''));
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@users, ''));
    DELETE FROM llx_mjlfinancement_activity WHERE import_key = '${marker}';
    DELETE FROM llx_mjlfinancement_convention WHERE import_key = '${marker}';
    DELETE FROM llx_projet_task WHERE import_key = '${marker}';
    DELETE FROM llx_projet WHERE import_key = '${marker}';
    DELETE FROM llx_societe WHERE import_key = '${marker}';
    DELETE FROM llx_user WHERE import_key = '${marker}' OR login LIKE '${prefix}.%';
  `);
}

function seed() {
  sql(`
    SET @admin = (SELECT rowid FROM llx_user WHERE admin = 1 ORDER BY rowid LIMIT 1);
    INSERT INTO llx_societe (entity, nom, status, client, fournisseur, datec, import_key)
    VALUES (1, '${marker} Partner A', 1, 0, 0, NOW(), '${marker}'),
           (1, '${marker} Partner B', 1, 0, 0, NOW(), '${marker}'),
           (2, '${marker} Partner X', 1, 0, 0, NOW(), '${marker}');
    SET @pa = (SELECT rowid FROM llx_societe WHERE import_key='${marker}' AND entity=1 AND nom='${marker} Partner A');
    SET @pb = (SELECT rowid FROM llx_societe WHERE import_key='${marker}' AND entity=1 AND nom='${marker} Partner B');
    SET @px = (SELECT rowid FROM llx_societe WHERE import_key='${marker}' AND entity=2);
    INSERT INTO llx_projet (entity, ref, title, fk_soc, fk_statut, datec, fk_user_creat, import_key)
    VALUES (1, '${marker}-PA', '${marker} Project A', @pa, 1, NOW(), @admin, '${marker}'),
           (1, '${marker}-PB', '${marker} Project B', @pb, 1, NOW(), @admin, '${marker}'),
           (2, '${marker}-PX', '${marker} Project X', @px, 1, NOW(), @admin, '${marker}');
    SET @pra = (SELECT rowid FROM llx_projet WHERE ref='${marker}-PA');
    SET @prb = (SELECT rowid FROM llx_projet WHERE ref='${marker}-PB');
    SET @prx = (SELECT rowid FROM llx_projet WHERE ref='${marker}-PX');
    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, total_amount, currency_code, status, date_creation, fk_user_creat, import_key)
    VALUES (1, '${marker}-CA', '${marker} Convention Secret A', @pa, @pra, 111111, 'XOF', 1, NOW(), @admin, '${marker}'),
           (1, '${marker}-CB', '${marker} Convention Secret B', @pb, @prb, 222222, 'XOF', 1, NOW(), @admin, '${marker}'),
           (2, '${marker}-CX', '${marker} Convention Secret X', @px, @prx, 333333, 'XOF', 1, NOW(), @admin, '${marker}');
    SET @ca = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref='${marker}-CA');
    SET @cb = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref='${marker}-CB');
    SET @cx = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref='${marker}-CX');
    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, status, date_creation, fk_user_creat, import_key)
    VALUES (1, '${marker}-AA', '${marker} Activity A', @pra, @ca, '2026-01-01', '2026-12-31', 3, NOW(), @admin, '${marker}'),
           (1, '${marker}-AB', '${marker} Activity B', @prb, @cb, '2026-01-01', '2026-12-31', 3, NOW(), @admin, '${marker}'),
           (2, '${marker}-AX', '${marker} Activity X', @prx, @cx, '2026-01-01', '2026-12-31', 3, NOW(), @admin, '${marker}');
    SET FOREIGN_KEY_CHECKS=0;
    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, status, date_creation, fk_user_creat, import_key)
    VALUES (1, '${marker}-AC', '${marker} Activity Corrupt', @pra, @cx, '2026-01-01', '2026-12-31', 3, NOW(), @admin, '${marker}');
    SET FOREIGN_KEY_CHECKS=1;
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec, fk_user_creat, import_key)
    SELECT 1, '${prefix}.agent', 'RST002A', 'Agent', '${prefix}.agent@mjl.invalid', pass_crypted, 1, 0, NOW(), @admin, '${marker}' FROM llx_user WHERE rowid=@admin;
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec, fk_user_creat, import_key)
    SELECT 1, '${prefix}.supervisor', 'RST002A', 'Supervisor', '${prefix}.supervisor@mjl.invalid', pass_crypted, 1, 0, NOW(), @admin, '${marker}' FROM llx_user WHERE rowid=@admin;
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec, fk_user_creat, import_key)
    SELECT 1, '${prefix}.validator', 'RST002A', 'Validator', '${prefix}.validator@mjl.invalid', pass_crypted, 1, 0, NOW(), @admin, '${marker}' FROM llx_user WHERE rowid=@admin;
  `);
  for (const [name, role] of Object.entries(roles)) {
    const userId = Number(scalar(`SELECT rowid FROM llx_user WHERE login='${prefix}.${name}'`));
    expect(userId).toBeGreaterThan(0);
    ids[name] = userId;
    const result = phpEval(`define('NOLOGIN',1); require '/var/www/html/main.inc.php'; require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php'; require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php'; global $db,$user; $a=new User($db); $a->fetch(0,'admin'); $user=$a; $r=mjl_scope_assign_access_profile(${userId}, '${role}', $a, 1, 'rst002a_e2e', 'Disposable RST-002A fixture'); echo (int)$r[0];`);
    expect(result).toBe('1');
  }
  for (const [key, query] of Object.entries({
    partnerA: `SELECT rowid FROM llx_societe WHERE nom='${marker} Partner A'`,
    partnerB: `SELECT rowid FROM llx_societe WHERE nom='${marker} Partner B'`,
    activityA: `SELECT rowid FROM llx_mjlfinancement_activity WHERE ref='${marker}-AA'`,
    activityB: `SELECT rowid FROM llx_mjlfinancement_activity WHERE ref='${marker}-AB'`,
    activityX: `SELECT rowid FROM llx_mjlfinancement_activity WHERE ref='${marker}-AX'`,
    activityCorrupt: `SELECT rowid FROM llx_mjlfinancement_activity WHERE ref='${marker}-AC'`,
    projectB: `SELECT rowid FROM llx_projet WHERE ref='${marker}-PB'`,
  })) {
    ids[key] = Number(scalar(query));
    expect(ids[key]).toBeGreaterThan(0);
  }
  expect(new Set([ids.activityA, ids.activityB, ids.activityX, ids.activityCorrupt]).size).toBe(4);
  expect(ids.partnerA).not.toBe(ids.partnerB);
}

function insertPoisonRows() {
  for (const userId of [ids.agent, ids.supervisor, ids.validator]) {
    sql(`INSERT INTO llx_mjlfinancement_user_soc_scope (entity,fk_user,fk_soc,is_active,date_start,date_end,source,note,date_creation,fk_user_creat,import_key) VALUES
      (1,${userId},${ids.partnerA},1,'2026-08-12 08:00:00',NULL,'rst002a_poison','active same entity','2026-08-12 08:00:00',1,'${marker}'),
      (1,${userId},${ids.partnerB},0,'2026-08-11 08:00:00','2026-08-12 07:00:00','rst002a_poison','inactive same entity','2026-08-12 08:00:00',1,'${marker}'),
      (2,${userId},(SELECT rowid FROM llx_societe WHERE entity=2 AND import_key='${marker}'),1,'2026-08-12 08:00:00',NULL,'rst002a_poison','active cross entity','2026-08-12 08:00:00',1,'${marker}'),
      (2,${userId},(SELECT rowid FROM llx_societe WHERE entity=2 AND import_key='${marker}'),0,'2026-08-11 08:00:00','2026-08-12 07:00:00','rst002a_poison','inactive cross entity','2026-08-12 08:00:00',1,'${marker}')`);
  }
}

async function login(page, loginName, expectedRole) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
  await page.getByLabel('Mot de passe').fill(adminPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
  await expect(page.locator('a[href*="logout.php"]')).not.toHaveCount(0);
  if (expectedRole) expect(scalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE fk_user=(SELECT rowid FROM llx_user WHERE login='${loginName}') AND is_active=1`)).toBe(expectedRole);
  expect(scalar(`SELECT admin FROM llx_user WHERE login='${loginName}'`)).toBe(expectedRole ? '0' : '1');
}

async function expectDenied(page, path) {
  const response = await page.goto(path);
  expect(response).not.toBeNull();
  expect([200, 401, 403]).toContain(response.status());
  expect(new URL(page.url()).pathname).toBe(new URL(path, process.env.MJL_BASE_URL).pathname);
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
  await expect(page.locator('body')).toContainText(deniedPattern);
}

async function sessionToken(page) {
  const input = page.locator('input[name="token"]').first();
  if (await input.count()) return input.inputValue();
  const meta = page.locator('meta[name="anti-csrf-newtoken"]');
  if (await meta.count()) return meta.getAttribute('content');
  const href = await page.locator('a[href*="logout.php"][href*="token="]').first().getAttribute('href', { timeout: 1000 });
  return href ? new URL(href, 'http://mjl.local').searchParams.get('token') : '';
}

test.beforeAll(() => {
  verifyDisposableEnvironment();
  cleanup();
  expect(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope')).toBe('0');
  seed();
});

test.afterAll(() => {
  cleanup();
  expect(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope')).toBe('0');
  expect(scalar(`SELECT COUNT(*) FROM llx_user WHERE import_key='${marker}' OR login LIKE '${prefix}.%'`)).toBe('0');
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope WHERE import_key='${marker}'`)).toBe('0');
  expect(scalar(`SELECT COUNT(*) FROM llx_societe WHERE import_key='${marker}'`)).toBe('0');
  expect(scalar(`SELECT (SELECT COUNT(*) FROM llx_mjlfinancement_user_role r INNER JOIN llx_user u ON u.rowid=r.fk_user WHERE u.import_key='${marker}')+(SELECT COUNT(*) FROM llx_mjlfinancement_invitation i INNER JOIN llx_user u ON u.rowid=i.fk_user WHERE u.import_key='${marker}')+(SELECT COUNT(*) FROM llx_mjlfinancement_access_audit WHERE context LIKE '%${marker}%')+(SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE import_key='${marker}')+(SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE import_key='${marker}')+(SELECT COUNT(*) FROM llx_projet WHERE import_key='${marker}')+(SELECT COUNT(*) FROM llx_mjlfinancement_exchange_log WHERE import_key='${marker}')+(SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE import_key='${marker}')`)).toBe('0');
});

test('zero-row and poisoned scope states produce identical authorization outcomes', async ({ page }) => {
  const capture = async () => {
    const result = {};
    for (const [name, role] of Object.entries(roles)) {
      await login(page, `${prefix}.${name}`, role);
      result[name] = [];
      for (const path of ['/custom/mjlfinancement/activities.php', `/custom/mjlfinancement/activities.php?id=${ids.activityA}`, `/custom/mjlfinancement/activities.php?id=${ids.activityB}`, `/custom/mjlfinancement/activities.php?id=${ids.activityX}`, `/custom/mjlfinancement/partners.php?id=${ids.partnerB}`, `/custom/mjlfinancement/projects.php?id=${ids.projectB}`]) {
        const response = await page.goto(path);
        result[name].push([response.status(), (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()]);
      }
    }
    return result;
  };
  expect(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope')).toBe('0');
  const baseline = await capture();
  insertPoisonRows();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope WHERE import_key='${marker}'`))).toBe(12);
  expect(await capture()).toEqual(baseline);
});

test('role-only access administration ignores hostile Partner payloads', async ({ page }) => {
  const poisonBefore = scalar(`SELECT GROUP_CONCAT(CONCAT_WS('|',rowid,entity,fk_user,fk_soc,is_active,COALESCE(date_start,''),COALESCE(date_end,''),source,note,import_key) ORDER BY rowid SEPARATOR ';') FROM llx_mjlfinancement_user_soc_scope WHERE import_key='${marker}'`);
  await login(page, 'admin');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.locator('select[name="scope_soc_ids[]"]')).toHaveCount(0);
  await page.locator('#mjl-login').fill(`${prefix}.forged`);
  await page.locator('#mjl-firstname').fill('Forged');
  await page.locator('#mjl-lastname').fill('Payload');
  await page.locator('#mjl-email').fill(`${prefix}.forged@mjl.invalid`);
  await page.locator('select[name="role_code"]').first().selectOption('AGENT_VERIFICATEUR');
  await page.locator('form').filter({ has: page.locator('#mjl-login') }).evaluate((form, value) => {
    const hidden = document.createElement('input');
    hidden.type = 'hidden'; hidden.name = 'scope_soc_ids[]'; hidden.value = value; form.appendChild(hidden);
  }, String(ids.partnerB));
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  const forgedId = Number(scalar(`SELECT rowid FROM llx_user WHERE login='${prefix}.forged'`));
  expect(forgedId).toBeGreaterThan(0);
  expect(scalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE fk_user=${forgedId} AND is_active=1`)).toBe('AGENT_VERIFICATEUR');
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope WHERE fk_user=${forgedId}`)).toBe('0');
  expect(scalar(`SELECT context FROM llx_mjlfinancement_access_audit WHERE fk_user=${forgedId} AND event='access_profile_assigned' ORDER BY rowid DESC LIMIT 1`)).not.toMatch(/scope|partner|partenaire/i);
  expect(scalar(`SELECT GROUP_CONCAT(CONCAT_WS('|',rowid,entity,fk_user,fk_soc,is_active,COALESCE(date_start,''),COALESCE(date_end,''),source,note,import_key) ORDER BY rowid SEPARATOR ';') FROM llx_mjlfinancement_user_soc_scope WHERE import_key='${marker}'`)).toBe(poisonBefore);
});

test('Agent Activity access and every HTTP mutation fail closed without side effects', async ({ page }) => {
  await login(page, `${prefix}.agent`, roles.agent);
  await expectDenied(page, '/custom/mjlfinancement/activities.php');
  await expectDenied(page, `/custom/mjlfinancement/activities.php?id=${ids.activityA}`);
  await expectDenied(page, '/custom/mjlfinancement/activities.php?action=create');

  await login(page, `${prefix}.supervisor`, roles.supervisor);
  await page.goto(`/custom/mjlfinancement/activities.php?id=${ids.activityA}`);
  const token = await sessionToken(page);
  expect(token).toBeTruthy();
  const before = scalar(`SELECT CONCAT((SELECT status FROM llx_mjlfinancement_activity WHERE rowid=${ids.activityA}),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type='mjlfinancement_activity' AND object_id=${ids.activityA}),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_exchange_log WHERE object_type='mjlfinancement_activity' AND object_id=${ids.activityA}),'|',(SELECT COUNT(*) FROM llx_ecm_files WHERE src_object_type='mjlfinancement_activity' AND src_object_id=${ids.activityA}))`);
  for (const action of ['create', 'update', 'update_execution', 'submit', 'correct', 'prevalidate', 'final_validate', 'validate', 'reject', 'request_correction', 'add_exchange', 'upload']) {
    const result = await page.evaluate(async ({ action, id, token }) => {
      const body = new URLSearchParams({ action, id: String(id), token, ref: 'FORBIDDEN', label: 'FORBIDDEN', comment: 'FORBIDDEN', message: 'FORBIDDEN' });
      const response = await fetch('/custom/mjlfinancement/activities.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      return { status: response.status, text: await response.text() };
    }, { action, id: ids.activityA, token });
    expect(result.status).toBe(403);
    expect(result.text).toMatch(deniedPattern);
  }
  expect(scalar(`SELECT CONCAT((SELECT status FROM llx_mjlfinancement_activity WHERE rowid=${ids.activityA}),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type='mjlfinancement_activity' AND object_id=${ids.activityA}),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_exchange_log WHERE object_type='mjlfinancement_activity' AND object_id=${ids.activityA}),'|',(SELECT COUNT(*) FROM llx_ecm_files WHERE src_object_type='mjlfinancement_activity' AND src_object_id=${ids.activityA}))`)).toBe(before);
});

test('direct Activity class mutations including notrigger fail at the domain seam', () => {
  const before = scalar(`SELECT CONCAT(status,'|',label,'|',COALESCE(execution_comment,'')) FROM llx_mjlfinancement_activity WHERE rowid=${ids.activityA}`);
  const result = JSON.parse(phpEval(`
    define('NOLOGIN',1); require '/var/www/html/main.inc.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
    global $db,$user;
    $u=new User($db); $u->fetch(0,'${prefix}.validator');
    $user=$u;
    $a=new MjlActivity($db); $a->fetch(${ids.activityA});
    $results=array();
    $results['update']=$a->update($u,1);
    $results['delete']=$a->delete($u,1);
    $results['important']=$a->updateImportantFields($u,array('label'=>'FORBIDDEN'),'FORBIDDEN','VALIDATEUR_DEFINITIF',1);
    $results['execution']=$a->updateExecution($u,array('execution_comment'=>'FORBIDDEN'),'VALIDATEUR_DEFINITIF',1);
    $results['submit']=$a->submit($u,'FORBIDDEN','VALIDATEUR_DEFINITIF',1);
    $results['correct']=$a->correct($u,'FORBIDDEN','VALIDATEUR_DEFINITIF',1);
    $results['prevalidate']=$a->prevalidate($u,'FORBIDDEN','VALIDATEUR_DEFINITIF',1);
    $results['final']=$a->finalValidate($u,'FORBIDDEN','VALIDATEUR_DEFINITIF',1);
    $results['validate']=$a->validate($u,'FORBIDDEN','VALIDATEUR_DEFINITIF',1);
    $results['correction']=$a->requestCorrection($u,'FORBIDDEN','VALIDATEUR_DEFINITIF',1);
    $results['reject']=$a->reject($u,'FORBIDDEN','VALIDATEUR_DEFINITIF',1);
    $new=new MjlActivity($db); $new->entity=1; $new->ref='FORBIDDEN'; $new->label='FORBIDDEN';
    $results['create']=$new->create($u,1);
    echo json_encode($results);
  `));
  for (const value of Object.values(result)) expect(value).toBe(-1);
  expect(scalar(`SELECT CONCAT(status,'|',label,'|',COALESCE(execution_comment,'')) FROM llx_mjlfinancement_activity WHERE rowid=${ids.activityA}`)).toBe(before);

  sql(`INSERT INTO llx_mjlfinancement_exchange_log (entity,ref,object_type,object_id,exchange_date,actor,actor_role,channel,subject,message,date_creation,fk_user_creat,import_key) VALUES (1,'${marker}-SPOOF','mjlfinancement_activity',${ids.activityA},NOW(),1,'ADMIN_PLATEFORME','commentaire','Frozen','Immutable',NOW(),1,'${marker}')`);
  const spoofId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_exchange_log WHERE ref='${marker}-SPOOF'`));
  expect(spoofId).toBeGreaterThan(0);
  sql(`INSERT INTO llx_mjlfinancement_exchange_log (entity,ref,object_type,object_id,exchange_date,actor,actor_role,channel,subject,message,date_creation,fk_user_creat,import_key) VALUES (2,'${marker}-CROSS-SPOOF','mjlfinancement_activity',${ids.activityX},NOW(),1,'ADMIN_PLATEFORME','commentaire','CrossFrozen','Immutable',NOW(),1,'${marker}')`);
  const crossSpoofId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_exchange_log WHERE ref='${marker}-CROSS-SPOOF'`));
  expect(crossSpoofId).toBeGreaterThan(0);
  const sideSeams = JSON.parse(phpEval(`
    define('NOLOGIN',1); require '/var/www/html/main.inc.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
    global $db,$user;
    $u=new User($db); $u->fetch(0,'${prefix}.validator');
    $user=$u;
    $comment=mjl_timeline_create_comment($u,'mjlfinancement_activity',${ids.activityA},'FORBIDDEN');
    $error=''; $upload=mjl_document_upload_to_ecm('mjlfinancement_activity',${ids.activityA},1,'missing','activity','ACT','FORBIDDEN',$error);
    $x=new MjlExchangeLog($db); $x->entity=1; $x->ref='FORBIDDEN'; $x->object_type='mjlfinancement_activity'; $x->object_id=${ids.activityA};
    $spoofUpdate=new MjlExchangeLog($db); $spoofUpdate->fetch(${spoofId}); $spoofUpdate->object_type='mjlfinancement_project'; $spoofUpdate->subject='SPOOFED';
    $spoofDelete=new MjlExchangeLog($db); $spoofDelete->fetch(${spoofId}); $spoofDelete->object_type='mjlfinancement_project';
    $cross=new MjlExchangeLog($db); $cross->id=${crossSpoofId}; $cross->object_type='mjlfinancement_project'; $cross->subject='SPOOFED';
    $missing=new MjlExchangeLog($db); $missing->id=999999999; $missing->object_type='mjlfinancement_project';
    echo json_encode(array('comment'=>$comment[0],'upload'=>count($upload),'upload_error'=>$error,'exchange'=>$x->create($u,1),'exchange_update'=>$x->update($u,1),'exchange_delete'=>$x->delete($u,1),'spoof_update'=>$spoofUpdate->update($u,1),'spoof_delete'=>$spoofDelete->delete($u,1),'cross_update'=>$cross->update($u,1),'cross_delete'=>$cross->delete($u,1),'missing_update'=>$missing->update($u,1),'missing_delete'=>$missing->delete($u,1)));
  `));
  expect(sideSeams.comment).toBe(-1);
  expect(sideSeams.upload).toBe(0);
  expect(sideSeams.upload_error).toMatch(/RST-002A/);
  expect(sideSeams.exchange).toBe(-1);
  expect(sideSeams.exchange_update).toBe(-1);
  expect(sideSeams.exchange_delete).toBe(-1);
  expect(sideSeams.spoof_update).toBe(-1);
  expect(sideSeams.spoof_delete).toBe(-1);
  expect(sideSeams.cross_update).toBe(-1);
  expect(sideSeams.cross_delete).toBe(-1);
  expect(sideSeams.missing_update).toBe(-1);
  expect(sideSeams.missing_delete).toBe(-1);
  expect(scalar(`SELECT CONCAT(object_type,'|',subject,'|',message) FROM llx_mjlfinancement_exchange_log WHERE rowid=${spoofId}`)).toBe('mjlfinancement_activity|Frozen|Immutable');
  expect(scalar(`SELECT COUNT(*) FROM llx_ecm_files WHERE src_object_type='mjlfinancement_activity' AND src_object_id=${ids.activityA}`)).toBe('0');
  expect(scalar(`SELECT CONCAT(object_type,'|',subject,'|',message) FROM llx_mjlfinancement_exchange_log WHERE rowid=${crossSpoofId}`)).toBe('mjlfinancement_activity|CrossFrozen|Immutable');
  sql(`DELETE FROM llx_mjlfinancement_exchange_log WHERE rowid IN (${spoofId},${crossSpoofId})`);
});

test('reviewers receive only the safe same-entity Activity projection', async ({ page }) => {
  for (const [name, role] of [['supervisor', roles.supervisor], ['validator', roles.validator]]) {
    await login(page, `${prefix}.${name}`, role);
    await page.goto('/custom/mjlfinancement/activities.php');
    await expect(page.getByText(`${marker} Activity A`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${marker} Activity B`, { exact: true })).toBeVisible();
    await page.goto(`/custom/mjlfinancement/activities.php?id=${ids.activityB}`);
    await expect(page.getByRole('heading', { name: new RegExp(`${marker}-AB`) })).toBeVisible();
    await expect(page.getByText(`${marker} Project B`, { exact: false })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(`${marker} Convention Secret B`);
    await expect(page.locator('body')).not.toContainText('222222');
    await expect(page.locator('body')).not.toContainText('Exécution physique');
    await expect(page.locator('form[method="POST"]')).toHaveCount(0);
    await expectDenied(page, `/custom/mjlfinancement/activities.php?id=${ids.activityX}`);
    await expectDenied(page, `/custom/mjlfinancement/activities.php?id=${ids.activityCorrupt}`);
    await expectDenied(page, `/custom/mjlfinancement/partners.php?id=${ids.partnerB}`);
    await expectDenied(page, `/custom/mjlfinancement/projects.php?id=${ids.projectB}`);
  }
});

test('Admin landing and diagnostics expose no business workspace', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('heading', { name: 'Administration technique MJL' })).toBeVisible();
  for (const label of ['Utilisateurs et accès', 'Historique des validations', 'Historique des actions', 'Historique des échanges']) await expect(page.getByRole('link', { name: label }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Rapports disponibles|Exécution physique|Risques échéance|Activités en revue/);
  for (const path of ['/custom/mjlfinancement/activities.php', '/custom/mjlfinancement/reports.php', '/custom/mjlfinancement/documents.php', '/custom/mjlfinancement/roadmap.php']) await expectDenied(page, path);
  for (const path of ['/custom/mjlfinancement/validations.php', '/custom/mjlfinancement/workflowactions.php', '/custom/mjlfinancement/exchangelogs.php']) {
    const response = await page.goto(path); expect(response.status()).toBe(200);
  }
});
