const statuses = ['TODO','IN_PROGRESS','COMPLETED','CANCELLED'];
const EXECUTION_TRANSITIONS = Object.freeze(statuses.flatMap((from) => statuses.map((to) => Object.freeze({
  from,
  to,
  allowed: (from === 'TODO' && ['TODO','IN_PROGRESS','COMPLETED'].includes(to)) || (from === 'IN_PROGRESS' && ['IN_PROGRESS','COMPLETED'].includes(to)),
  outcome: to === 'CANCELLED' ? 'INVALID_INPUT' : ((from === 'COMPLETED' || from === 'CANCELLED' || (from === 'IN_PROGRESS' && to === 'TODO')) ? 'CONFLICT' : 'OK'),
}))));

const REQUEST_STATES = Object.freeze(['PENDING','APPROVED','REJECTED','WITHDRAWN']);

module.exports = { EXECUTION_TRANSITIONS, REQUEST_STATES };
