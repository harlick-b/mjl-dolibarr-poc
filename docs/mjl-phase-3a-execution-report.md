# Phase 3A Execution Report

## Scope

This report covers the completed RST-006B, RST-013C, and RST-014C execution.

## Implemented behavior

- Opérations use `TODO`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED`, preserve
  null separately from explicit zero, require an observation for a differing
  spent amount, and lock terminal records.
- Cancellation and reopening requests bind immutable target versions. Activity
  cancellation additionally binds the current revision and a deterministic
  Opération-set hash.
- Agents request and withdraw; current Validators approve or reject. A former
  Agent who later becomes Validator may decide their historic request.
- Activity cancellation preserves completed Opérations and every financial
  value, cancels unfinished Opérations, ends all assignments, and leaves child
  requests pending but stale.
- Execution status and financial completeness are pure projections. The hourly
  reconciler is bounded, active-entity scoped, idempotent, and uses the
  Africa/Porto-Novo date.
- `operations.php` and `operationrequests.php` enforce role/entity scope,
  closed request shapes, CSRF, one-use submission contexts, and 50-row
  pagination. No Phase 3B surface was added.

## Committed-source gate evidence

- Every changed PHP file passed `php -l`; `git diff --check` also passed.
- `npm run test:unit` passed 161/161 tests. The final focused
  `npm run test:phase3a` gate passed 29/29 browser tests plus the complete
  schema, migration, rollback, cron, and teardown checks.
- `npm test` exited 0 in 863.7 seconds. Its `e2e` layer ran the same four
  batches selected by `npm run test:e2e`: 29/29 Phase 3A/document/audit,
  13/13 retained authorization/reference, 18/18 fixture isolation, and 52/52
  retained assignment/planning/navigation tests. A separate invocation of the
  alias was interrupted by the tool transport after its first three batches
  passed; the exact disposable tenant was removed. No product assertion failed.
- `npm run test:verify` passed in 206.5 seconds and removed its complete
  disposable tenant.
- `npm run test:manual-accessibility` correctly failed closed because no named
  reviewer, assistive technology, findings, notes, or signed verdict were
  supplied. Its disposable tenant was completely removed. This unsigned
  170-combination review is the sole carried readiness note.
- The expanded Phase 3A matrix includes BIGINT execution, all 16 direct lifecycle pairs,
  reopening withdrawal, malformed and overflowing guarded POST refusal,
  terminal/request immutability, exact cross-type race atomicity, full
  Activity-cascade rollback injection, complete active/cancelled financial
  browser values, parent cancellation/reopening conflict, removed assignments,
  isolation, and simultaneous reconciliation.
- The disposable migration gate covers exact predecessor rollback, fourteen
  interrupted forward points (the five phase checkpoints and every one of the
  nine cancellation/reopening foreign-key boundaries), convergence,
  idempotence, malformed-prefix refusal, exact target verification, and one
  enabled hourly cron row.
- Every completed disposable run removed its scoped containers, network, and
  database/document/config volumes. Failed diagnostic runs also cleaned up.
- Security-baseline, design-system, full-feature, Standards, and Spec reviews
  have zero unresolved actionable findings. The design review does not claim
  accessibility conformance while the signed human gate remains outstanding.

## Verdict

The guarded cutover of committed source `c520a11` completed on 2026-09-09.
It created private mode-0600 backup
`data/backups/rst006b/rst006b-before-2026-09-09T13-00-51-494Z.sql`
(874532 bytes, SHA-256
`b6492f3cc1bf86a04b6e4bbc3fc1642d748d0d1f8dab80bd774a2a403da90058`).
The business-document checksum remained
`903b198228c78ef2801048d25ef914395662b2ac97ea04bdffbd5997ba4e2f5f`.

Independent post-cutover verification passed the exact Phase 3A schema and
application health checks. It found the one active native administrator, zero
other users, zero Activities, Opérations, cancellation requests, reopening
requests, and audit rows, plus exactly one enabled hourly
`MjlExecutionReconciler::run` job.

Verdict: `PHASE_3A_READY_WITH_NOTES` under DEC-055. The sole note is the
unsigned 170-combination human accessibility review and its Phase 3A addendum.
This verdict authorizes Phase 3B development; it does not authorize production
release.
