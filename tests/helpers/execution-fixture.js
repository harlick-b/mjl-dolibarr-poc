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

// Explicit setup through the real approval commands; never used to adapt an
// execution mutation or bypass a permission/stale-version assertion.
function approveFixtureExpense({ entity = 1, operationId, agentId, validatorId, amount, localDate = '2026-09-04' }) {
  const { scalar } = require('./mjl-test-runtime');
  const version = scalar(`SELECT version FROM llx_mjlfinancement_operation WHERE entity=${Number(entity)} AND rowid=${Number(operationId)}`);
  const draft = runExecutionFixtureCommand({
    entity, localDate, action: 'expense-save', actorId: agentId, operationId,
    expenseId: '0', expectedVersion: version,
    input: { label: 'Dépense approuvée de vérification', expense_date: localDate, amount, original_id: null, reason: null },
  });
  if (draft.code !== 'OK') throw new Error(`Expense fixture creation failed: ${draft.code}`);
  let expenseVersion = draft.expense_version;
  for (const [decision, actorId] of [['SUBMITTED', agentId], ['APPROVED', validatorId]]) {
    const result = runExecutionFixtureCommand({ entity, localDate, action: 'expense-transition', actorId, operationId,
      expenseId: String(draft.expense_id), expectedVersion: String(expenseVersion), decision, reason: '' });
    if (result.code !== 'OK') throw new Error(`Expense fixture ${decision} failed: ${result.code}`);
    expenseVersion = result.expense_version;
  }
  return scalar(`SELECT version FROM llx_mjlfinancement_operation WHERE entity=${Number(entity)} AND rowid=${Number(operationId)}`);
}

module.exports = { createExecutionFixtureSet, runExecutionFixtureCommand, approveFixtureExpense };
