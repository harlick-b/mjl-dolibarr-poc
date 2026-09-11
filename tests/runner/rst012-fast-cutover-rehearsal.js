#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourceRoot = path.resolve(__dirname, '../..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-rst012-wrapper-'));
const project = path.basename(temporaryRoot).toLowerCase();
const sentinel = crypto.randomBytes(16).toString('hex');
const compose = ['compose', '--env-file', '/dev/null', '--project-directory', temporaryRoot, '-f', path.join(temporaryRoot, 'docker-compose.yml'), '-p', project];

function assert(value, message) {
  if (!value) throw new Error(message);
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: options.cwd || temporaryRoot,
    encoding: 'utf8',
    env: options.env || process.env,
    input: options.input,
    stdio: options.stdio || ['pipe', 'pipe', 'pipe'],
  });
  if (result.error || !(options.accept || [0]).includes(result.status)) {
    const error = new Error(`${options.label || path.basename(executable)} failed (${result.status}). ${String(result.stderr || result.stdout || '').trim()}`);
    error.output = `${result.stdout || ''}${result.stderr || ''}`;
    throw error;
  }
  return result.stdout || '';
}

function dc(args, options = {}) {
  return run('/usr/bin/docker', [...compose, ...args], options);
}

function services() {
  return String(dc(['ps', '--status', 'running', '--services'])).trim().split('\n').filter(Boolean).sort();
}

function refreshSentinel() {
  dc(['exec', '-T', 'dolibarr', 'sh', '-ceu', 'target=/var/www/documents/.mjl-disposable-fixture-sentinel; printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > "$target"; chown root:root "$target"; chmod 0444 "$target"']);
}

function schema(mode, failurePoint = '') {
  refreshSentinel();
  const args = ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst012_export_schema.php', `--mode=${mode}`];
  if (mode === 'apply' || mode === 'rollback') args.push('--confirm=RST-012');
  if (failurePoint) args.push(`--failure-point=${failurePoint}`);
  return dc(args);
}

function wrapper(environment = {}) {
  return run(process.execPath, ['custom/mjlfinancement/scripts/rst012_fast_cutover.js', '--confirm=RST-012-FAST'], {
    label: 'RST-012 wrapper',
    env: {
      ...process.env,
      MJL_DISPOSABLE_TEST_TENANT: '1',
      MJL_DISPOSABLE_PROJECT_NAME: project,
      MJL_DISPOSABLE_RUN_SENTINEL: sentinel,
      ...environment,
    },
  });
}

function sql(statement) {
  return dc(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot "$MYSQL_DATABASE"'], { input: `${statement}\n` });
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function ready(port) {
  const deadline = Date.now() + 360000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2500) });
      if (response.status < 500) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('RST-012 wrapper tenant did not become ready.');
}

