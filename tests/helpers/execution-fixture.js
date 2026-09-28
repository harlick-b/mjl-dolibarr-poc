const childProcess = require('node:child_process');
const { createActivityFixtureSet } = require('./activity-fixture');
const disposableEnvironment = require('./verify-disposable-environment');

function runFixture(script, request) {
  disposableEnvironment.verifyDisposableEnvironment();
  try {
    return JSON.parse(childProcess.execFileSync('docker', ['compose','exec','-T','--user','www-data','dolibarr','php',`/opt/mjl-tests/fixtures/${script}`], {
      encoding: 'utf8', env: process.env, input: JSON.stringify(request), stdio: ['pipe','pipe','pipe'],
    }));
  } catch (_) { throw new Error('Execution disposable fixture command failed.'); }
}

function createExecutionFixtureSet(request) {
  if (!request || Object.keys(request).join(',') !== 'namespace,entity,users,references,activities') throw new Error('Execution fixture request has an invalid shape.');
  if (!Array.isArray(request.activities) || request.activities.length > 8) throw new Error('Execution fixture Activities are invalid or oversized.');
  const activities = request.activities.map(({ finalize, ...activity }) => ({ ...activity, submit: true }));
  const activitySet = createActivityFixtureSet({ namespace: request.namespace, entity: request.entity, users: request.users, references: request.references, activities });
  const supervisor = request.users.find((entry) => entry.role === 'AGENT_VERIFICATEUR');
  const validator = request.users.find((entry) => entry.role === 'VALIDATEUR_DEFINITIF');
  const finalized = runFixture('execution-fixture.php', {
    entity: request.entity,
    supervisorId: supervisor ? activitySet.users[supervisor.key].id : null,
    validatorId: validator ? activitySet.users[validator.key].id : null,
    activities: request.activities.map((activity) => ({ key: activity.key, finalize: activity.finalize !== false, ...activitySet.activities[activity.key] })),
  });
  return Object.freeze({ ...activitySet, activities: Object.freeze(finalized) });
}

function runExecutionFixtureCommand(request) { return runFixture('activity-command-fixture.php', request); }

module.exports = { createExecutionFixtureSet, runExecutionFixtureCommand };
