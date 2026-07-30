# MJL Financement v2 — Phase 3 Implementation Report

## Verdict

`MJL_V2_PHASE3_IMPLEMENTED_PENDING_CROSS_PHASE_ACCESSIBILITY_VALIDATION`

Phase 3 implements the three authorized journey slices from the recorded
rollback base `ffeed1e58ef209c8b65e41274710b895cc1b208c`. The implementation
and automated repository gates are complete. This verdict is not a
phase-scoped accessibility validation, WCAG conformance claim, production
readiness finding, release approval, or deployment authorization.

## Checkpoints

| Slice | Commit |
| --- | --- |
| Phase 3A — portfolio and activity journeys | `0399646` |
| Phase 3B — expense and evidence journeys | `06fe50c` |
| Phase 3C — finance and supervision integration | Commit containing this report |

The slices can be rolled back in reverse order to the recorded base. No
Dolibarr core file, schema, migration, dependency, deployment state, or
production data was changed.

## Implemented journeys

- Phase 3A adds scoped, deterministic, paginated partner, project, and activity
  journeys; shared summaries, recovery, next actions, document states, and
  contextual histories.
- Phase 3B applies the shared presentation, recovery, filtering, pagination,
  evidence, decision, and timeline contracts to expenses without changing
  workflow stages, financial projections, no-self rules, permissions, POST
  names, or guarded download rules.
- Phase 3C applies the contracts to envelopes, budget lines, and fund receipts;
  retains projectless programme receipts; enriches dashboard card context and
  local unavailable states; preserves successful regions on source failure;
  and improves report summaries, generation feedback, guarded delivery
  explanation, and permission-preserving audit history.
- The shared integrity target registry now includes
  `mjlfinancement_report` and is used by both the audit script and dashboard
  diagnostic. A transaction-rolled-back smoke proves a valid report anchor is
  accepted and a missing report target remains detectable.

## Protected contracts

- Entity, active-partner, object, route, and POST guards remain server-side.
- Finance invariants, exact workflow transitions, stage actors/dates, audit
  rows, no-self validation, and projectless fund receipts remain covered.
- Official report permissions, required filters, columns, ordering, filenames,
  CSV/XLSX bytes, POST actions, and on-demand delivery behavior are unchanged.
- Supporting documents continue through guarded MJL download routes; no public
  ECM/document link was added.
- The approved v2 snapshot was not modified. Its tree hash remains
  `98d0053a934b83b4a21a6c67207e86b3c89fe7d0`.

## Verification

| Check | Result |
| --- | --- |
| Focused convention, budget-line, fund-receipt, and Phase 3 journey specs | 44 listed and covered by the complete gate |
| Combined partner → project → activity → expense → financing → report journey | Passed |
| Complete `npm run test:e2e` gate | 188 passed in 9.5 minutes |
| Scope model smoke | Passed |
| Activity workflow smoke | Passed |
| Expense validation smoke | Passed |
| Traceability/export smoke | Passed |
| Integrity target smoke | Passed |
| Dashboard/workspace/alerts partial-failure smoke | Passed |
| PHP and JavaScript syntax | Passed |
| `git diff --check` | Passed |
| Approved snapshot comparison against rollback base | Unchanged |
| Fixed-point Standards review | 0 High, 0 Medium |
| Fixed-point Specification review | 0 High, 0 Medium |

The complete browser gate includes all four roles, direct URL and POST
denials, CSRF, cross-scope and cross-entity failures, no-self decisions,
stale-action rejection, deterministic filters and pagination, empty and
partial states, guarded documents, workflow projections, official exports,
390/768/1024/1366 automated layout checks, keyboard behavior, and
JavaScript-disabled fallback.

## Integrity debt retained

The read-only unresolved-scope audit was run before the integrity correction
and again after bootstrap, seed, tests, and cleanup. Both executions exited
non-zero for the same category,
`workflow_action_without_resolvable_target`: historical workflow audit rows
whose temporary target objects were deleted by older test runs. This is
existing data-remediation debt, not a report-registry failure. No genuine
unresolved row was deleted or rewritten because data remediation is outside
Phase 3. The post-correction targeted smoke proves valid report anchors no
longer appear as unresolved while a missing report target remains detectable.

## Accessibility sequencing boundary

The user authorized Phase 3 to proceed before the unsigned Phase 2 manual
accessibility matrix was completed. That sequencing override does not convert
any pending Phase 2 evidence to passed. Phase 4 must validate the final
post-Phase-3 screens across the cross-phase manual matrix; recordings of the
older Phase 2 UI would not prove the resulting interface.

Until that evidence is completed and signed, this report must retain the
verdict above and must not be used as an accessibility, production-readiness,
release, merge, or deployment approval.