async function main() {
  const port = await freePort();
  process.stdout.write(`Disposable RST-012 wrapper project: ${project}\n`);
  fs.cpSync(path.join(sourceRoot, 'custom'), path.join(temporaryRoot, 'custom'), { recursive: true });
  let composeSource = fs.readFileSync(path.join(sourceRoot, 'docker-compose.yml'), 'utf8').replace('      - "8080:80"', `      - "127.0.0.1:${port}:80"`);
  composeSource = composeSource.replace('      DOLI_DB_PASSWORD: poc_pwd', `      DOLI_DB_PASSWORD: poc_pwd\n      MJL_DISPOSABLE_TEST_TENANT: "1"\n      MJL_DISPOSABLE_PROJECT_NAME: ${project}\n      MJL_DISPOSABLE_RUN_SENTINEL: ${sentinel}`);
  fs.writeFileSync(path.join(temporaryRoot, 'docker-compose.yml'), composeSource);
  fs.writeFileSync(path.join(temporaryRoot, '.gitignore'), '/data/\n');
  fs.mkdirSync(path.join(temporaryRoot, 'data/documents'), { recursive: true });
  run('/usr/bin/git', ['init', '--quiet']);
  run('/usr/bin/git', ['config', 'user.email', 'rst012-wrapper@example.test']);
  run('/usr/bin/git', ['config', 'user.name', 'RST-012 Wrapper Rehearsal']);
  run('/usr/bin/git', ['add', '.gitignore', 'docker-compose.yml', 'custom']);
  run('/usr/bin/git', ['commit', '--quiet', '-m', 'RST-012 wrapper rehearsal snapshot']);

  dc(['up', '-d']);
  if (process.env.MJL_RST012_REHEARSAL_FAIL_AFTER_SETUP === '1') throw new Error('Injected RST-012 rehearsal failure after setup.');
  await ready(port);

  dc(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
  schema('verify');
  process.stdout.write('RST-012 clean install passed.\n');
  dc(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
  schema('verify');
  process.stdout.write('RST-012 repeated activation passed.\n');

  sql(`INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_DISPOSABLE_FIXTURE_SENTINEL','${sentinel}','chaine',0,'RST-012 wrapper rehearsal',0);`);
  refreshSentinel();
  schema('rollback');
  schema('verify-predecessor');
  let refused = false;
  try {
    dc(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
  } catch (error) {
    refused = /MJL guarded migration required/.test(error.output);
  }
  assert(refused, 'Existing Phase 3A activation did not report guarded migration.');
  process.stdout.write('RST-012 guarded migration refusal passed.\n');

  for (const point of ['forward-001', 'forward-002', 'forward-003', 'forward-004']) {
    let interrupted = false;
    try { schema('apply', point); } catch (error) { interrupted = error.output.includes(`Injected RST-012 interruption after ${point}`); }
    assert(interrupted, `RST-012 did not stop at ${point}.`);
    schema('apply');
    schema('verify');
    schema('rollback');
    schema('verify-predecessor');
  }
  process.stdout.write('RST-012 interrupted DDL convergence passed.\n');

  let interrupted = false;
  try { schema('apply', 'forward-001'); } catch (error) { interrupted = /Injected RST-012 interruption/.test(error.output); }
  assert(interrupted, 'Malformed-state setup did not stop after table creation.');
  sql('ALTER TABLE llx_mjlfinancement_export_record ADD COLUMN malformed_probe INT NULL;');
  refused = false;
  try { schema('apply'); } catch (error) { refused = /RST012_UNKNOWN_SCHEMA/.test(error.output); }
  assert(refused, 'Malformed export schema was not refused.');
  refused = false;
  try { wrapper(); } catch (error) { refused = /predecessor contains export schema/.test(error.output); }
  assert(refused && JSON.stringify(services()) === JSON.stringify(['mariadb']), 'Malformed-state wrapper refusal did not keep traffic stopped.');
  sql('DROP TABLE llx_mjlfinancement_export_record;');
  dc(['start', 'dolibarr']);
  await ready(port);
  schema('verify-predecessor');
  process.stdout.write('RST-012 malformed-state refusal passed.\n');

  refused = false;
  try { wrapper({ MJL_RST012_REHEARSAL_FAIL_POST_RESTART: '1' }); } catch (error) { refused = /post-restart verification failure/.test(error.output); }
  assert(refused && JSON.stringify(services()) === JSON.stringify(['mariadb']), 'Post-restart wrapper failure did not stop traffic.');
  dc(['start', 'dolibarr']);
  await ready(port);
  schema('rollback');
  schema('verify-predecessor');
  process.stdout.write('RST-012 post-restart failure containment passed.\n');

  const output = wrapper();
  assert(output.includes('RST-012 cutover complete.'), 'Wrapper success was not reported.');
  assert(JSON.stringify(services()) === JSON.stringify(['dolibarr', 'mariadb']), 'Services were not restored.');
  const backups = fs.readdirSync(path.join(temporaryRoot, 'data/backups/rst012')).filter((name) => /^rst012-before-.*\.sql$/.test(name));
  assert(backups.length === 2, 'Private backups were not retained for both cutover attempts.');
  for (const name of backups) {
    const backup = path.join(temporaryRoot, 'data/backups/rst012', name);
    assert((fs.lstatSync(backup).mode & 0o777) === 0o600 && fs.statSync(backup).size > 0, 'Private backup custody is invalid.');
  }

  schema('rollback');
  schema('verify-predecessor');
  process.stdout.write('RST-012 empty rollback passed.\n');
  schema('apply');
  sql("START TRANSACTION; INSERT INTO llx_mjlfinancement_audit_event(entity,object_type,object_ref,actor_id,actor_name_snapshot,actor_role_snapshot,event_date,action,result,date_creation) VALUES(1,'report','MJL-CONTAINMENT',1,'Admin','ADMIN_PLATEFORME',NOW(),'EXPORT_GENERATED','SUCCESS',NOW()); SET @audit=LAST_INSERT_ID(); INSERT INTO llx_mjlfinancement_export_record(entity,ref,report_type,projection_version,format,status,fk_generator,generator_name_snapshot,generator_role_snapshot,date_snapshot,date_generation,filters_json,scope_json,body_row_count,byte_count,content_sha256,fk_audit_event) VALUES(1,'MJL-CONTAINMENT','audit',1,'csv','GENERATED',1,'Admin','ADMIN_PLATEFORME',NOW(),NOW(),'{}','[]',0,1,REPEAT('a',64),@audit); COMMIT;");
  refused = false;
  try { schema('rollback'); } catch (error) { refused = /RST012_EVIDENCE_PRESENT/.test(error.output); }
  assert(refused, 'Rollback removed export evidence.');
  refused = false;
  try { wrapper(); } catch (error) { refused = /predecessor contains export schema/.test(error.output); }
  assert(refused, 'Wrapper accepted a target containing export evidence.');
  assert(JSON.stringify(services()) === JSON.stringify(['mariadb']), 'Evidence containment did not stop application traffic.');
  const counts = String(dc(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot -N -B "$MYSQL_DATABASE" -e "SELECT (SELECT COUNT(*) FROM llx_mjlfinancement_export_record),(SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_ref=\'MJL-CONTAINMENT\')"'])).trim();
  assert(counts === '1\t1', 'Evidence containment changed export or audit evidence.');
  process.stdout.write('RST-012 evidence-preserving containment passed.\n');
}

let failure;
main().catch((error) => {
  failure = error;
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}).finally(() => {
  let cleanupError;
  for (const args of [
    ['stop'],
    ['run', '--rm', '--no-deps', '--entrypoint', '/bin/chmod', 'dolibarr', '-R', '0777', '/var/www/documents'],
    ['run', '--rm', '--no-deps', '--entrypoint', '/bin/chmod', 'mariadb', '-R', '0777', '/var/lib/mysql'],
  ]) {
    try { dc(args, { accept: [0, 1] }); } catch (error) { cleanupError ||= error; }
  }
  try {
    dc(['down', '--volumes', '--remove-orphans']);
    const filter = `label=com.docker.compose.project=${project}`;
    for (const args of [['ps', '-aq', '--filter', filter], ['volume', 'ls', '-q', '--filter', filter], ['network', 'ls', '-q', '--filter', filter]]) {
      assert(run('/usr/bin/docker', args, { cwd: sourceRoot }).trim() === '', 'Disposable wrapper cleanup left an owned Docker resource.');
    }
  } catch (error) {
    cleanupError ||= error;
  }
  if (cleanupError) {
    process.stderr.write(`RST-012 wrapper cleanup failed; workspace retained at ${temporaryRoot}. ${cleanupError.message}\n`);
    process.exitCode = 1;
  } else {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
  if (!failure && !cleanupError) process.stdout.write('RST-012 wrapper rehearsal passed with complete cleanup.\n');
});
