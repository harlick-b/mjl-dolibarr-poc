const childProcess = require('node:child_process');
const { createPhase2FixtureSet } = require('./phase2-fixture');
const disposableEnvironment = require('./verify-disposable-environment');

function runFixture(script, request) {
  disposableEnvironment.verifyDisposableEnvironment();
  try {
    return JSON.parse(childProcess.execFileSync('docker', ['compose','exec','-T','--user','www-data','dolibarr','php',`/opt/mjl-tests/fixtures/${script}`], {
      encoding: 'utf8', env: process.env, input: JSON.stringify(request), stdio: ['pipe','pipe','pipe'],
    }));
  } catch (_) { throw new Error('Phase 3A disposable fixture command failed.'); }
}

function createPhase3AFixtureSet(request) {
  if (!request || Object.keys(request).join(',') !== 'namespace,entity,users,references,activities') throw new Error('Phase 3A fixture request has an invalid shape.');
  if (!Array.isArray(request.activities) || request.activities.length > 8) throw new Error('Phase 3A fixture Activities are invalid or oversized.');
  const activities = request.activities.map(({ finalize, ...activity }) => ({ ...activity, submit: true }));
  const phase2 = createPhase2FixtureSet({ namespace: request.namespace, entity: request.entity, users: request.users, references: request.references, activities });
  const supervisor = request.users.find((entry) => entry.role === 'AGENT_VERIFICATEUR');
  const validator = request.users.find((entry) => entry.role === 'VALIDATEUR_DEFINITIF');
  const finalized = runFixture('phase3a-fixture.php', {
    entity: request.entity,
    supervisorId: supervisor ? phase2.users[supervisor.key].id : null,
    validatorId: validator ? phase2.users[validator.key].id : null,
    activities: request.activities.map((activity) => ({ key: activity.key, finalize: activity.finalize !== false, ...phase2.activities[activity.key] })),
  });
  return Object.freeze({ ...phase2, activities: Object.freeze(finalized) });
}

function phase3ACommand(request) { return runFixture('phase3a-command.php', request); }

module.exports = { createPhase3AFixtureSet, phase3ACommand };

