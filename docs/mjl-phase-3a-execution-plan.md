# Phase 3A Execution Plan

## Authority and boundary

The user approved RST-006B, RST-013C, and RST-014C as one lean Phase 3A
delivery. The unit adds execution and exception workflows only. It creates no
persistent sample data and adds no Phase 3B dashboard, report, export, alert,
notification, or navigation behavior.

## Delivered slices

1. Exact RST-006A-to-RST-006B schema migration, pure execution projector, and
   integer-safe XOF totals and variance.
2. Assigned-Agent Opération execution editing with explicit zero, mandatory
   variance observations, optimistic locking, and terminal locks.
3. Version-bound cancellation and reopening requests with requester
   withdrawal, Validator approval/rejection, aggregate staleness, and one
   pending exception per target.
4. Activity cancellation cascade, hourly entity-scoped reconciliation,
   guarded French-first routes, and contextual request access.
5. Disposable fixtures, schema/migration/security/concurrency/browser gates,
   shared empty-tenant cutover, documentation, and the Phase 3A verdict.

## Stop conditions

Any functional, permission, isolation, concurrency, migration, cron, audit,
cleanup, security, design, or review finding yields `PHASE_3A_BLOCKED`.
Unsigned human accessibility evidence may be carried only as the sole note in
`PHASE_3A_READY_WITH_NOTES`. No verdict authorizes production launch.
