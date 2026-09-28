const childProcess = require('node:child_process');
const { createUserReferenceFixtureSet } = require('./user-reference-fixture');
const disposableEnvironment = require('./verify-disposable-environment');

function createActivityFixtureSet(request) {
  if (!request || Object.keys(request).join(',') !== 'namespace,entity,users,references,activities') throw new Error('Activity fixture request has an invalid shape.');
  if (!Array.isArray(request.activities) || request.activities.length > 12) throw new Error('Activity fixture Activities are invalid or oversized.');
  const references = createUserReferenceFixtureSet({ namespace: request.namespace, entity: request.entity, users: request.users, references: request.references });
  disposableEnvironment.verifyDisposableEnvironment();
  const validator = request.users.find((entry) => entry.role === 'VALIDATEUR_DEFINITIF');
  const activities = request.activities.map((activity) => ({
    ...activity,
    actorId: references.users[activity.agentKey]?.id,
    partnerId: references.partners[activity.partnerKey],
    projectId: references.projects[activity.projectKey],
    additionalAgentIds: (activity.additionalAgentKeys || []).map((key) => references.users[key]?.id),
    assignmentActorId: validator ? references.users[validator.key]?.id : null,
    operations: (activity.operations || []).map((operation) => ({ ...operation, typeId: references.operationTypes[operation.typeKey] })),
  }));
  let decoded;
  try {
    const output = childProcess.execFileSync('docker', ['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/activity-fixture.php'], {
      encoding: 'utf8', env: process.env, input: JSON.stringify({ entity: request.entity, activities }), stdio: ['pipe','pipe','pipe'],
    });
    decoded = JSON.parse(output);
  } catch (_) { throw new Error('Activity disposable fixture creation failed.'); }
  const keys = request.activities.map((activity) => activity.key).sort();
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded) || JSON.stringify(Object.keys(decoded).sort()) !== JSON.stringify(keys)
    || Object.values(decoded).some((outcome) => !outcome || !Number.isInteger(outcome.activity_id) || outcome.activity_id <= 0 || !Number.isInteger(outcome.version) || outcome.version <= 0)) {
    throw new Error('Activity disposable fixture returned an invalid response.');
  }
  return Object.freeze({ ...references, activities: Object.freeze(decoded) });
}

module.exports = { createActivityFixtureSet };
